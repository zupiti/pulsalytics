// WebSocket Heatmap Client - Versão Otimizada
class HeatmapWebSocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.sessionId = this.getSessionId();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;

        // Configurações dinâmicas do servidor
        this.config = {
            captureInterval: 10000, // Default: 10 segundos
            minMouseMoves: 10,
            qualityMode: 'balanced'
        };

        // Controle de captura
        this.lastCaptureTime = 0;
        this.mouseMovements = [];
        this.pendingCapture = false;
        this.captureQueue = [];

        // Dados do heatmap
        this.heatmapData = {};
        this.currentUrl = window.location.href;

        this.init();
    }

    getSessionId() {
        let sessionId = localStorage.getItem('heatmapSessionId');
        if (!sessionId) {
            const urlBase = this.createSafeFilename(window.location.origin + window.location.pathname);
            sessionId = `${urlBase}_${Math.random().toString(36).substr(2, 6)}_${Date.now()}`;
            localStorage.setItem('heatmapSessionId', sessionId);
        }
        return sessionId;
    }

    createSafeFilename(url) {
        return url
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50)
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    init() {
        this.connect();
        this.setupMouseTracking();
        this.setupPageTracking();

        console.log(`🚀 WebSocket Heatmap Client iniciado`);
        console.log(`📱 Session ID: ${this.sessionId}`);
    }

    connect() {
        try {
            this.ws = new WebSocket('ws://localhost:3002');

            this.ws.onopen = () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                console.log(`✅ WebSocket conectado`);

                // Inicia sessão
                this.send({
                    type: 'session_start',
                    sessionId: this.sessionId,
                    url: this.currentUrl,
                    userAgent: navigator.userAgent,
                    timestamp: Date.now()
                });
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log(`🔌 WebSocket desconectado`);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error(`❌ Erro WebSocket:`, error);
            };

        } catch (error) {
            console.error(`❌ Erro ao conectar WebSocket:`, error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.log(`❌ Máximo de tentativas de reconexão atingido`);
        }
    }

    send(data) {
        if (this.connected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn(`⚠️  WebSocket não conectado, dados não enviados`);
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'config':
                this.config = { ...this.config, ...message };
                console.log(`⚙️  Configuração atualizada:`, this.config);
                break;

            case 'capture_request':
                this.performCapture();
                break;

            case 'upload_success':
                console.log(`✅ Upload bem-sucedido: ${message.filename} (${(message.size / 1024).toFixed(2)} KB)`);
                this.pendingCapture = false;
                break;

            case 'pong':
                // Resposta do ping - conexão ativa
                break;

            default:
                console.log(`📩 Mensagem recebida:`, message);
        }
    }

    setupMouseTracking() {
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();

            // Armazena movimento
            this.mouseMovements.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: now
            });

            // Limita buffer de movimentos (últimos 2 segundos)
            this.mouseMovements = this.mouseMovements.filter(
                movement => now - movement.timestamp < 2000
            );

            // Atualiza dados do heatmap
            this.updateHeatmapData(e.clientX, e.clientY, now);

            // Envia dados periodicamente para o servidor
            this.sendMouseDataThrottled();
        });
    }

    updateHeatmapData(x, y, timestamp) {
        if (!this.heatmapData[this.currentUrl]) {
            this.heatmapData[this.currentUrl] = {
                positions: [],
                timestamp: Date.now()
            };
        }

        this.heatmapData[this.currentUrl].positions.push({ x, y, timestamp });

        // Limita tamanho do buffer
        if (this.heatmapData[this.currentUrl].positions.length > 1000) {
            this.heatmapData[this.currentUrl].positions.shift();
        }
    }

    sendMouseDataThrottled = this.throttle(() => {
        if (this.mouseMovements.length >= this.config.minMouseMoves) {
            this.send({
                type: 'mouse_data',
                sessionId: this.sessionId,
                url: this.currentUrl,
                positions: this.heatmapData[this.currentUrl]?.positions || [],
                movements: this.mouseMovements.slice(-20), // Últimos 20 movimentos
                timestamp: Date.now()
            });
        }
    }, 2000); // Envia no máximo a cada 2 segundos

    async performCapture() {
        if (this.pendingCapture) {
            console.log(`⚠️  Captura já em andamento, ignorando solicitação`);
            return;
        }

        const now = Date.now();
        if (now - this.lastCaptureTime < this.config.captureInterval) {
            console.log(`⚠️  Intervalo mínimo não atingido, aguardando...`);
            return;
        }

        this.pendingCapture = true;
        this.lastCaptureTime = now;

        try {
            console.log(`📸 Iniciando captura...`);

            const positions = this.heatmapData[this.currentUrl]?.positions || [];

            // Configura qualidade baseada no modo
            const quality = this.getQualitySettings();

            const canvas = await html2canvas(document.body, quality.html2canvasOptions);

            const resizedCanvas = this.resizeCanvas(canvas, quality.maxWidth, quality.maxHeight);
            const finalCanvas = this.drawHeatmapOnImage(resizedCanvas, positions);
            this.addUrlInfo(finalCanvas, this.currentUrl, positions.length);

            // Converte para base64
            const imageData = finalCanvas.toDataURL('image/webp', quality.compression);

            // Envia via WebSocket
            this.send({
                type: 'image_data',
                sessionId: this.sessionId,
                imageData: imageData,
                format: 'webp',
                url: this.currentUrl,
                positionCount: positions.length,
                timestamp: now
            });

            console.log(`📤 Imagem enviada via WebSocket (${positions.length} posições)`);

        } catch (error) {
            console.error(`❌ Erro na captura:`, error);
            this.pendingCapture = false;
        }
    }

    getQualitySettings() {
        const settings = {
            low: {
                html2canvasOptions: {
                    scale: 0.3,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    optimizeForSpeed: true
                },
                maxWidth: 1280,
                maxHeight: 720,
                compression: 0.2
            },
            balanced: {
                html2canvasOptions: {
                    scale: 0.5,
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    optimizeForSpeed: true
                },
                maxWidth: 1920,
                maxHeight: 1080,
                compression: 0.3
            },
            high: {
                html2canvasOptions: {
                    scale: 0.8,
                    useCORS: true,
                    allowTaint: true,
                    logging: false
                },
                maxWidth: 2560,
                maxHeight: 1440,
                compression: 0.5
            }
        };

        return settings[this.config.qualityMode] || settings.balanced;
    }

    setupPageTracking() {
        // Detecta mudanças de URL
        let lastUrl = window.location.href;
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                this.currentUrl = currentUrl;

                this.send({
                    type: 'url_change',
                    sessionId: this.sessionId,
                    oldUrl: lastUrl,
                    newUrl: currentUrl,
                    timestamp: Date.now()
                });

                console.log(`🔗 URL alterada para: ${currentUrl}`);
            }
        }, 1000);

        // Detecta fechamento da página
        window.addEventListener('beforeunload', () => {
            this.send({
                type: 'session_end',
                sessionId: this.sessionId,
                timestamp: Date.now()
            });
        });

        // Ping periódico para manter conexão ativa
        setInterval(() => {
            this.send({
                type: 'ping',
                timestamp: Date.now()
            });
        }, 30000); // A cada 30 segundos
    }

    // Utilitários
    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;
        return function (...args) {
            const currentTime = Date.now();

            if (currentTime - lastExecTime > delay) {
                func.apply(this, args);
                lastExecTime = currentTime;
            } else {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    func.apply(this, args);
                    lastExecTime = Date.now();
                }, delay - (currentTime - lastExecTime));
            }
        };
    }

    resizeCanvas(sourceCanvas, maxWidth = 1920, maxHeight = 1080) {
        const ratio = Math.min(maxWidth / sourceCanvas.width, maxHeight / sourceCanvas.height);
        if (ratio >= 1) return sourceCanvas;

        const newCanvas = document.createElement('canvas');
        const ctx = newCanvas.getContext('2d');
        newCanvas.width = sourceCanvas.width * ratio;
        newCanvas.height = sourceCanvas.height * ratio;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, newCanvas.width, newCanvas.height);

        return newCanvas;
    }

    drawHeatmapOnImage(imageCanvas, positions) {
        const ctx = imageCanvas.getContext('2d');
        ctx.globalCompositeOperation = 'multiply';

        const groupedPositions = this.groupNearbyPositions(positions, 10);
        for (const pos of groupedPositions) {
            const intensity = Math.min(pos.count / 10, 1);
            const radius = Math.min(15 + pos.count * 2, 30);
            const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
            gradient.addColorStop(0, `rgba(255,0,0,${0.1 * intensity})`);
            gradient.addColorStop(0.5, `rgba(255,255,0,${0.05 * intensity})`);
            gradient.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        ctx.globalCompositeOperation = 'source-over';
        return imageCanvas;
    }

    groupNearbyPositions(positions, threshold = 10) {
        const groups = [];
        for (const pos of positions) {
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

    addUrlInfo(canvas, url, positionCount) {
        const ctx = canvas.getContext('2d');
        const padding = 8;
        const fontSize = 10;
        ctx.font = `${fontSize}px Arial`;
        const urlText = url.length > 50 ? url.substring(0, 47) + '...' : url;
        const countText = `Pts: ${positionCount}`;
        const dateText = new Date().toLocaleTimeString();
        const maxWidth = Math.max(
            ctx.measureText(urlText).width,
            ctx.measureText(countText).width,
            ctx.measureText(dateText).width
        );
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(padding, padding, maxWidth + padding * 2, (fontSize + 2) * 3 + padding);
        ctx.fillStyle = 'white';
        ctx.fillText(urlText, padding * 2, padding * 2 + fontSize);
        ctx.fillText(countText, padding * 2, padding * 2 + fontSize * 2 + 2);
        ctx.fillText(dateText, padding * 2, padding * 2 + fontSize * 3 + 4);
        return canvas;
    }
}

// Inicializa cliente WebSocket
const heatmapClient = new HeatmapWebSocketClient();

// Exporta funções globais para debug
window.heatmapClient = heatmapClient;
window.showHeatmapData = () => {
    console.log('Session ID:', heatmapClient.sessionId);
    console.log('Connected:', heatmapClient.connected);
    console.log('Config:', heatmapClient.config);
    console.log('Heatmap Data:', heatmapClient.heatmapData);
};
window.manualCapture = () => heatmapClient.performCapture();
window.getSessionInfo = () => ({
    sessionId: heatmapClient.sessionId,
    connected: heatmapClient.connected,
    config: heatmapClient.config
});
