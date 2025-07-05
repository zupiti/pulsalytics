const config = window.HEATMAP_CONFIG || {
    serverUrl: 'ws://localhost:3002',
    interval: 2000, // 2 seconds parameterized
    imageInterval: 5000, // 5 seconds for images (delay)
    userId: null,
    // Remove all other complex configurations
};

class HeatmapTracker {
    constructor(customConfig = {}) {
        this.config = { ...config, ...customConfig };
        this.sessionId = this.getSessionId();
        this.url = window.location.href;
        this.ws = null;
        this.isConnected = false;
        this.messageQueue = [];

        // Persistent data in memory
        this.mousePositions = [];
        this.clickPoints = [];
        this.allPositions = []; // Persistent buffer of all positions
        this.allClicks = []; // Persistent buffer of all clicks
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
        // Mouse move - always capture, not just when in focus
        document.addEventListener('mousemove', (e) => {
            const position = {
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            };

            // Add to current buffer
            this.mousePositions.push(position);

            // Add to persistent buffer
            this.allPositions.push(position);

            // Limit persistent buffer to 1000 positions
            if (this.allPositions.length > 1000) {
                this.allPositions.shift();
            }
        });

        // Mouse click - always capture
        document.addEventListener('click', (e) => {
            const click = {
                x: e.clientX,
                y: e.clientY,
                timestamp: Date.now()
            };

            // Add to current buffer
            this.clickPoints.push(click);

            // Add to persistent buffer
            this.allClicks.push(click);

            // Limit persistent buffer to 100 clicks
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
        // Data sending (without image) every 2 seconds
        this.interval = setInterval(() => {
            this.sendDataOnly();
        }, this.config.interval);

        // Image sending every 5 seconds (with delay)
        this.imageInterval = setInterval(() => {
            this.sendDataWithImage();
        }, this.config.imageInterval);
    }

    // Send only data without image (more frequent)
    async sendDataOnly() {
        try {
            // Always send data if there is activity
            const hasActivity = this.mousePositions.length > 0 || this.clickPoints.length > 0;

            if (!hasActivity) {
                return; // Do not send if there is no activity
            }

            // Send metadata without image
            const metadata = {
                type: 'heatmap_metadata',
                sessionId: this.sessionId,
                timestamp: Date.now(),
                url: this.url,
                positions: [...this.allPositions], // Send persistent buffer
                clickPoints: [...this.allClicks], // Send persistent buffer
                imageSize: 0,
                imageType: 'none'
            };

            this.sendWebSocketMessage(metadata);

            // Clear only temporary buffers, keep persistent
            this.mousePositions = [];
            this.clickPoints = [];

        } catch (error) {
            console.error('Error sending data:', error);
        }
    }

    // Send data with image (less frequent)
    async sendDataWithImage() {
        try {
            // Only capture image if there was recent activity
            const hasRecentActivity = this.allPositions.length > 0 || this.allClicks.length > 0;

            if (!hasRecentActivity) {
                return;
            }

            const now = Date.now();
            // Check if enough time has passed since the last image
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

                // Convert to blob
                const blob = await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/webp', 0.7);
                });

                // Send metadata with image
                const metadata = {
                    type: 'heatmap_metadata',
                    sessionId: this.sessionId,
                    timestamp: now,
                    url: this.url,
                    positions: [...this.allPositions], // Always send persistent buffer
                    clickPoints: [...this.allClicks], // Always send persistent buffer
                    imageSize: blob.size,
                    imageType: 'image/webp'
                };

                this.sendWebSocketMessage(metadata);

                // Send the blob as ArrayBuffer
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
                console.error('Error capturing image:', error);
                // Even without image, send the data
                this.sendDataOnly();
            }

        } catch (error) {
            console.error('Error sending data with image:', error);
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

// Auto-initialize
const heatmapTracker = new HeatmapTracker();

// API global simples
window.HeatmapTracker = {
    destroy: () => heatmapTracker.destroy(),
    getSessionId: () => heatmapTracker.sessionId,
    getPositions: () => heatmapTracker.allPositions,
    getClicks: () => heatmapTracker.allClicks
};
