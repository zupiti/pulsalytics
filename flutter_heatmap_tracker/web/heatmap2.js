const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3002',
    interval: 2000, // 2 segundos parametrizado
    userId: null,
    // Remover todas as outras configurações complexas
};

class HeatmapTracker {
    constructor(customConfig = {}) {
        this.config = { ...config, ...customConfig };
        this.sessionId = this.getSessionId();
        this.url = window.location.href;
        this.ws = null;
        this.isConnected = false;
        this.messageQueue = [];

        // Dados simples
        this.mousePositions = [];
        this.clickPoints = [];
        this.isMouseInFocus = false;
        this.interval = null;

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.startTracking();
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.config.serverUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.sendQueuedMessages();
            };

            this.ws.onmessage = (event) => {
                // Processar mensagens do servidor se necessário
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                this.isConnected = false;
            };

        } catch (error) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        setTimeout(() => this.connectWebSocket(), 2000);
    }

    sendWebSocketMessage(data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            this.messageQueue.push(data);
        }
    }

    sendQueuedMessages() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendWebSocketMessage(message);
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
        });

        // Mouse click
        document.addEventListener('click', (e) => {
            this.clickPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            });
        });

        // Focus events
        window.addEventListener('focus', () => {
            this.isMouseInFocus = true;
        });

        window.addEventListener('blur', () => {
            this.isMouseInFocus = false;
        });

        // Mouse enter/leave
        document.addEventListener('mouseenter', () => {
            this.isMouseInFocus = true;
        });

        document.addEventListener('mouseleave', () => {
            this.isMouseInFocus = false;
        });
    }

    startTracking() {
        this.interval = setInterval(() => {
            this.sendData();
        }, this.config.interval);
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
            // APENAS enviar dados se houver atividade E o usuário tem foco no mouse
            const hasActivity = this.mousePositions.length > 0 || this.clickPoints.length > 0;

            if (!this.isMouseInFocus || !hasActivity) {
                return; // Não enviar se não há atividade ou foco
            }

            // Sempre capturar screenshot quando há atividade
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

                // Converter canvas para blob
                const blob = await this.canvasToBlob(canvas);

                // Primeiro enviar metadados
                const metadata = {
                    type: 'heatmap_metadata',
                    sessionId: this.sessionId,
                    timestamp: Date.now(),
                    url: this.url,
                    positions: [...this.mousePositions],
                    clickPoints: [...this.clickPoints],
                    imageSize: blob.size,
                    imageType: 'image/webp'
                };

                this.sendWebSocketMessage(metadata);

                // Depois enviar o blob como ArrayBuffer
                const arrayBuffer = await this.blobToArrayBuffer(blob);

                if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(arrayBuffer);
                }

            } catch (error) {
                // Se não conseguir capturar imagem, não enviar dados
                return;
            }

            // Limpar dados após envio
            this.mousePositions = [];
            this.clickPoints = [];

        } catch (error) {
            // Em caso de erro, não enviar nada
        }
    }

    destroy() {
        if (this.interval) {
            clearInterval(this.interval);
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
    getSessionId: () => heatmapTracker.sessionId
};
