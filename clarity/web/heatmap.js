const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3001',
    imageQuality: 0.1,
    userId: null,
    batchSize: 20,
    maxBufferSize: 100,
    throttleMs: 16 // ~60fps
};

// Performance optimizations
const RAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
const CANCEL_RAF = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame;

class PerformantHeatmapTracker {
    constructor() {
        this.heatmapData = new Map();
        this.currentUrl = window.location.href;
        this.lastCapturedUrl = this.currentUrl;
        this.sessionId = this.getSessionId();

        // Optimized buffers
        this.mouseBuffer = [];
        this.clickBuffer = [];
        this.trailPoints = [];

        // Performance tracking
        this.lastMousePosition = null;
        this.isMouseInFocus = false;
        this.rafId = null;
        this.lastMouseTime = 0;
        this.lastFlushTime = 0;

        // WebSocket connection
        this.ws = null;
        this.wsReconnectAttempts = 0;
        this.wsMaxReconnectAttempts = 5;
        this.wsReconnectDelay = 1000;
        this.messageQueue = [];
        this.isConnected = false;

        // Timers
        this.captureTimer = null;
        this.cleanupTimer = null;
        this.bufferFlushTimer = null;

        // Canvas optimization
        this.canvasPool = [];
        this.maxCanvasPool = 3;

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initializeUrlData(this.currentUrl);
        this.setupEventListeners();
        this.startCapture();
        this.startCleanup();
        this.setupVisibilityHandlers();
    }

    // WebSocket Management
    connectWebSocket() {
        try {
            this.ws = new WebSocket(config.serverUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.wsReconnectAttempts = 0;
                this.sendQueuedMessages();
                this.sendSessionStart();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.warn('Invalid WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.wsReconnectAttempts < this.wsMaxReconnectAttempts) {
            this.wsReconnectAttempts++;
            const delay = this.wsReconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);
            setTimeout(() => this.connectWebSocket(), delay);
        }
    }

    sendWebSocketMessage(data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('Failed to send WebSocket message:', error);
                this.messageQueue.push(data);
            }
        } else {
            this.messageQueue.push(data);
        }
    }

    sendQueuedMessages() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.sendWebSocketMessage(message);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'ack':
                // Message acknowledged
                break;
            case 'config_update':
                this.updateConfig(data.config);
                break;
            case 'ping':
                this.sendWebSocketMessage({ type: 'pong', timestamp: Date.now() });
                break;
        }
    }

    // Session Management
    getSessionId() {
        let sessionId = sessionStorage.getItem('heatmapSessionId');
        if (!sessionId) {
            const userPrefix = config.userId ? `user_${config.userId}` : this.createSafeFilename(window.location.origin + window.location.pathname);
            sessionId = `${userPrefix}_${this.generateId()}_${Date.now()}_${this.generateId(4)}`;
            sessionStorage.setItem('heatmapSessionId', sessionId);
        }
        return sessionId;
    }

    generateId(length = 6) {
        return Math.random().toString(36).substr(2, length);
    }

    createSafeFilename(url) {
        return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50).replace(/_+/g, '_').replace(/^_|_$/g, '');
    }

    sendSessionStart() {
        this.sendWebSocketMessage({
            type: 'session_start',
            sessionId: this.sessionId,
            userId: config.userId,
            url: this.currentUrl,
            timestamp: Date.now(),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            }
        });
    }

    // Data Management
    initializeUrlData(url) {
        if (!this.heatmapData.has(url)) {
            this.heatmapData.set(url, {
                positions: [],
                timestamp: Date.now()
            });
        }
    }

    cleanupOldData() {
        const now = Date.now();
        const maxAge = 12 * 60 * 60 * 1000; // 12 hours

        for (const [url, data] of this.heatmapData.entries()) {
            if (now - data.timestamp > maxAge) {
                this.heatmapData.delete(url);
            }
        }
    }

    // Optimized Mouse Tracking
    setupEventListeners() {
        // Throttled mouse tracking
        document.addEventListener('mousemove', this.throttle(this.handleMouseMove.bind(this), config.throttleMs));
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('mouseleave', () => { this.isMouseInFocus = false; });
        document.addEventListener('mouseenter', () => { this.isMouseInFocus = true; });

        // URL change detection
        this.urlCheckTimer = setInterval(() => this.checkUrlChange(), 400);
    }

    throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    handleMouseMove(e) {
        const now = performance.now();

        // Update mouse position
        this.lastMousePosition = { x: e.clientX, y: e.clientY };
        this.isMouseInFocus = true;
        this.lastMouseTime = now;

        // Add to trail (optimized)
        this.trailPoints.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now,
            id: this.generateId()
        });

        // Keep trail size optimal
        if (this.trailPoints.length > 20) {
            this.trailPoints = this.trailPoints.slice(-15);
        }

        // Buffer mouse data
        this.mouseBuffer.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now
        });

        // Auto-flush when buffer is full
        if (this.mouseBuffer.length >= config.batchSize) {
            this.flushMouseBuffer();
        }

        // Schedule flush if not already scheduled
        if (!this.bufferFlushTimer) {
            this.bufferFlushTimer = setTimeout(() => {
                this.flushMouseBuffer();
                this.bufferFlushTimer = null;
            }, 100);
        }

        // Check URL change
        this.checkUrlChange();
    }

    handleClick(e) {
        const now = performance.now();

        this.clickBuffer.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now,
            id: this.generateId()
        });

        // Keep click buffer size optimal
        if (this.clickBuffer.length > 10) {
            this.clickBuffer = this.clickBuffer.slice(-8);
        }

        // Send click data immediately
        this.sendClickData();
    }

    sendClickData() {
        if (this.clickBuffer.length === 0) return;

        this.sendWebSocketMessage({
            type: 'click_data',
            sessionId: this.sessionId,
            url: this.currentUrl,
            clicks: [...this.clickBuffer],
            timestamp: Date.now()
        });
    }

    flushMouseBuffer() {
        if (this.mouseBuffer.length === 0) return;

        const urlData = this.heatmapData.get(this.currentUrl);
        if (!urlData) {
            this.initializeUrlData(this.currentUrl);
        }

        // Add to heatmap data
        const data = this.heatmapData.get(this.currentUrl);
        data.positions.push(...this.mouseBuffer);

        // Optimize memory usage
        if (data.positions.length > config.maxBufferSize) {
            data.positions = data.positions.slice(-Math.floor(config.maxBufferSize * 0.75));
        }

        data.timestamp = Date.now();

        // Send mouse data via WebSocket
        this.sendWebSocketMessage({
            type: 'mouse_data',
            sessionId: this.sessionId,
            url: this.currentUrl,
            positions: [...this.mouseBuffer],
            timestamp: Date.now()
        });

        // Clear buffer
        this.mouseBuffer = [];
        this.lastFlushTime = performance.now();
    }

    checkUrlChange() {
        const nowUrl = window.location.href;
        if (nowUrl !== this.currentUrl) {
            this.currentUrl = nowUrl;
            this.initializeUrlData(this.currentUrl);

            // Send URL change event
            this.sendWebSocketMessage({
                type: 'url_change',
                sessionId: this.sessionId,
                oldUrl: this.lastCapturedUrl,
                newUrl: this.currentUrl,
                timestamp: Date.now()
            });
        }
    }

    // Optimized Canvas Operations
    getCanvasFromPool() {
        return this.canvasPool.pop() || document.createElement('canvas');
    }

    returnCanvasToPool(canvas) {
        if (this.canvasPool.length < this.maxCanvasPool) {
            // Clear canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            this.canvasPool.push(canvas);
        }
    }

    async takeScreenshot() {
        const captureUrl = this.currentUrl;
        const urlData = this.heatmapData.get(captureUrl);

        if (!urlData || urlData.positions.length === 0) return;

        try {
            // Use html2canvas with optimized settings
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                scale: 0.3, // Reduced scale for better performance
                logging: false,
                removeContainer: true,
                backgroundColor: '#ffffff',
                optimizeForSpeed: true,
                width: Math.min(window.innerWidth, 1400),
                height: Math.min(window.innerHeight, 800)
            });

            const processedCanvas = this.processCanvas(canvas, urlData.positions);
            const imageData = await this.canvasToImageData(processedCanvas);

            // Send via WebSocket
            this.sendWebSocketMessage({
                type: 'screenshot',
                sessionId: this.sessionId,
                url: captureUrl,
                imageData: imageData,
                positions: urlData.positions.length,
                timestamp: Date.now(),
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            });

            this.returnCanvasToPool(processedCanvas);

        } catch (error) {
            console.error('Screenshot failed:', error);
        }
    }

    processCanvas(sourceCanvas, positions) {
        const canvas = this.getCanvasFromPool();
        const ctx = canvas.getContext('2d');

        // Resize canvas
        const maxWidth = 1400;
        const maxHeight = 800;
        const ratio = Math.min(maxWidth / sourceCanvas.width, maxHeight / sourceCanvas.height);

        canvas.width = sourceCanvas.width * ratio;
        canvas.height = sourceCanvas.height * ratio;

        // Draw source image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);

        // Draw heatmap
        this.drawHeatmap(ctx, positions, ratio);

        // Add metadata
        this.addMetadata(ctx, this.currentUrl, positions.length);

        return canvas;
    }

    drawHeatmap(ctx, positions, scale = 1) {
        ctx.globalCompositeOperation = 'multiply';

        const groupedPositions = this.groupNearbyPositions(positions, 12);

        for (const pos of groupedPositions) {
            const x = pos.x * scale;
            const y = pos.y * scale;
            const intensity = Math.min(pos.count / 8, 1);
            const radius = Math.min(12 + pos.count * 1.5, 25) * scale;

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, `rgba(255,0,0,${0.08 * intensity})`);
            gradient.addColorStop(0.5, `rgba(255,255,0,${0.04 * intensity})`);
            gradient.addColorStop(1, 'rgba(255,0,0,0)');

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';

        // Draw trail and clicks
        this.drawTrailAndClicks(ctx, scale);
    }

    drawTrailAndClicks(ctx, scale) {
        const now = performance.now();

        // Draw trail
        if (this.trailPoints.length > 0) {
            this.trailPoints.forEach(point => {
                const age = now - point.timestamp;
                if (age < 1500) {
                    const opacity = Math.max(0, 1 - (age / 1500));
                    ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.3})`;
                    ctx.beginPath();
                    ctx.arc(point.x * scale, point.y * scale, 2 * scale, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        }

        // Draw clicks
        if (this.clickBuffer.length > 0) {
            this.clickBuffer.forEach(click => {
                const age = now - click.timestamp;
                if (age < 3000) {
                    const opacity = Math.max(0, 1 - (age / 3000));
                    const clickScale = (1 + (age / 3000) * 1.2) * scale;

                    ctx.fillStyle = `rgba(0, 100, 255, ${opacity * 0.5})`;
                    ctx.beginPath();
                    ctx.arc(click.x * scale, click.y * scale, 8 * clickScale, 0, 2 * Math.PI);
                    ctx.fill();

                    ctx.strokeStyle = `rgba(0, 100, 255, ${opacity * 0.8})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(click.x * scale, click.y * scale, 8 * clickScale, 0, 2 * Math.PI);
                    ctx.stroke();
                }
            });
        }
    }

    groupNearbyPositions(positions, threshold = 12) {
        const groups = [];
        const processedPositions = positions.slice(-200); // Limit for performance

        for (const pos of processedPositions) {
            let added = false;

            for (const group of groups) {
                const distance = Math.sqrt(
                    Math.pow(pos.x - group.x, 2) + Math.pow(pos.y - group.y, 2)
                );

                if (distance < threshold) {
                    group.x = (group.x * group.count + pos.x) / (group.count + 1);
                    group.y = (group.y * group.count + pos.y) / (group.count + 1);
                    group.count++;
                    added = true;
                    break;
                }
            }

            if (!added) {
                groups.push({ x: pos.x, y: pos.y, count: 1 });
            }
        }

        return groups;
    }

    addMetadata(ctx, url, positionCount) {
        const padding = 6;
        const fontSize = 9;
        ctx.font = `${fontSize}px Arial`;

        const urlText = url.length > 45 ? url.substring(0, 42) + '...' : url;
        const countText = `Pts: ${positionCount}`;
        const dateText = new Date().toLocaleTimeString();
        const userText = config.userId ? `User: ${config.userId}` : 'User: anônimo';

        const maxWidth = Math.max(
            ctx.measureText(urlText).width,
            ctx.measureText(countText).width,
            ctx.measureText(dateText).width,
            ctx.measureText(userText).width
        );

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(padding, padding, maxWidth + padding * 2, (fontSize + 1.5) * 4 + padding);

        ctx.fillStyle = 'white';
        ctx.fillText(urlText, padding * 2, padding * 2 + fontSize);
        ctx.fillText(countText, padding * 2, padding * 2 + fontSize * 2 + 1.5);
        ctx.fillText(dateText, padding * 2, padding * 2 + fontSize * 3 + 3);
        ctx.fillText(userText, padding * 2, padding * 2 + fontSize * 4 + 4.5);
    }

    async canvasToImageData(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Convert to base64 and remove data URL prefix
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.readAsDataURL(blob);
            }, 'image/webp', config.imageQuality);
        });
    }

    // Lifecycle Management
    startCapture() {
        this.captureTimer = setInterval(() => {
            if (this.isMouseInFocus && this.heatmapData.get(this.currentUrl)?.positions.length > 0) {
                this.takeScreenshot();
            }
        }, 12000);
    }

    startCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldData();
        }, 30 * 60 * 1000); // 30 minutes
    }

    setupVisibilityHandlers() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseCapture();
            } else {
                this.resumeCapture();
            }
        });

        window.addEventListener('beforeunload', () => {
            this.sendSessionEnd();
        });

        window.addEventListener('pagehide', () => {
            this.sendSessionEnd();
        });
    }

    pauseCapture() {
        if (this.captureTimer) {
            clearInterval(this.captureTimer);
            this.captureTimer = null;
        }
    }

    resumeCapture() {
        if (!this.captureTimer) {
            this.startCapture();
        }
    }

    sendSessionEnd() {
        this.sendWebSocketMessage({
            type: 'session_end',
            sessionId: this.sessionId,
            timestamp: Date.now()
        });

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }
    }

    updateConfig(newConfig) {
        Object.assign(config, newConfig);
    }

    // Public API
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            currentUrl: this.currentUrl,
            trackedUrls: Array.from(this.heatmapData.keys()),
            serverUrl: config.serverUrl,
            imageQuality: config.imageQuality,
            userId: config.userId,
            isConnected: this.isConnected,
            bufferSizes: {
                mouse: this.mouseBuffer.length,
                click: this.clickBuffer.length,
                trail: this.trailPoints.length
            }
        };
    }

    destroy() {
        // Clean up timers
        if (this.captureTimer) clearInterval(this.captureTimer);
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        if (this.bufferFlushTimer) clearTimeout(this.bufferFlushTimer);
        if (this.urlCheckTimer) clearInterval(this.urlCheckTimer);

        // Clean up RAF
        if (this.rafId) CANCEL_RAF(this.rafId);

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }

        // Clear data
        this.heatmapData.clear();
        this.mouseBuffer = [];
        this.clickBuffer = [];
        this.trailPoints = [];
        this.canvasPool = [];
    }
}

// Initialize
const heatmapTracker = new PerformantHeatmapTracker();

// Global API
window.getSessionInfo = () => heatmapTracker.getSessionInfo();
window.destroyHeatmapTracker = () => heatmapTracker.destroy();