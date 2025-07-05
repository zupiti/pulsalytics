const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3002',
    interval: 2000, // 2 segundos parametrizado
    socketDelay: 100, // 100ms de intervalo entre envios
    urlCheckInterval: 500, // 500ms para verificar mudança de URL
    userId: null,
    clickRetentionTime: 5000, // 5 segundos para manter cliques
    maxMousePositions: 100, // Limite de posições do mouse para evitar overflow
    maxClickPoints: 50, // Limite de cliques para evitar overflow
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

        // Dados simples
        this.mousePositions = [];
        this.clickPoints = [];
        this.isMouseInFocus = true;
        this.interval = null;
        this.urlCheckInterval = null;
        this.cleanupInterval = null;

        // Controle de cliques para evitar duplicação
        this.lastClickTime = 0;
        this.clickDebounceTime = 50; // 50ms para debounce

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startTracking();
        this.startUrlMonitoring();
        this.startCleanup();

        // Log inicial para debug
        console.log('HeatmapTracker iniciado', {
            sessionId: this.sessionId,
            url: this.url,
            isMouseInFocus: this.isMouseInFocus
        });
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.config.serverUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                console.log('WebSocket conectado');
                this.sendQueuedMessages();
            };

            this.ws.onmessage = (event) => {
                // Processar mensagens do servidor se necessário
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                console.log('WebSocket desconectado');
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                this.isConnected = false;
                console.error('Erro no WebSocket:', error);
            };

        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        setTimeout(() => this.connectWebSocket(), 2000);
    }

    async sendWebSocketMessage(data) {
        // Implementar delay entre envios
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
        // Mouse move com throttling
        let mouseThrottle = null;
        document.addEventListener('mousemove', (e) => {
            if (!this.isMouseInFocus) return;

            if (mouseThrottle) return;
            mouseThrottle = setTimeout(() => {
                mouseThrottle = null;
            }, 16); // ~60fps

            this.mousePositions.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            });

            // Limitar array de posições do mouse
            if (this.mousePositions.length > this.config.maxMousePositions) {
                this.mousePositions = this.mousePositions.slice(-this.config.maxMousePositions);
            }
        }, { passive: true });

        // CLICK TRACKING CONSOLIDADO
        // Usar apenas um event listener principal para cliques
        document.addEventListener('click', (e) => {
            this.handleClick(e, 'click');
        }, { capture: true, passive: true });

        // Backup para contexto (botão direito)
        document.addEventListener('contextmenu', (e) => {
            this.handleClick(e, 'contextmenu');
        }, { capture: true, passive: true });

        // Touch events para dispositivos móveis
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

        // Focus events - simplificados
        window.addEventListener('focus', () => {
            this.isMouseInFocus = true;
            console.log('Window focus - mouse tracking ativado');
        });

        window.addEventListener('blur', () => {
            this.isMouseInFocus = false;
            console.log('Window blur - mouse tracking desativado');
        });

        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            this.isMouseInFocus = !document.hidden;
            console.log('Visibility change - mouse tracking:', this.isMouseInFocus);
        });
    }

    // Método consolidado para lidar com cliques
    handleClick(event, eventType) {
        const now = Date.now();

        // Debounce para evitar cliques duplicados
        if (now - this.lastClickTime < this.clickDebounceTime) {
            return;
        }
        this.lastClickTime = now;

        // Obter informações do elemento clicado
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

        // Limitar array de cliques
        if (this.clickPoints.length > this.config.maxClickPoints) {
            this.clickPoints = this.clickPoints.slice(-this.config.maxClickPoints);
        }

        // Log detalhado para debug
        console.log('Click capturado:', clickData);
        console.log('Total de clicks:', this.clickPoints.length);
    }

    // Obter informações do elemento clicado
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
        // Limpar dados antigos periodicamente
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldData();
        }, this.config.clickRetentionTime);
    }

    cleanupOldData() {
        const now = Date.now();
        const oldClickCount = this.clickPoints.length;

        // Remover cliques antigos
        this.clickPoints = this.clickPoints.filter(
            click => now - click.timestamp < this.config.clickRetentionTime
        );

        if (oldClickCount !== this.clickPoints.length) {
            console.log(`Limpeza: ${oldClickCount - this.clickPoints.length} cliques antigos removidos`);
        }
    }

    checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== this.currentUrl) {
            console.log('URL mudou de', this.currentUrl, 'para', currentUrl);
            this.resetTrackingData();
            this.currentUrl = currentUrl;
            this.url = currentUrl;
        }
    }

    resetTrackingData() {
        const oldClicksCount = this.clickPoints.length;
        const oldMouseCount = this.mousePositions.length;

        this.mousePositions = [];
        this.clickPoints = [];

        console.log('Dados resetados devido à mudança de URL', {
            clicksResetados: oldClicksCount,
            mousePositionsResetadas: oldMouseCount
        });
    }

    // Converter canvas para blob com baixa qualidade
    async canvasToBlob(canvas) {
        return new Promise((resolve) => {
            // Usar qualidade muito baixa para WebP (0.1 = 10% de qualidade)
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/webp', 0.1);
        });
    }

    // Converter blob para ArrayBuffer
    async blobToArrayBuffer(blob) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsArrayBuffer(blob);
        });
    }

    // Converter ArrayBuffer para base64
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
            // Verificar se há atividade para enviar
            const hasMouseActivity = this.mousePositions.length > 0;
            const hasClickActivity = this.clickPoints.length > 0;
            const hasActivity = hasMouseActivity || hasClickActivity;

            // Log detalhado para debug
            console.log('Verificando atividade:', {
                mousePositions: this.mousePositions.length,
                clickPoints: this.clickPoints.length,
                hasActivity: hasActivity,
                isMouseInFocus: this.isMouseInFocus,
                isConnected: this.isConnected
            });

            if (!hasActivity) {
                console.log('Nenhuma atividade detectada, pulando envio');
                return;
            }

            // Criar cópia dos dados antes de enviar
            const positionsToSend = [...this.mousePositions];
            const clicksToSend = [...this.clickPoints];

            console.log('Preparando para enviar:', {
                positions: positionsToSend.length,
                clicks: clicksToSend.length,
                clicksDetalhados: clicksToSend.map(c => ({
                    x: c.x,
                    y: c.y,
                    type: c.type,
                    target: c.target,
                    timestamp: c.timestamp
                }))
            });

            // Capturar screenshot quando há atividade
            let screenshot = null;
            try {
                // Configuração corrigida: tamanho real da página, baixa qualidade
                const canvas = await html2canvas(document.body, {
                    scale: 1, // Tamanho real (não reduzir)
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    // Remover limitações de width/height para capturar tamanho real
                    width: window.innerWidth,
                    height: Math.max(
                        document.body.scrollHeight,
                        document.body.offsetHeight,
                        document.documentElement.clientHeight,
                        document.documentElement.scrollHeight,
                        document.documentElement.offsetHeight
                    ),
                    // Configurações para otimizar performance
                    timeout: 5000,
                    removeContainer: true,
                    imageTimeout: 2000,
                    // Configurações de qualidade
                    quality: 0.1,
                    pixelRatio: 1
                });

                screenshot = await this.canvasToBlob(canvas);
                console.log('Screenshot capturado:', {
                    size: screenshot ? `${(screenshot.size / 1024).toFixed(2)} KB` : 'falhou',
                    dimensions: `${canvas.width}x${canvas.height}`,
                    viewport: `${window.innerWidth}x${window.innerHeight}`
                });
            } catch (error) {
                console.warn('Erro ao capturar screenshot:', error);
            }

            // Enviar metadados
            const metadata = {
                type: 'heatmap_metadata',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                url: this.url,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                // Adicionar informações sobre o scroll da página
                scroll: {
                    x: window.pageXOffset || document.documentElement.scrollLeft,
                    y: window.pageYOffset || document.documentElement.scrollTop
                },
                // Adicionar dimensões reais da página
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

            console.log('Enviando metadados:', metadata);
            await this.sendWebSocketMessage(metadata);

            // Enviar screenshot se existir
            if (screenshot) {
                const arrayBuffer = await this.blobToArrayBuffer(screenshot);
                await new Promise(resolve => setTimeout(resolve, this.config.socketDelay));

                if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(arrayBuffer);
                    console.log('Screenshot enviado');
                }
            }

            // Limpar dados após envio bem-sucedido
            this.mousePositions = [];
            this.clickPoints = [];

            console.log('Dados enviados e limpos com sucesso');

        } catch (error) {
            console.error('Erro ao enviar dados:', error);
        }
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

// Inicializar automaticamente
const heatmapTracker = new HeatmapTracker();

// API global melhorada
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

    // Método para teste manual
    testClick: (x = 100, y = 100) => {
        heatmapTracker.handleClick({
            clientX: x,
            clientY: y,
            target: { tagName: 'TEST', id: 'test', className: 'test' },
            button: 0
        }, 'manual');
        console.log('Click de teste adicionado em:', { x, y });
    },

    // Método para forçar envio de dados
    forceSend: () => {
        heatmapTracker.sendData();
        console.log('Envio forçado de dados');
    },

    // Método para obter dados atuais
    getCurrentData: () => ({
        mousePositions: heatmapTracker.mousePositions,
        clickPoints: heatmapTracker.clickPoints,
        timestamp: Date.now()
    })
};