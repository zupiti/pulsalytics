const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3002',
    interval: 2000,
    socketDelay: 100,
    urlCheckInterval: 500,
    userId: null,
    clickRetentionTime: 5000,
    maxMousePositions: 100,
    maxClickPoints: 50,
};

class HeatmapTracker {
    constructor(customConfig = {}) {
        this.config = { ...config, ...customConfig };
        this.sessionId = this.getSessionId();
        this.url = window.location.href;
        this.currentUrl = this.url;
        this.ws = null;
        this.isConnected = false;
        this.messageQueue = [];
        this.lastSendTime = 0;
        this.mousePositions = [];
        this.clickPoints = [];
        this.isMouseInFocus = true;
        this.interval = null;
        this.urlCheckInterval = null;
        this.cleanupInterval = null;
        this.lastClickTime = 0;
        this.clickDebounceTime = 50;
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startTracking();
        this.startUrlMonitoring();
        this.startCleanup();
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.config.serverUrl);
            this.ws.onopen = () => {
                this.isConnected = true;
                this.sendQueuedMessages();
            };
            this.ws.onmessage = (event) => { };
            this.ws.onclose = () => {
                this.isConnected = false;
                this.scheduleReconnect();
            };
            this.ws.onerror = (error) => {
                this.isConnected = false;
            };
        } catch (error) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        setTimeout(() => this.connectWebSocket(), 2000);
    }

    async sendWebSocketMessage(data) {
        const now = Date.now();
        const timeSinceLastSend = now - this.lastSendTime;
        if (timeSinceLastSend < this.config.socketDelay) {
            await new Promise(resolve => setTimeout(resolve, this.config.socketDelay - timeSinceLastSend));
        }
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            this.lastSendTime = Date.now();
        } else {
            this.messageQueue.push(data);
        }
    }

    async sendQueuedMessages() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            await this.sendWebSocketMessage(message);
        }
    }

    getSessionId() {
        return Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    }

    setupEventListeners() {
        let mouseThrottle = null;
        document.addEventListener('mousemove', (e) => {
            if (!this.isMouseInFocus) return;
            if (mouseThrottle) return;
            mouseThrottle = setTimeout(() => {
                mouseThrottle = null;
            }, 16);
            this.mousePositions.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            });
            if (this.mousePositions.length > this.config.maxMousePositions) {
                this.mousePositions = this.mousePositions.slice(-this.config.maxMousePositions);
            }
        }, { passive: true });
        document.addEventListener('click', (e) => {
            this.handleClick(e, 'click');
        }, { capture: true, passive: true });
        document.addEventListener('contextmenu', (e) => {
            this.handleClick(e, 'contextmenu');
        }, { capture: true, passive: true });
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.handleClick({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    target: e.target,
                    button: 0,
                    type: 'touchstart'
                }, 'touch');
            }
        }, { passive: true });
        window.addEventListener('focus', () => {
            this.isMouseInFocus = true;
        });
        window.addEventListener('blur', () => {
            this.isMouseInFocus = false;
        });
        document.addEventListener('visibilitychange', () => {
            this.isMouseInFocus = !document.hidden;
        });
    }

    handleClick(event, eventType) {
        const now = Date.now();
        if (now - this.lastClickTime < this.clickDebounceTime) {
            return;
        }
        this.lastClickTime = now;
        const targetInfo = this.getTargetInfo(event.target);
        const clickData = {
            x: event.clientX,
            y: event.clientY,
            timestamp: now,
            button: event.button || 0,
            target: targetInfo.tagName,
            targetId: targetInfo.id,
            targetClass: targetInfo.className,
            type: eventType,
            id: Math.random().toString(36).substr(2, 9)
        };
        this.clickPoints.push(clickData);
        if (this.clickPoints.length > this.config.maxClickPoints) {
            this.clickPoints = this.clickPoints.slice(-this.config.maxClickPoints);
        }
    }

    getTargetInfo(target) {
        if (!target) {
            return { tagName: 'UNKNOWN', id: '', className: '' };
        }
        return {
            tagName: target.tagName || 'UNKNOWN',
            id: target.id || '',
            className: target.className || ''
        };
    }

    startTracking() {
        this.interval = setInterval(() => {
            this.sendData();
        }, this.config.interval);
    }

    startUrlMonitoring() {
        this.urlCheckInterval = setInterval(() => {
            this.checkUrlChange();
        }, this.config.urlCheckInterval);
    }

    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldData();
        }, this.config.clickRetentionTime);
    }

    cleanupOldData() {
        const now = Date.now();
        const oldClickCount = this.clickPoints.length;
        this.clickPoints = this.clickPoints.filter(
            click => now - click.timestamp < this.config.clickRetentionTime
        );
    }

    checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== this.currentUrl) {
            this.resetTrackingData();
            this.currentUrl = currentUrl;
            this.url = currentUrl;
        }
    }

    resetTrackingData() {
        this.mousePositions = [];
        this.clickPoints = [];
    }

    async canvasToBlob(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/webp', 0.1);
        });
    }

    async blobToArrayBuffer(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(blob);
        });
    }

    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    async sendData() {
        try {
            const hasMouseActivity = this.mousePositions.length > 0;
            const hasClickActivity = this.clickPoints.length > 0;
            const hasActivity = hasMouseActivity || hasClickActivity;
            if (!hasActivity) {
                return;
            }
            const positionsToSend = [...this.mousePositions];
            const clicksToSend = [...this.clickPoints];
            let screenshot = null;
            try {
                const canvas = await html2canvas(document.body, {
                    scale: 1,
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    width: window.innerWidth,
                    height: Math.max(
                        document.body.scrollHeight,
                        document.body.offsetHeight,
                        document.documentElement.clientHeight,
                        document.documentElement.scrollHeight,
                        document.documentElement.offsetHeight
                    ),
                    timeout: 5000,
                    removeContainer: true,
                    imageTimeout: 2000,
                    quality: 0.1,
                    pixelRatio: 1
                });
                screenshot = await this.canvasToBlob(canvas);
            } catch (error) { }
            const metadata = {
                type: 'heatmap_metadata',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                url: this.url,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                scroll: {
                    x: window.pageXOffset || document.documentElement.scrollLeft,
                    y: window.pageYOffset || document.documentElement.scrollTop
                },
                pageDimensions: {
                    width: Math.max(
                        document.body.scrollWidth,
                        document.body.offsetWidth,
                        document.documentElement.clientWidth,
                        document.documentElement.scrollWidth,
                        document.documentElement.offsetWidth
                    ),
                    height: Math.max(
                        document.body.scrollHeight,
                        document.body.offsetHeight,
                        document.documentElement.clientHeight,
                        document.documentElement.scrollHeight,
                        document.documentElement.offsetHeight
                    )
                },
                positions: positionsToSend,
                clickPoints: clicksToSend,
                imageSize: screenshot ? screenshot.size : 0,
                imageType: screenshot ? 'image/webp' : null
            };
            await this.sendWebSocketMessage(metadata);
            if (screenshot) {
                const arrayBuffer = await this.blobToArrayBuffer(screenshot);
                await new Promise(resolve => setTimeout(resolve, this.config.socketDelay));
                if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(arrayBuffer);
                }
            }
            this.mousePositions = [];
            this.clickPoints = [];
        } catch (error) { }
    }

    destroy() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        if (this.urlCheckInterval) {
            clearInterval(this.urlCheckInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.ws) {
            this.ws.close();
        }
    }
}

const heatmapTracker = new HeatmapTracker();

window.HeatmapTracker = {
    destroy: () => heatmapTracker.destroy(),
    getSessionId: () => heatmapTracker.sessionId,
    resetData: () => heatmapTracker.resetTrackingData(),
    getCurrentUrl: () => heatmapTracker.url,
    getStats: () => ({
        mousePositions: heatmapTracker.mousePositions.length,
        clickPoints: heatmapTracker.clickPoints.length,
        isConnected: heatmapTracker.isConnected,
        isMouseInFocus: heatmapTracker.isMouseInFocus,
        sessionId: heatmapTracker.sessionId,
        url: heatmapTracker.url
    }),
    testClick: (x = 100, y = 100) => {
        heatmapTracker.handleClick({
            clientX: x,
            clientY: y,
            target: { tagName: 'TEST', id: 'test', className: 'test' },
            button: 0
        }, 'manual');
    },
    forceSend: () => {
        heatmapTracker.sendData();
    },
    getCurrentData: () => ({
        mousePositions: heatmapTracker.mousePositions,
        clickPoints: heatmapTracker.clickPoints,
        timestamp: Date.now()
    })
};