const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3002',
    imageQuality: 0.8,
    userId: null,
    batchSize: 20,
    maxBufferSize: 100,
    throttleMs: 16, // ~60fps
    mouseDataInterval: 10000,
    // Novas configurações de segurança
    blurSensitiveText: true,
    blurIntensity: 8,
    sensitiveSelectors: [
        'input[type="password"]',
        'input[type="email"]',
        'input[type="tel"]',
        'input[name*="phone"]',
        'input[name*="email"]',
        'input[name*="cpf"]',
        'input[name*="cnpj"]',
        'input[name*="card"]',
        'input[name*="credit"]',
        'input[name*="bank"]',
        'input[name*="account"]',
        '.sensitive-text',
        '.blur-content',
        '[data-sensitive]',
        'input[data-blur]',
        'textarea[data-blur]',
        '.credit-card',
        '.bank-info',
        '.personal-info'
    ]
};

// Performance optimizations
const RAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
const CANCEL_RAF = window.cancelAnimationFrame || window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame;

class PerformantHeatmapTracker {
    // NOVA LÓGICA IMPLEMENTADA:
    // - Só envia dados para o socket se houver imagem disponível
    // - Se não houver imagem, gera uma imagem primeiro antes de enviar
    // - Verifica se há imagem recente antes de cada envio
    // - Força geração de screenshot quando necessário

    constructor(customConfig = {}) {
        // Merge custom config with defaults
        this.config = { ...config, ...customConfig };

        this.heatmapData = new Map();
        this.currentUrl = window.location.href;
        this.lastCapturedUrl = this.currentUrl;
        this.sessionId = this.getSessionId();

        // Optimized buffers
        this.mouseBuffer = [];
        this.clickBuffer = [];
        this.trailPoints = [];
        this.accumulatedMouseData = [];

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
        this.mouseDataTimer = null;

        // Canvas optimization
        this.canvasPool = [];
        this.maxCanvasPool = 3;

        // Blur elements cache
        this.blurElementsCache = new WeakMap();

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.initializeUrlData(this.currentUrl);
        this.setupEventListeners();
        this.startCapture();
        this.startCleanup();
        this.setupVisibilityHandlers();
        this.startMouseDataTimer();
    }

    // WebSocket Management
    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.config.serverUrl);

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

    // Função utilitária para verificar se há imagem disponível
    hasRecentImage(timeLimit = 2000) {
        const now = Date.now();
        return this.lastScreenshotTime &&
            (now - this.lastScreenshotTime < timeLimit);
    }

    // Nova função que SEMPRE envia screenshot junto com dados
    async sendWithScreenshot(data, forceScreenshot = false) {
        console.log(`📤 Verificando se há imagem para enviar dados do tipo: ${data.type}`);

        // Tipos que não precisam de screenshot
        const skipScreenshotTypes = ['pong', 'ack'];

        // Verificar se precisa de screenshot
        if (skipScreenshotTypes.includes(data.type) && !forceScreenshot) {
            console.log(`📤 Enviando dados sem screenshot: ${data.type}`);
            this.sendWebSocketMessage(data);
            return;
        }

        // Verificar se já existe imagem recente
        if (this.hasRecentImage(1000) && !forceScreenshot) {
            console.log(`📤 Usando imagem recente para enviar dados: ${data.type}`);
            this.sendWebSocketMessage(data);
            return;
        }

        // NÃO há imagem ou é muito antiga - GERAR IMAGEM PRIMEIRO
        console.log(`📸 Não há imagem disponível, gerando imagem antes de enviar dados: ${data.type}`);

        try {
            const now = Date.now();
            this.lastScreenshotTime = now;

            // Capturar screenshot de forma mais rápida
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                scale: 0.3, // Menor para performance
                logging: false,
                removeContainer: true,
                backgroundColor: '#ffffff',
                width: Math.min(window.innerWidth, 800),
                height: Math.min(window.innerHeight, 600),
                timeout: 3000, // 3 segundos
            });

            console.log(`📸 Canvas capturado: ${canvas.width}x${canvas.height}`);

            const processedCanvas = this.processCanvas(canvas, this.heatmapData.get(this.currentUrl)?.positions || []);
            const imageData = await this.canvasToImageData(processedCanvas);

            console.log(`📸 Imagem gerada: ${(imageData.length / 1024).toFixed(2)} KB`);

            // Enviar screenshot primeiro
            const screenshotData = {
                type: 'screenshot',
                sessionId: this.sessionId,
                url: this.currentUrl,
                imageData: imageData,
                timestamp: Date.now(),
                associatedData: data.type, // Informar que tipo de dados originou o screenshot
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };

            this.sendWebSocketMessage(screenshotData);
            this.returnCanvasToPool(processedCanvas);

            console.log(`📸 Imagem enviada, agora enviando dados: ${data.type}`);

            // Agora que temos imagem, enviar dados originais
            this.sendWebSocketMessage(data);

        } catch (error) {
            console.error('📸 Erro ao gerar imagem:', error);

            // Se não conseguir gerar imagem, NÃO enviar dados
            console.log(`❌ Não foi possível gerar imagem, NÃO enviando dados: ${data.type}`);
            return;
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
                this.sendWithScreenshot({ type: 'pong', timestamp: Date.now() });
                break;
        }
    }

    // Session Management
    getSessionId() {
        let sessionId = sessionStorage.getItem('heatmapSessionId');
        if (!sessionId) {
            // Gera um UUID v4 para a sessão
            sessionId = this.generateUUIDv4();
            sessionStorage.setItem('heatmapSessionId', sessionId);
        }
        return sessionId;
    }

    // Função para gerar UUID v4
    generateUUIDv4() {
        // https://stackoverflow.com/a/2117523/2715716
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    createSafeFilename(url) {
        return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50).replace(/_+/g, '_').replace(/^_|_$/g, '');
    }

    sendSessionStart() {
        console.log(`📤 Iniciando sessão - gerando imagem primeiro`);

        // Sempre gerar imagem para início de sessão
        this.sendWithScreenshot({
            type: 'session_start',
            sessionId: this.sessionId,
            userId: this.config.userId,
            url: this.currentUrl,
            timestamp: Date.now(),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            config: {
                imageQuality: this.config.imageQuality,
                blurSensitiveText: this.config.blurSensitiveText
            }
        }, true); // forceScreenshot = true para garantir que sempre tenha imagem
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
        document.addEventListener('mousemove', this.throttle(this.handleMouseMove.bind(this), this.config.throttleMs));
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
            id: this.generateUUIDv4()
        });

        // Keep trail size optimal
        if (this.trailPoints.length > 20) {
            this.trailPoints = this.trailPoints.slice(-15);
        }

        // Acumular dados de mouse localmente (não enviar imediatamente)
        this.accumulatedMouseData.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now
        });

        // Manter tamanho do buffer otimizado
        if (this.accumulatedMouseData.length > this.config.maxBufferSize) {
            this.accumulatedMouseData = this.accumulatedMouseData.slice(-Math.floor(this.config.maxBufferSize * 0.75));
        }

        // Buffer mouse data for heatmap processing
        this.mouseBuffer.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now
        });

        // Keep buffer size optimal for heatmap
        if (this.mouseBuffer.length > this.config.batchSize) {
            this.mouseBuffer = this.mouseBuffer.slice(-this.config.batchSize);
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
            id: this.generateUUIDv4()
        });

        // Keep click buffer size optimal
        if (this.clickBuffer.length > 10) {
            this.clickBuffer = this.clickBuffer.slice(-8);
        }

        // Send click data immediately (screenshot será capturado automaticamente)
        this.sendClickData();
    }

    sendClickData() {
        if (this.clickBuffer.length === 0) return;

        console.log(`📤 Verificando se há imagem para enviar dados de clique`);

        if (this.hasRecentImage(2000)) {
            console.log(`📤 Há imagem recente, enviando dados de clique`);

            this.sendWebSocketMessage({
                type: 'click_data',
                sessionId: this.sessionId,
                url: this.currentUrl,
                clicks: [...this.clickBuffer],
                timestamp: Date.now()
            });
        } else {
            console.log(`📸 Não há imagem disponível, gerando imagem primeiro para dados de clique`);

            // Usar sendWithScreenshot para gerar imagem primeiro
            this.sendWithScreenshot({
                type: 'click_data',
                sessionId: this.sessionId,
                url: this.currentUrl,
                clicks: [...this.clickBuffer],
                timestamp: Date.now()
            }, true); // forceScreenshot = true
        }
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
        if (data.positions.length > this.config.maxBufferSize) {
            data.positions = data.positions.slice(-Math.floor(this.config.maxBufferSize * 0.75));
        }

        data.timestamp = Date.now();

        // Não enviar dados de mouse aqui - será enviado pelo timer
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
            this.sendWithScreenshot({
                type: 'url_change',
                sessionId: this.sessionId,
                oldUrl: this.lastCapturedUrl,
                newUrl: this.currentUrl,
                timestamp: Date.now()
            });
        }
    }

    // Blur Security Functions
    findSensitiveElements() {
        const sensitiveElements = [];

        this.config.sensitiveSelectors.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (this.isElementVisible(element)) {
                        sensitiveElements.push(element);
                    }
                });
            } catch (error) {
                console.warn(`Invalid selector: ${selector}`, error);
            }
        });

        return sensitiveElements;
    }

    isElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            style.opacity !== '0'
        );
    }

    getElementBounds(element) {
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
        };
    }

    applySensitiveElementBlur(canvas, ctx, scale = 1) {
        if (!this.config.blurSensitiveText) return;

        const sensitiveElements = this.findSensitiveElements();

        sensitiveElements.forEach(element => {
            const bounds = this.getElementBounds(element);

            // Adjust bounds for canvas scale
            const scaledBounds = {
                x: bounds.x * scale,
                y: bounds.y * scale,
                width: bounds.width * scale,
                height: bounds.height * scale
            };

            // Apply blur effect
            this.blurCanvasArea(ctx, scaledBounds);
        });
    }

    blurCanvasArea(ctx, bounds) {
        const { x, y, width, height } = bounds;

        // Create a temporary canvas for the blur effect
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = width;
        tempCanvas.height = height;

        // Copy the area to be blurred
        const imageData = ctx.getImageData(x, y, width, height);
        tempCtx.putImageData(imageData, 0, 0);

        // Apply blur using CSS filter (if supported)
        if (tempCtx.filter !== undefined) {
            tempCtx.filter = `blur(${this.config.blurIntensity}px)`;
            tempCtx.drawImage(tempCanvas, 0, 0);
        } else {
            // Fallback: Apply pixelation effect
            this.pixelateImageData(tempCtx, width, height);
        }

        // Draw the blurred area back to the main canvas
        ctx.drawImage(tempCanvas, x, y);

        // Add a visual indicator (optional)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x, y, width, height);

        // Add border to indicate blurred area
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    }

    pixelateImageData(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const pixelSize = Math.max(2, Math.floor(this.config.blurIntensity / 2));

        for (let y = 0; y < height; y += pixelSize) {
            for (let x = 0; x < width; x += pixelSize) {
                const pixelIndex = (y * width + x) * 4;

                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                const a = data[pixelIndex + 3];

                // Apply the same color to the entire pixel block
                for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
                    for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
                        const targetIndex = ((y + dy) * width + (x + dx)) * 4;
                        data[targetIndex] = r;
                        data[targetIndex + 1] = g;
                        data[targetIndex + 2] = b;
                        data[targetIndex + 3] = a;
                    }
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
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

    async canvasToImageData(canvas) {
        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Falha ao criar blob da imagem'));
                        return;
                    }

                    const reader = new FileReader();
                    reader.onloadend = () => {
                        // Convert to base64 and remove data URL prefix
                        const base64 = reader.result.split(',')[1];
                        if (!base64) {
                            reject(new Error('Falha ao converter imagem para base64'));
                            return;
                        }
                        resolve(base64);
                    };
                    reader.onerror = () => {
                        reject(new Error('Erro ao ler blob da imagem'));
                    };
                    reader.readAsDataURL(blob);
                }, 'image/webp', this.config.imageQuality);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Lifecycle Management
    startCapture() {
        console.log('🎬 Sistema de captura automática iniciado!');
        console.log('📸 Screenshots serão capturados automaticamente a cada envio de dados');

        // Não precisamos mais dos timers de captura, pois os screenshots
        // são capturados automaticamente junto com os dados

        // Capturar screenshot inicial após delay
        setTimeout(() => {
            this.sendWithScreenshot({
                type: 'initial_screenshot',
                sessionId: this.sessionId,
                url: this.currentUrl,
                timestamp: Date.now()
            });
        }, 2000);
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
        console.log('📸 Captura pausada (screenshots continuarão automáticos com dados)');
        // Não há timers para pausar, pois os screenshots são automáticos
    }

    resumeCapture() {
        console.log('📸 Captura retomada (screenshots automáticos ativos)');
        // Não há timers para retomar, pois os screenshots são automáticos
    }

    sendSessionEnd() {
        console.log(`📤 Finalizando sessão - verificando se há imagem`);

        if (this.hasRecentImage(5000)) {
            console.log(`📤 Há imagem recente, enviando fim de sessão`);

            this.sendWebSocketMessage({
                type: 'session_end',
                sessionId: this.sessionId,
                userId: this.config.userId,
                url: this.currentUrl,
                timestamp: Date.now()
            });
        } else {
            console.log(`📸 Não há imagem disponível, gerando imagem primeiro para fim de sessão`);

            // Usar sendWithScreenshot para gerar imagem primeiro
            this.sendWithScreenshot({
                type: 'session_end',
                sessionId: this.sessionId,
                userId: this.config.userId,
                url: this.currentUrl,
                timestamp: Date.now()
            }, true); // forceScreenshot = true
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
        }
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);

        // Log configuration changes
        console.log('Heatmap config updated:', {
            imageQuality: this.config.imageQuality,
            blurSensitiveText: this.config.blurSensitiveText,
            blurIntensity: this.config.blurIntensity
        });
    }

    // Public API
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            currentUrl: this.currentUrl,
            trackedUrls: Array.from(this.heatmapData.keys()),
            serverUrl: this.config.serverUrl,
            imageQuality: this.config.imageQuality,
            userId: this.config.userId,
            isConnected: this.isConnected,
            security: {
                blurSensitiveText: this.config.blurSensitiveText,
                blurIntensity: this.config.blurIntensity,
                sensitiveSelectorsCount: this.config.sensitiveSelectors.length
            },
            bufferSizes: {
                mouse: this.mouseBuffer.length,
                click: this.clickBuffer.length,
                trail: this.trailPoints.length,
                accumulatedMouse: this.accumulatedMouseData.length
            },
            timers: {
                mouseDataInterval: this.config.mouseDataInterval,
                captureInterval: 12000
            }
        };
    }

    // Security methods
    addSensitiveSelector(selector) {
        if (!this.config.sensitiveSelectors.includes(selector)) {
            this.config.sensitiveSelectors.push(selector);
            console.log(`Added sensitive selector: ${selector}`);
        }
    }

    removeSensitiveSelector(selector) {
        const index = this.config.sensitiveSelectors.indexOf(selector);
        if (index > -1) {
            this.config.sensitiveSelectors.splice(index, 1);
            console.log(`Removed sensitive selector: ${selector}`);
        }
    }

    setImageQuality(quality) {
        if (quality >= 0.1 && quality <= 1.0) {
            this.config.imageQuality = quality;
            console.log(`Image quality set to: ${quality}`);
        } else {
            console.warn('Image quality must be between 0.1 and 1.0');
        }
    }

    setBlurIntensity(intensity) {
        if (intensity >= 1 && intensity <= 20) {
            this.config.blurIntensity = intensity;
            console.log(`Blur intensity set to: ${intensity}`);
        } else {
            console.warn('Blur intensity must be between 1 and 20');
        }
    }

    toggleBlur(enabled) {
        this.config.blurSensitiveText = enabled;
        console.log(`Blur ${enabled ? 'enabled' : 'disabled'}`);
    }

    destroy() {
        // Clean up timers
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        if (this.bufferFlushTimer) clearTimeout(this.bufferFlushTimer);
        if (this.urlCheckTimer) clearInterval(this.urlCheckTimer);
        if (this.mouseDataTimer) clearInterval(this.mouseDataTimer);

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
        this.accumulatedMouseData = [];
        this.canvasPool = [];
        this.blurElementsCache = new WeakMap();

        console.log('Heatmap tracker destroyed');
    }

    startMouseDataTimer() {
        this.mouseDataTimer = setInterval(() => {
            this.sendAccumulatedMouseData();
        }, this.config.mouseDataInterval); // A cada 10 segundos
    }

    // Nova função para enviar dados de mouse acumulados
    sendAccumulatedMouseData() {
        if (this.accumulatedMouseData.length === 0) return;

        console.log(`📤 Verificando se há imagem para enviar ${this.accumulatedMouseData.length} pontos de mouse acumulados`);

        if (this.hasRecentImage(2000)) {
            console.log(`📤 Há imagem recente, enviando dados de mouse`);

            // Enviar dados de mouse via WebSocket
            this.sendWebSocketMessage({
                type: 'mouse_data',
                sessionId: this.sessionId,
                url: this.currentUrl,
                positions: [...this.accumulatedMouseData],
                timestamp: Date.now()
            });

            // Limpar dados acumulados após envio
            this.accumulatedMouseData = [];
        } else {
            console.log(`📸 Não há imagem disponível, gerando imagem primeiro para dados de mouse`);

            // Usar sendWithScreenshot para gerar imagem primeiro
            this.sendWithScreenshot({
                type: 'mouse_data',
                sessionId: this.sessionId,
                url: this.currentUrl,
                positions: [...this.accumulatedMouseData],
                timestamp: Date.now()
            }, true); // forceScreenshot = true

            // Limpar dados acumulados após envio
            this.accumulatedMouseData = [];
        }
    }

    // Optimized screenshot capture
    async takeScreenshot() {
        const captureUrl = this.currentUrl;
        const urlData = this.heatmapData.get(captureUrl);

        console.log(`📸 Tentando capturar screenshot para: ${captureUrl}`);

        // Verificar se não há captura em andamento
        if (this.capturingScreenshot) {
            console.log('📸 Captura já em andamento, aguardando...');
            return;
        }

        this.capturingScreenshot = true;

        try {
            // Sempre capturar screenshot, mesmo sem dados de mouse
            if (!urlData) {
                console.log('📸 Criando dados de URL para captura...');
                this.initializeUrlData(captureUrl);
            }

            console.log('📸 Capturando screenshot com html2canvas...');

            // Use html2canvas with optimized settings
            const canvas = await html2canvas(document.body, {
                useCORS: true,
                allowTaint: true,
                scale: 0.4, // Reduzida para melhor performance
                logging: false,
                removeContainer: true,
                backgroundColor: '#ffffff',
                width: Math.min(window.innerWidth, 1200), // Reduzido
                height: Math.min(window.innerHeight, 800),
                timeout: 5000, // Timeout de 5 segundos
                onclone: (clonedDoc) => {
                    // Remover elementos problemáticos do clone
                    const scripts = clonedDoc.querySelectorAll('script');
                    scripts.forEach(script => script.remove());
                    const videos = clonedDoc.querySelectorAll('video');
                    videos.forEach(video => video.remove());
                }
            });

            console.log(`📸 Canvas capturado: ${canvas.width}x${canvas.height}`);

            const processedCanvas = this.processCanvas(canvas, urlData?.positions || []);
            const imageData = await this.canvasToImageData(processedCanvas);

            console.log(`📸 Enviando screenshot: ${(imageData.length / 1024).toFixed(2)} KB`);

            // Send via WebSocket with retry mechanism
            this.sendScreenshotWithRetry({
                type: 'screenshot',
                sessionId: this.sessionId,
                url: captureUrl,
                imageData: imageData,
                positions: urlData?.positions?.length || 0,
                timestamp: Date.now(),
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                security: {
                    blurApplied: this.config.blurSensitiveText,
                    blurIntensity: this.config.blurIntensity
                }
            });

            this.returnCanvasToPool(processedCanvas);

            console.log('📸 Screenshot enviado com sucesso!');

        } catch (error) {
            console.error('📸 Erro ao capturar screenshot:', error);

            // Tentar captura mais simples em caso de erro
            this.fallbackScreenshot();
        } finally {
            this.capturingScreenshot = false;
        }
    }

    // Fallback screenshot method
    async fallbackScreenshot() {
        try {
            console.log('📸 Tentando captura fallback...');

            const canvas = await html2canvas(document.body, {
                scale: 0.2, // Escala muito baixa para garantir sucesso
                logging: false,
                backgroundColor: '#ffffff',
                width: 800,
                height: 600
            });

            const imageData = await this.canvasToImageData(canvas);

            this.sendScreenshotWithRetry({
                type: 'screenshot',
                sessionId: this.sessionId,
                url: this.currentUrl,
                imageData: imageData,
                positions: 0,
                timestamp: Date.now(),
                fallback: true
            });

            console.log('📸 Screenshot fallback enviado');
        } catch (error) {
            console.error('📸 Erro na captura fallback:', error);
        }
    }

    // Send screenshot with retry
    sendScreenshotWithRetry(data, retries = 3) {
        const attempt = (attemptNumber) => {
            try {
                this.sendWebSocketMessage(data);
                console.log(`📤 Screenshot enviado (tentativa ${attemptNumber})`);
            } catch (error) {
                console.error(`❌ Erro ao enviar screenshot (tentativa ${attemptNumber}):`, error);

                if (attemptNumber < retries) {
                    setTimeout(() => {
                        attempt(attemptNumber + 1);
                    }, 1000 * attemptNumber); // Delay progressivo
                } else {
                    console.error('❌ Falha ao enviar screenshot após todas as tentativas');
                }
            }
        };

        attempt(1);
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

        // Apply blur to sensitive elements ONLY (NÃO desenhar heatmap, trilha ou cliques)
        this.applySensitiveElementBlur(canvas, ctx, ratio);

        // NÃO desenhar heatmap, trilha ou metadados
        // NÃO chamar: this.drawHeatmap(ctx, positions, ratio);
        // NÃO chamar: this.addMetadata(ctx, this.currentUrl, positions.length);

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
        const userText = this.config.userId ? `User: ${this.config.userId}` : 'User: anônimo';
        const qualityText = `Quality: ${this.config.imageQuality}`;
        const securityText = this.config.blurSensitiveText ? '🔒 Blur: ON' : '🔓 Blur: OFF';

        const maxWidth = Math.max(
            ctx.measureText(urlText).width,
            ctx.measureText(countText).width,
            ctx.measureText(dateText).width,
            ctx.measureText(userText).width,
            ctx.measureText(qualityText).width,
            ctx.measureText(securityText).width
        );

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(padding, padding, maxWidth + padding * 2, (fontSize + 1.5) * 6 + padding);

        ctx.fillStyle = 'white';
        ctx.fillText(urlText, padding * 2, padding * 2 + fontSize);
        ctx.fillText(countText, padding * 2, padding * 2 + fontSize * 2 + 1.5);
        ctx.fillText(dateText, padding * 2, padding * 2 + fontSize * 3 + 3);
        ctx.fillText(userText, padding * 2, padding * 2 + fontSize * 4 + 4.5);
        ctx.fillText(qualityText, padding * 2, padding * 2 + fontSize * 5 + 6);
        ctx.fillText(securityText, padding * 2, padding * 2 + fontSize * 6 + 7.5);
    }
}

// Factory function for creating tracker with custom config
function createHeatmapTracker(customConfig = {}) {
    return new PerformantHeatmapTracker(customConfig);
}

// Initialize with default config
const heatmapTracker = new PerformantHeatmapTracker();

// Global API
window.HeatmapTracker = {
    // Core methods
    getSessionInfo: () => heatmapTracker.getSessionInfo(),
    destroy: () => heatmapTracker.destroy(),

    // Configuration methods
    setImageQuality: (quality) => heatmapTracker.setImageQuality(quality),
    setBlurIntensity: (intensity) => heatmapTracker.setBlurIntensity(intensity),
    toggleBlur: (enabled) => heatmapTracker.toggleBlur(enabled),
    updateConfig: (config) => heatmapTracker.updateConfig(config),

    // Security methods
    addSensitiveSelector: (selector) => heatmapTracker.addSensitiveSelector(selector),
    removeSensitiveSelector: (selector) => heatmapTracker.removeSensitiveSelector(selector),

    // Factory method
    create: createHeatmapTracker,

    // Get current config
    getConfig: () => ({ ...heatmapTracker.config })
};

// Backwards compatibility
window.getSessionInfo = () => heatmapTracker.getSessionInfo();
window.destroyHeatmapTracker = () => heatmapTracker.destroy();
