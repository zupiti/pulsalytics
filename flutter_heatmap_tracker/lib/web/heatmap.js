const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3002',
    interval: 2000, // 2 segundos parametrizado
    socketDelay: 100, // 100ms de intervalo entre envios
    urlCheckInterval: 500, // 500ms para verificar mudança de URL
    userId: null,
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
        this.isMouseInFocus = true; // Iniciar como true para capturar cliques imediatamente
        this.interval = null;
        this.urlCheckInterval = null;

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startTracking();
        this.startUrlMonitoring();

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
        // Mouse move
        document.addEventListener('mousemove', (e) => {
            if (this.isMouseInFocus) {
                this.mousePositions.push({
                    x: e.clientX,
                    y: e.clientY,
                    timestamp: Date.now()
                });
            }
        }, { passive: true });

        // CORREÇÃO PRINCIPAL: Usar apenas um event listener para cliques
        // Usar capture: true para garantir que o evento seja capturado
        document.addEventListener('click', (e) => {
            this.captureClick(e, 'click');
        }, { capture: true, passive: true });

        // Backup com mousedown para casos especiais
        document.addEventListener('mousedown', (e) => {
            // Só capturar se não for um clique normal (botão direito, etc.)
            if (e.button !== 0) {
                this.captureClick(e, 'mousedown');
            }
        }, { capture: true, passive: true });

        // Touch events para dispositivos móveis
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                this.captureClick({
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    target: e.target,
                    button: 0
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

    // Método separado para capturar cliques
    captureClick(event, eventType) {
        const clickData = {
            x: event.clientX,
            y: event.clientY,
            timestamp: Date.now(),
            button: event.button || 0,
            target: event.target ? event.target.tagName : 'UNKNOWN',
            type: eventType
        };

        this.clickPoints.push(clickData);

        // Log detalhado para debug
        console.log('Click capturado:', clickData);
        console.log('Total de clicks:', this.clickPoints.length);
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

    checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== this.currentUrl) {
            // URL mudou, resetar dados
            console.log('URL mudou de', this.currentUrl, 'para', currentUrl);
            this.resetTrackingData();
            this.currentUrl = currentUrl;
            this.url = currentUrl;
        }
    }

    resetTrackingData() {
        const oldClicksCount = this.clickPoints.length;
        this.mousePositions = [];
        this.clickPoints = [];
        console.log('Dados resetados devido à mudança de URL. Clicks resetados:', oldClicksCount);
    }

    // Converter canvas para blob
    async canvasToBlob(canvas) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/webp', 0.7);
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

            // Sempre enviar dados se houver atividade
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
                clicksData: clicksToSend
            });

            // Capturar screenshot quando há atividade
            let screenshot = null;
            try {
                const canvas = await html2canvas(document.body, {
                    scale: 0.3,
                    logging: false,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    width: Math.min(window.innerWidth, 800),
                    height: Math.min(window.innerHeight, 600)
                });

                screenshot = await this.canvasToBlob(canvas);
                console.log('Screenshot capturado:', screenshot ? screenshot.size : 'falhou');
            } catch (error) {
                console.warn('Erro ao capturar screenshot:', error);
            }

            // Primeiro enviar metadados com delay
            const metadata = {
                type: 'heatmap_metadata',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                url: this.url,
                positions: positionsToSend,
                clickPoints: clicksToSend,
                imageSize: screenshot ? screenshot.size : 0,
                imageType: screenshot ? 'image/webp' : null
            };

            console.log('Enviando metadados:', metadata);
            await this.sendWebSocketMessage(metadata);

            // Depois enviar o blob como ArrayBuffer se existir
            if (screenshot) {
                const arrayBuffer = await this.blobToArrayBuffer(screenshot);

                // Aguardar delay antes de enviar imagem
                await new Promise(resolve => setTimeout(resolve, this.config.socketDelay));

                if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(arrayBuffer);
                    console.log('Screenshot enviado');
                }
            }

            // Limpar dados após envio bem-sucedido
            if (this.currentUrl !== this.url) {
                this.mousePositions = [];
                this.clickPoints = [];
            }

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
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Inicializar automaticamente
const heatmapTracker = new HeatmapTracker();

// API global simples
window.HeatmapTracker = {
    destroy: () => heatmapTracker.destroy(),
    getSessionId: () => heatmapTracker.sessionId,
    resetData: () => heatmapTracker.resetTrackingData(),
    getCurrentUrl: () => heatmapTracker.url,
    getStats: () => ({
        mousePositions: heatmapTracker.mousePositions.length,
        clickPoints: heatmapTracker.clickPoints.length,
        isConnected: heatmapTracker.isConnected,
        isMouseInFocus: heatmapTracker.isMouseInFocus
    }),
    // Método para teste manual
    testClick: () => {
        heatmapTracker.captureClick({
            clientX: 100,
            clientY: 100,
            target: { tagName: 'TEST' },
            button: 0
        }, 'manual');
        console.log('Click de teste adicionado');
    }
};