const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3002',
    interval: 2000, // 2 segundos parametrizado
    imageInterval: 5000, // 5 segundos para imagens (delay)
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

        // Dados persistentes em memória
        this.mousePositions = [];
        this.clickPoints = [];
        this.allPositions = []; // Buffer persistente de todas as posições
        this.allClicks = []; // Buffer persistente de todos os cliques
        this.isMouseInFocus = false;
        this.interval = null;
        this.imageInterval = null;
        this.lastImageSent = 0;

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
        // Mouse move - capturar sempre, não apenas quando em foco
        document.addEventListener('mousemove', (e) => {
            const position = {
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            };

            // Adicionar ao buffer atual
            this.mousePositions.push(position);

            // Adicionar ao buffer persistente
            this.allPositions.push(position);

            // Limitar buffer persistente a 1000 posições
            if (this.allPositions.length > 1000) {
                this.allPositions.shift();
            }
        });

        // Mouse click - sempre capturar
        document.addEventListener('click', (e) => {
            const click = {
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            };

            // Adicionar ao buffer atual
            this.clickPoints.push(click);

            // Adicionar ao buffer persistente
            this.allClicks.push(click);

            // Limitar buffer persistente a 100 cliques
            if (this.allClicks.length > 100) {
                this.allClicks.shift();
            }
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
        // Envio de dados (sem imagem) a cada 2 segundos
        this.interval = setInterval(() => {
            this.sendDataOnly();
        }, this.config.interval);

        // Envio de imagem a cada 5 segundos (com delay)
        this.imageInterval = setInterval(() => {
            this.sendDataWithImage();
        }, this.config.imageInterval);
    }

    // Enviar apenas dados sem imagem (mais frequente)
    async sendDataOnly() {
        try {
            // Sempre enviar dados se houver atividade
            const hasActivity = this.mousePositions.length > 0 || this.clickPoints.length > 0;

            if (!hasActivity) {
                return; // Não enviar se não há atividade
            }

            // Enviar metadados sem imagem
            const metadata = {
                type: 'heatmap_metadata',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                url: this.url,
                positions: [...this.allPositions], // Enviar buffer persistente
                clickPoints: [...this.allClicks], // Enviar buffer persistente
                imageSize: 0,
                imageType: 'none'
            };

            this.sendWebSocketMessage(metadata);

            // Limpar apenas buffers temporários, manter persistentes
            this.mousePositions = [];
            this.clickPoints = [];

        } catch (error) {
            console.error('Erro ao enviar dados:', error);
        }
    }

    // Enviar dados com imagem (menos frequente)
    async sendDataWithImage() {
        try {
            // Só capturar imagem se houver atividade recent
            const hasRecentActivity = this.allPositions.length > 0 || this.allClicks.length > 0;

            if (!hasRecentActivity) {
                return;
            }

            const now = Date.now();
            // Verificar se passou tempo suficiente desde a última imagem
            if (now - this.lastImageSent < this.config.imageInterval) {
                return;
            }

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

                // Converter para blob
                const blob = await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/webp', 0.7);
                });

                // Enviar metadados com imagem
                const metadata = {
                    type: 'heatmap_metadata',
                    sessionId: this.sessionId,
                    timestamp: now,
                    url: this.url,
                    positions: [...this.allPositions], // Sempre enviar buffer persistente
                    clickPoints: [...this.allClicks], // Sempre enviar buffer persistente
                    imageSize: blob.size,
                    imageType: 'image/webp'
                };

                this.sendWebSocketMessage(metadata);

                // Enviar o blob como ArrayBuffer
                const arrayBuffer = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsArrayBuffer(blob);
                });

                if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(arrayBuffer);
                }

                this.lastImageSent = now;

            } catch (error) {
                console.error('Erro ao capturar imagem:', error);
                // Mesmo sem imagem, enviar os dados
                this.sendDataOnly();
            }

        } catch (error) {
            console.error('Erro ao enviar dados com imagem:', error);
        }
    }

    destroy() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        if (this.imageInterval) {
            clearInterval(this.imageInterval);
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
    getPositions: () => heatmapTracker.allPositions,
    getClicks: () => heatmapTracker.allClicks
};
