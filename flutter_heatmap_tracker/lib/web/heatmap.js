// 🔥 HEATMAP TRACKER - Sistema Completo de Captura e Análise
// Versão otimizada com envio de dados de mouse a cada 10 segundos

(function () {
    'use strict';

    console.log('🚀 Heatmap Tracker iniciado');

    // ========================================
    // CONFIGURAÇÃO E VARIÁVEIS GLOBAIS
    // ========================================

    let config = {
        imageQuality: 0.8,        // Qualidade alta das imagens (80%)
        captureInterval: 8000,    // Captura a cada 8 segundos
        mouseDataInterval: 10000, // Envio de dados de mouse a cada 10 segundos
        minMouseMoves: 10,        // Mínimo de movimentos para enviar
        blurSensitiveText: true,
        qualityMode: 'balanced'
    };

    let sessionId = null;
    let ws = null;
    let isCapturing = false;
    let captureTimer = null;
    let mouseDataTimer = null;
    let lastCaptureTime = 0;
    let currentUrl = window.location.href;

    // Arrays para acumular dados localmente
    let accumulatedMouseData = [];
    let accumulatedClickData = [];

    // Contadores para logs
    let totalMousePoints = 0;
    let totalClicks = 0;

    // ========================================
    // UTILIDADES
    // ========================================

    function generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function sendWebSocketMessage(data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            try {
                const message = JSON.stringify(data);
                ws.send(message);
                return true;
            } catch (error) {
                console.error('❌ Erro ao enviar mensagem WebSocket:', error);
                return false;
            }
        }
        return false;
    }

    // ========================================
    // CAPTURA DE SCREENSHOT
    // ========================================

    async function captureScreenshot() {
        if (!isCapturing) return;

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Configurar canvas com dimensões da viewport
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Usar html2canvas para capturar a tela
            if (typeof html2canvas !== 'undefined') {
                const canvasCapture = await html2canvas(document.body, {
                    width: viewport.width,
                    height: viewport.height,
                    useCORS: true,
                    allowTaint: true,
                    scale: 1,
                    logging: false
                });

                // Desenhar no canvas principal
                ctx.drawImage(canvasCapture, 0, 0);
            } else {
                // Fallback: desenhar retângulo com informações
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Screenshot capturado', canvas.width / 2, canvas.height / 2);
                ctx.fillText(`${new Date().toLocaleTimeString()}`, canvas.width / 2, canvas.height / 2 + 30);
            }

            // Converter para blob
            return new Promise((resolve) => {
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/webp', config.imageQuality);
            });

        } catch (error) {
            console.error('❌ Erro na captura:', error);
            return null;
        }
    }

    async function sendScreenshot() {
        const now = Date.now();
        if (now - lastCaptureTime < config.captureInterval) return;

        const blob = await captureScreenshot();
        if (!blob) return;

        lastCaptureTime = now;

        // Enviar via WebSocket
        const reader = new FileReader();
        reader.onload = function () {
            const base64 = reader.result.split(',')[1];

            const message = {
                type: 'screenshot',
                sessionId: sessionId,
                url: currentUrl,
                timestamp: now,
                data: base64,
                size: blob.size,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };

            if (sendWebSocketMessage(message)) {
                console.log(`📸 Screenshot enviado: ${(blob.size / 1024).toFixed(2)} KB`);
            }
        };
        reader.readAsDataURL(blob);
    }

    // ========================================
    // CAPTURA DE DADOS DE MOUSE
    // ========================================

    function trackMouseMovement(event) {
        if (!isCapturing) return;

        const mouseData = {
            x: event.clientX,
            y: event.clientY,
            timestamp: performance.now()
        };

        accumulatedMouseData.push(mouseData);
        totalMousePoints++;

        // Limite máximo de pontos acumulados (evitar uso excessivo de memória)
        if (accumulatedMouseData.length > 1000) {
            accumulatedMouseData = accumulatedMouseData.slice(-500);
        }
    }

    function trackClick(event) {
        if (!isCapturing) return;

        const clickData = {
            x: event.clientX,
            y: event.clientY,
            timestamp: performance.now(),
            id: generateSessionId()
        };

        accumulatedClickData.push(clickData);
        totalClicks++;

        console.log(`🖱️ Clique capturado: (${clickData.x}, ${clickData.y})`);

        // Enviar dados de clique imediatamente
        sendClickData();
    }

    // ========================================
    // ENVIO DE DADOS ACUMULADOS
    // ========================================

    function sendAccumulatedMouseData() {
        if (!isCapturing || accumulatedMouseData.length === 0) return;

        const message = {
            type: 'mouse_data',
            sessionId: sessionId,
            url: currentUrl,
            positions: [...accumulatedMouseData],
            timestamp: Date.now()
        };

        if (sendWebSocketMessage(message)) {
            console.log(`📤 Enviando ${accumulatedMouseData.length} pontos de mouse acumulados`);
            accumulatedMouseData = []; // Limpar array após envio
        }
    }

    function sendClickData() {
        if (!isCapturing || accumulatedClickData.length === 0) return;

        const message = {
            type: 'click_data',
            sessionId: sessionId,
            url: currentUrl,
            clicks: [...accumulatedClickData],
            timestamp: Date.now()
        };

        if (sendWebSocketMessage(message)) {
            console.log(`🖱️ Enviando ${accumulatedClickData.length} cliques`);
            // Não limpar cliques - manter histórico acumulativo
        }
    }

    // ========================================
    // MONITORAMENTO DE URL
    // ========================================

    function monitorUrlChanges() {
        const newUrl = window.location.href;
        if (newUrl !== currentUrl) {
            const oldUrl = currentUrl;
            currentUrl = newUrl;

            const message = {
                type: 'url_change',
                sessionId: sessionId,
                oldUrl: oldUrl,
                newUrl: newUrl,
                timestamp: Date.now()
            };

            sendWebSocketMessage(message);
            console.log(`🔄 URL alterada: ${newUrl}`);
        }
    }

    // ========================================
    // CONEXÃO WEBSOCKET
    // ========================================

    function connectWebSocket() {
        try {
            ws = new WebSocket('ws://localhost:3002');

            ws.onopen = function () {
                console.log('✅ WebSocket conectado');
                startSession();
            };

            ws.onmessage = function (event) {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'config') {
                        Object.assign(config, data);
                        console.log('⚙️ Configuração atualizada:', config);
                    } else if (data.type === 'capture_request') {
                        sendScreenshot();
                    }
                } catch (error) {
                    console.error('❌ Erro ao processar mensagem:', error);
                }
            };

            ws.onclose = function () {
                console.log('🔌 WebSocket desconectado');
                setTimeout(connectWebSocket, 5000); // Reconectar em 5s
            };

            ws.onerror = function (error) {
                console.error('❌ Erro WebSocket:', error);
            };

        } catch (error) {
            console.error('❌ Erro ao conectar WebSocket:', error);
            setTimeout(connectWebSocket, 5000);
        }
    }

    // ========================================
    // CONTROLE DE SESSÃO
    // ========================================

    function startSession() {
        if (!sessionId) {
            sessionId = generateSessionId();
        }

        const sessionData = {
            type: 'session_start',
            sessionId: sessionId,
            userId: null,
            url: currentUrl,
            timestamp: Date.now(),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            config: config
        };

        if (sendWebSocketMessage(sessionData)) {
            console.log(`🎯 Sessão iniciada: ${sessionId}`);
            startCapturing();
        }
    }

    function startCapturing() {
        if (isCapturing) return;

        isCapturing = true;
        console.log('🟢 Captura iniciada');

        // Configurar timer para captura de screenshots
        captureTimer = setInterval(() => {
            sendScreenshot();
        }, config.captureInterval);

        // Configurar timer para envio de dados de mouse
        mouseDataTimer = setInterval(() => {
            sendAccumulatedMouseData();
        }, config.mouseDataInterval);

        // Adicionar event listeners
        document.addEventListener('mousemove', trackMouseMovement, { passive: true });
        document.addEventListener('click', trackClick, { passive: true });

        // Monitorar mudanças de URL
        setInterval(monitorUrlChanges, 1000);

        // Enviar configuração inicial
        sendWebSocketMessage({
            type: 'config',
            captureInterval: config.captureInterval,
            minMouseMoves: config.minMouseMoves,
            qualityMode: config.qualityMode
        });

        // Captura inicial
        setTimeout(() => {
            sendScreenshot();
        }, 1000);
    }

    function stopCapturing() {
        if (!isCapturing) return;

        isCapturing = false;
        console.log('🔴 Captura interrompida');

        // Limpar timers
        if (captureTimer) {
            clearInterval(captureTimer);
            captureTimer = null;
        }

        if (mouseDataTimer) {
            clearInterval(mouseDataTimer);
            mouseDataTimer = null;
        }

        // Enviar dados finais antes de parar
        sendAccumulatedMouseData();
        sendClickData();

        // Remover event listeners
        document.removeEventListener('mousemove', trackMouseMovement);
        document.removeEventListener('click', trackClick);

        // Notificar fim da sessão
        sendWebSocketMessage({
            type: 'session_end',
            sessionId: sessionId,
            timestamp: Date.now(),
            summary: {
                totalMousePoints: totalMousePoints,
                totalClicks: totalClicks,
                duration: Date.now() - (sessionId ? parseInt(sessionId.split('-')[0], 16) : 0)
            }
        });
    }

    // ========================================
    // CONTROLE DE PÁGINA
    // ========================================

    window.addEventListener('beforeunload', function () {
        stopCapturing();
        if (ws) {
            ws.close();
        }
    });

    window.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            console.log('📱 Página oculta - pausando captura');
            stopCapturing();
        } else {
            console.log('📱 Página visível - retomando captura');
            if (ws && ws.readyState === WebSocket.OPEN) {
                startCapturing();
            }
        }
    });

    // ========================================
    // INICIALIZAÇÃO
    // ========================================

    function init() {
        console.log('🚀 Inicializando Heatmap Tracker...');

        // Aguardar carregamento completo da página
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', connectWebSocket);
        } else {
            connectWebSocket();
        }
    }

    // ========================================
    // API PÚBLICA
    // ========================================

    window.heatmapTracker = {
        start: startCapturing,
        stop: stopCapturing,
        getSessionId: () => sessionId,
        getConfig: () => ({ ...config }),
        updateConfig: (newConfig) => Object.assign(config, newConfig),
        getStats: () => ({
            totalMousePoints: totalMousePoints,
            totalClicks: totalClicks,
            accumulatedMouseData: accumulatedMouseData.length,
            accumulatedClickData: accumulatedClickData.length,
            isCapturing: isCapturing
        })
    };

    // Inicializar
    init();

})(); 