// heatmap.js - Plugin Flutter Heatmap Tracker
// Este arquivo usa as configurações injetadas pelo plugin Flutter

// Recupera configurações injetadas pelo plugin Flutter
const config = window.HEATMAP_CONFIG || {
    serverUrl: 'http://localhost:3001',
    imageQuality: 0.2,
    userId: null
};

console.log('Heatmap.js carregado com configurações:', config);

// Objeto para armazenar posições do mouse por URL
let heatmapData = {};
let currentUrl = window.location.href;
let lastCapturedUrl = currentUrl;

// Variáveis para o sistema visual
let trailPoints = [];
let clickPoints = [];
let lastMousePosition = null;
let isMouseInFocus = false;
let fastCaptureTimer = null;

// Cria overlay visual para rastro e cliques
let visualOverlay = null;

function initializeUrlData(url) {
    if (!heatmapData[url]) {
        heatmapData[url] = {
            positions: [],
            timestamp: Date.now()
        };
    }
}

function cleanupOldData() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    Object.keys(heatmapData).forEach(url => {
        if (now - heatmapData[url].timestamp > maxAge) {
            delete heatmapData[url];
        }
    });
}

function createSafeFilename(url) {
    return url
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50)
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

// Gera ou recupera um sessionId único por usuário
function getSessionId() {
    let sessionId = localStorage.getItem('heatmapSessionId');
    if (!sessionId) {
        // Usa userId do config se disponível, senão gera baseado na URL
        const userPrefix = config.userId ? `user_${config.userId}` : createSafeFilename(window.location.origin + window.location.pathname);
        sessionId = `${userPrefix}_${Math.random().toString(36).substr(2, 6)}_${Date.now()}`;
        localStorage.setItem('heatmapSessionId', sessionId);
        console.log('Nova sessão criada:', sessionId);
        console.log('User ID:', config.userId || 'não definido');
    }
    return sessionId;
}
const sessionId = getSessionId();

// Funções do sistema visual (invisível para usuário)
function initializeVisualSystem() {
    createVisualOverlay();
    setupMouseTracking();
    setupClickTracking();
    startFastCapture();

    console.log('Sistema de tracking inicializado (TOTALMENTE INVISÍVEL)');
    console.log('Servidor:', config.serverUrl);
    console.log('Qualidade da imagem:', config.imageQuality);
}

function createVisualOverlay() {
    // Overlay invisível - apenas para controle programático se necessário
    visualOverlay = document.createElement('div');
    visualOverlay.id = 'heatmap-visual-overlay';
    visualOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 999999;
        overflow: hidden;
        display: none;
        visibility: hidden;
    `;
    document.body.appendChild(visualOverlay);
}

function setupMouseTracking() {
    document.addEventListener('mousemove', function (e) {
        const now = Date.now();

        // Atualiza posição atual
        lastMousePosition = { x: e.clientX, y: e.clientY };
        isMouseInFocus = true;

        // Adiciona ponto ao rastro (apenas para salvar, não para mostrar)
        trailPoints.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now,
            id: Math.random().toString(36).substr(2, 9)
        });

        // Remove pontos antigos do rastro (mais de 2 segundos)
        trailPoints = trailPoints.filter(point => now - point.timestamp < 2000);

        // Lógica original do heatmap
        const nowUrl = window.location.href;
        if (nowUrl !== currentUrl) {
            currentUrl = nowUrl;
            initializeUrlData(currentUrl);
            console.log('URL changed to:', currentUrl);
            console.log('Session ID:', sessionId);
        }
        heatmapData[currentUrl].positions.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now
        });
        if (heatmapData[currentUrl].positions.length > 1000) {
            heatmapData[currentUrl].positions.shift();
        }
        heatmapData[currentUrl].timestamp = now;
    });

    // Mouse sai da janela
    document.addEventListener('mouseleave', function () {
        isMouseInFocus = false;
    });

    // Mouse entra na janela
    document.addEventListener('mouseenter', function () {
        isMouseInFocus = true;
    });
}

function setupClickTracking() {
    document.addEventListener('click', function (e) {
        const now = Date.now();

        // Adiciona clique (apenas para salvar na imagem, não para mostrar)
        clickPoints.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now,
            id: Math.random().toString(36).substr(2, 9)
        });

        // Remove cliques antigos (mais de 5 segundos)
        clickPoints = clickPoints.filter(click => now - click.timestamp < 5000);

        console.log('Clique registrado em:', { x: e.clientX, y: e.clientY });
    });
}

function startFastCapture() {
    // Captura rápida a cada 500ms quando mouse está em foco
    fastCaptureTimer = setInterval(() => {
        if (isMouseInFocus && lastMousePosition) {
            takeScreenshotAtPosition(lastMousePosition);
        }
    }, 500);
}

async function takeScreenshotAtPosition(position) {
    const captureUrl = window.location.href;
    if (captureUrl !== lastCapturedUrl) {
        console.log('URL changed during fast capture. Resetting coordinates for new URL.');
        lastCapturedUrl = captureUrl;
        initializeUrlData(captureUrl);
    }

    if (!heatmapData[captureUrl] || heatmapData[captureUrl].positions.length === 0) {
        console.log('No mouse data for fast capture:', captureUrl);
        return;
    }

    const positions = heatmapData[captureUrl].positions;

    try {
        const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            scale: 0.5,
            logging: false,
            removeContainer: true,
            backgroundColor: '#ffffff',
            optimizeForSpeed: true,
            width: Math.min(window.innerWidth, 1920),
            height: Math.min(window.innerHeight, 1080)
        });

        const resizedCanvas = resizeCanvas(canvas, 1920, 1080);
        const finalCanvas = drawHeatmapOnImage(resizedCanvas, positions);
        addUrlInfo(finalCanvas, captureUrl, positions.length);

        const { blob, format } = await compressImage(finalCanvas, config.imageQuality);
        const safeUrlName = createSafeFilename(captureUrl);
        const urlInfo = createSafeFilename(new URL(captureUrl).pathname || 'root');
        const filename = `heatmap_fast_${sessionId}_${urlInfo}_${Date.now()}.${format}`;

        await uploadImageToServer(blob, filename);

        console.log(`Fast screenshot enviada: ${filename}`);
        console.log(`Mouse position: ${position.x}, ${position.y}`);
        console.log(`Positions captured: ${positions.length}`);
    } catch (error) {
        console.error('Error taking fast screenshot:', error);
    }
}

function drawHeatmapOnImage(imageCanvas, positions) {
    const ctx = imageCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'multiply';

    // Desenha heatmap original
    const groupedPositions = groupNearbyPositions(positions, 10);
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

    // Desenha rastro do mouse na imagem
    if (trailPoints.length > 0) {
        const now = Date.now();
        trailPoints.forEach(point => {
            const age = now - point.timestamp;
            if (age < 2000) {
                const opacity = Math.max(0, 1 - (age / 2000));
                ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.4})`;
                ctx.beginPath();
                ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    // Desenha cliques na imagem
    if (clickPoints.length > 0) {
        const now = Date.now();
        clickPoints.forEach(click => {
            const age = now - click.timestamp;
            if (age < 5000) {
                const opacity = Math.max(0, 1 - (age / 5000));
                const scale = 1 + (age / 5000) * 1.5;

                // Círculo azul para clique
                ctx.fillStyle = `rgba(0, 100, 255, ${opacity * 0.6})`;
                ctx.beginPath();
                ctx.arc(click.x, click.y, 10 * scale, 0, 2 * Math.PI);
                ctx.fill();

                // Borda do clique
                ctx.strokeStyle = `rgba(0, 100, 255, ${opacity * 0.9})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(click.x, click.y, 10 * scale, 0, 2 * Math.PI);
                ctx.stroke();
            }
        });
    }

    return imageCanvas;
}

function groupNearbyPositions(positions, threshold = 10) {
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

function addUrlInfo(canvas, url, positionCount) {
    const ctx = canvas.getContext('2d');
    const padding = 8;
    const fontSize = 10;
    ctx.font = `${fontSize}px Arial`;
    const urlText = url.length > 50 ? url.substring(0, 47) + '...' : url;
    const countText = `Pts: ${positionCount}`;
    const dateText = new Date().toLocaleTimeString();
    const userText = config.userId ? `User: ${config.userId}` : 'User: anônimo';

    const maxWidth = Math.max(
        ctx.measureText(urlText).width,
        ctx.measureText(countText).width,
        ctx.measureText(dateText).width,
        ctx.measureText(userText).width
    );

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(padding, padding, maxWidth + padding * 2, (fontSize + 2) * 4 + padding);
    ctx.fillStyle = 'white';
    ctx.fillText(urlText, padding * 2, padding * 2 + fontSize);
    ctx.fillText(countText, padding * 2, padding * 2 + fontSize * 2 + 2);
    ctx.fillText(dateText, padding * 2, padding * 2 + fontSize * 3 + 4);
    ctx.fillText(userText, padding * 2, padding * 2 + fontSize * 4 + 6);

    return canvas;
}

function compressImage(canvas, quality = 0.3) {
    return new Promise((resolve) => {
        canvas.toBlob(function (webpBlob) {
            if (webpBlob) {
                resolve({ blob: webpBlob, format: 'webp' });
            } else {
                canvas.toBlob(function (jpegBlob) {
                    resolve({ blob: jpegBlob, format: 'jpeg' });
                }, 'image/jpeg', quality);
            }
        }, 'image/webp', quality);
    });
}

function resizeCanvas(sourceCanvas, maxWidth = 1920, maxHeight = 1080) {
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

async function uploadImageToServer(blob, filename) {
    const formData = new FormData();
    formData.append('image', blob, filename);

    // Adiciona informações do usuário se disponível
    if (config.userId) {
        formData.append('userId', config.userId);
    }

    try {
        const response = await fetch(`${config.serverUrl}/upload`, {
            method: 'POST',
            body: formData
        });
        if (response.ok) {
            console.log('Imagem enviada para o servidor com sucesso!');
        } else {
            console.error('Falha ao enviar imagem para o servidor');
        }
    } catch (e) {
        console.error('Erro ao enviar imagem:', e);
    }
}

async function takeScreenshot() {
    const captureUrl = window.location.href;
    if (captureUrl !== lastCapturedUrl) {
        console.log('URL changed during capture. Resetting coordinates for new URL.');
        lastCapturedUrl = captureUrl;
        initializeUrlData(captureUrl);
    }
    if (!heatmapData[captureUrl] || heatmapData[captureUrl].positions.length === 0) {
        console.log('No mouse data for current URL:', captureUrl);
        return;
    }
    const positions = heatmapData[captureUrl].positions;
    try {
        const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            scale: 0.5,
            logging: false,
            removeContainer: true,
            backgroundColor: '#ffffff',
            optimizeForSpeed: true,
            width: Math.min(window.innerWidth, 1920),
            height: Math.min(window.innerHeight, 1080)
        });
        const resizedCanvas = resizeCanvas(canvas, 1920, 1080);
        const finalCanvas = drawHeatmapOnImage(resizedCanvas, positions);
        addUrlInfo(finalCanvas, captureUrl, positions.length);
        const { blob, format } = await compressImage(finalCanvas, config.imageQuality);
        const safeUrlName = createSafeFilename(captureUrl);
        const urlInfo = createSafeFilename(new URL(captureUrl).pathname || 'root');
        const filename = `heatmap_${sessionId}_${urlInfo}_${Date.now()}.${format}`;
        await uploadImageToServer(blob, filename);
        console.log(`Screenshot enviada: ${filename}`);
        console.log(`URL: ${captureUrl}`);
        console.log(`Session: ${sessionId}`);
        console.log(`Tamanho: ${(blob.size / 1024).toFixed(2)} KB`);
        console.log(`Positions captured: ${positions.length}`);
    } catch (error) {
        console.error('Error taking screenshot:', error);
    }
}

// Inicialização
initializeUrlData(currentUrl);

console.log('=== Heatmap System Initialized ===');
console.log('Session ID:', sessionId);
console.log('Initial URL:', currentUrl);
console.log('Server URL:', config.serverUrl);
console.log('Image Quality:', config.imageQuality);
console.log('User ID:', config.userId || 'não definido');
console.log('Fast Capture: 500ms (when mouse in focus)');
console.log('======================================');

// Inicializa sistema visual
initializeVisualSystem();

// Monitor de mudança de URL
let lastUrl = window.location.href;
setInterval(() => {
    const nowUrl = window.location.href;
    if (nowUrl !== lastUrl) {
        lastUrl = nowUrl;
        currentUrl = nowUrl;
        initializeUrlData(currentUrl);
        console.log('URL changed (polling):', currentUrl);
        console.log('Session ID:', sessionId);
        console.log('Total URLs tracked:', Object.keys(heatmapData).length);
    }
}, 500);

// Screenshots periódicos
setInterval(takeScreenshot, 10000);
setInterval(cleanupOldData, 60 * 60 * 1000);

// Função para enviar evento de fim de sessão
async function sendSessionEndEvent() {
    try {
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('eventType', 'session_end');
        formData.append('timestamp', Date.now().toString());

        if (config.userId) {
            formData.append('userId', config.userId);
        }

        await fetch(`${config.serverUrl}/session-event`, {
            method: 'POST',
            body: formData
        });

        console.log('Session end event sent for:', sessionId);
    } catch (error) {
        console.error('Error sending session end event:', error);
    }
}

// Detectar fechamento da aba/janela
window.addEventListener('beforeunload', function (e) {
    console.log('Page unloading. Heatmap data:', heatmapData);

    // Enviar evento de fim de sessão
    const params = new URLSearchParams({
        sessionId: sessionId,
        eventType: 'session_end',
        timestamp: Date.now()
    });

    if (config.userId) {
        params.append('userId', config.userId);
    }

    navigator.sendBeacon(`${config.serverUrl}/session-event`, params);
});

// Detectar perda de foco da janela
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        console.log('Tab hidden - user switched away');
        if (fastCaptureTimer) {
            clearInterval(fastCaptureTimer);
            fastCaptureTimer = null;
        }
    } else {
        console.log('Tab visible - user returned');
        if (!fastCaptureTimer) {
            startFastCapture();
        }
    }
});

// Detectar quando usuário sai da página
window.addEventListener('pagehide', function () {
    console.log('Page hidden - sending session end event');
    sendSessionEndEvent();
});

// Funções globais para debug/controle
window.showHeatmapData = function () {
    console.log('Current heatmap data:', heatmapData);
    console.log('Current URL:', currentUrl);
    console.log('Session ID:', sessionId);
    console.log('URLs tracked:', Object.keys(heatmapData));
    console.log('Server URL:', config.serverUrl);
    console.log('Config:', config);
};

window.resetSession = function () {
    localStorage.removeItem('heatmapSessionId');
    console.log('Session reset. Reload page to get new session ID.');
};

window.getSessionInfo = function () {
    return {
        sessionId: sessionId,
        currentUrl: currentUrl,
        trackedUrls: Object.keys(heatmapData),
        serverUrl: config.serverUrl,
        imageQuality: config.imageQuality,
        userId: config.userId,
        config: config
    };
};
