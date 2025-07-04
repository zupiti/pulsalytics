const config = window.HEATMAP_CONFIG || {
    serverUrl: 'http://localhost:3001',
    imageQuality: 0.1,
    userId: null
};

let heatmapData = {};
let currentUrl = window.location.href;
let lastCapturedUrl = currentUrl;
let trailPoints = [];
let clickPoints = [];
let lastMousePosition = null;
let isMouseInFocus = false;
let fastCaptureTimer = null;
let uploadQueue = [];
let isUploading = false;
let mouseBuffer = [];
let bufferTimer = null;

function createSafeFilename(url) {
    return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50).replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function getSessionId() {
    let sessionId = sessionStorage.getItem('heatmapSessionId');
    if (!sessionId) {
        const userPrefix = config.userId ? `user_${config.userId}` : createSafeFilename(window.location.origin + window.location.pathname);
        sessionId = `${userPrefix}_${Math.random().toString(36).substr(2, 6)}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        sessionStorage.setItem('heatmapSessionId', sessionId);
    }
    return sessionId;
}

const sessionId = getSessionId();

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
    const maxAge = 12 * 60 * 60 * 1000;
    Object.keys(heatmapData).forEach(url => {
        if (now - heatmapData[url].timestamp > maxAge) {
            delete heatmapData[url];
        }
    });
}

function flushMouseBuffer() {
    if (mouseBuffer.length === 0) return;
    
    const now = Date.now();
    mouseBuffer.forEach(pos => {
        if (!heatmapData[currentUrl]) {
            initializeUrlData(currentUrl);
        }
        heatmapData[currentUrl].positions.push(pos);
    });
    
    if (heatmapData[currentUrl].positions.length > 800) {
        heatmapData[currentUrl].positions = heatmapData[currentUrl].positions.slice(-600);
    }
    
    heatmapData[currentUrl].timestamp = now;
    mouseBuffer = [];
}

function setupMouseTracking() {
    document.addEventListener('mousemove', function (e) {
        const now = Date.now();
        
        lastMousePosition = { x: e.clientX, y: e.clientY };
        isMouseInFocus = true;
        
        trailPoints.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now,
            id: Math.random().toString(36).substr(2, 9)
        });
        
        if (trailPoints.length > 20) {
            trailPoints = trailPoints.slice(-15);
        }
        
        mouseBuffer.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now
        });
        
        if (mouseBuffer.length >= 10) {
            flushMouseBuffer();
        }
        
        if (bufferTimer) clearTimeout(bufferTimer);
        bufferTimer = setTimeout(flushMouseBuffer, 100);
        
        const nowUrl = window.location.href;
        if (nowUrl !== currentUrl) {
            currentUrl = nowUrl;
            initializeUrlData(currentUrl);
        }
    });

    document.addEventListener('mouseleave', () => { isMouseInFocus = false; });
    document.addEventListener('mouseenter', () => { isMouseInFocus = true; });
}

function setupClickTracking() {
    document.addEventListener('click', function (e) {
        const now = Date.now();
        clickPoints.push({
            x: e.clientX,
            y: e.clientY,
            timestamp: now,
            id: Math.random().toString(36).substr(2, 9)
        });
        
        if (clickPoints.length > 10) {
            clickPoints = clickPoints.slice(-8);
        }
    });
}

function processUploadQueue() {
    if (isUploading || uploadQueue.length === 0) return;
    
    isUploading = true;
    const { blob, filename } = uploadQueue.shift();
    
    uploadImageToServer(blob, filename).finally(() => {
        isUploading = false;
        setTimeout(processUploadQueue, 50);
    });
}

function startFastCapture() {
    fastCaptureTimer = setInterval(() => {
        if (isMouseInFocus && lastMousePosition && uploadQueue.length < 3) {
            takeScreenshotAtPosition(lastMousePosition);
        }
    }, 800);
}

async function takeScreenshotAtPosition(position) {
    const captureUrl = window.location.href;
    if (captureUrl !== lastCapturedUrl) {
        lastCapturedUrl = captureUrl;
        initializeUrlData(captureUrl);
    }

    if (!heatmapData[captureUrl] || heatmapData[captureUrl].positions.length === 0) return;

    const positions = heatmapData[captureUrl].positions;

    try {
        const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            scale: 0.4,
            logging: false,
            removeContainer: true,
            backgroundColor: '#ffffff',
            optimizeForSpeed: true,
            width: Math.min(window.innerWidth, 1600),
            height: Math.min(window.innerHeight, 900)
        });

        const resizedCanvas = resizeCanvas(canvas, 1600, 900);
        const finalCanvas = drawHeatmapOnImage(resizedCanvas, positions);
        addUrlInfo(finalCanvas, captureUrl, positions.length);

        const { blob, format } = await compressImage(finalCanvas, config.imageQuality);
        const urlInfo = createSafeFilename(new URL(captureUrl).pathname || 'root');
        const filename = `heatmap_fast_${sessionId}_${urlInfo}_${Date.now()}.${format}`;

        uploadQueue.push({ blob, filename });
        processUploadQueue();
    } catch (error) {
        
    }
}

function drawHeatmapOnImage(imageCanvas, positions) {
    const ctx = imageCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'multiply';

    const groupedPositions = groupNearbyPositions(positions, 12);
    for (const pos of groupedPositions) {
        const intensity = Math.min(pos.count / 8, 1);
        const radius = Math.min(12 + pos.count * 1.5, 25);
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
        gradient.addColorStop(0, `rgba(255,0,0,${0.08 * intensity})`);
        gradient.addColorStop(0.5, `rgba(255,255,0,${0.04 * intensity})`);
        gradient.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    if (trailPoints.length > 0) {
        const now = Date.now();
        trailPoints.forEach(point => {
            const age = now - point.timestamp;
            if (age < 1500) {
                const opacity = Math.max(0, 1 - (age / 1500));
                ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.3})`;
                ctx.beginPath();
                ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    if (clickPoints.length > 0) {
        const now = Date.now();
        clickPoints.forEach(click => {
            const age = now - click.timestamp;
            if (age < 3000) {
                const opacity = Math.max(0, 1 - (age / 3000));
                const scale = 1 + (age / 3000) * 1.2;

                ctx.fillStyle = `rgba(0, 100, 255, ${opacity * 0.5})`;
                ctx.beginPath();
                ctx.arc(click.x, click.y, 8 * scale, 0, 2 * Math.PI);
                ctx.fill();

                ctx.strokeStyle = `rgba(0, 100, 255, ${opacity * 0.8})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(click.x, click.y, 8 * scale, 0, 2 * Math.PI);
                ctx.stroke();
            }
        });
    }

    return imageCanvas;
}

function groupNearbyPositions(positions, threshold = 12) {
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
    const padding = 6;
    const fontSize = 9;
    ctx.font = `${fontSize}px Arial`;
    const urlText = url.length > 45 ? url.substring(0, 42) + '...' : url;
    const countText = `Pts: ${positionCount}`;
    const dateText = new Date().toLocaleTimeString();
    const userText = config.userId ? `User: ${config.userId}` : 'User: anônimo';

    const maxWidth = Math.max(
        ctx.measureText(urlText).width,
        ctx.measureText(countText).width,
        ctx.measureText(dateText).width,
        ctx.measureText(userText).width
    );

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(padding, padding, maxWidth + padding * 2, (fontSize + 1.5) * 4 + padding);
    ctx.fillStyle = 'white';
    ctx.fillText(urlText, padding * 2, padding * 2 + fontSize);
    ctx.fillText(countText, padding * 2, padding * 2 + fontSize * 2 + 1.5);
    ctx.fillText(dateText, padding * 2, padding * 2 + fontSize * 3 + 3);
    ctx.fillText(userText, padding * 2, padding * 2 + fontSize * 4 + 4.5);

    return canvas;
}

function compressImage(canvas, quality = 0.1) {
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

function resizeCanvas(sourceCanvas, maxWidth = 1600, maxHeight = 900) {
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

    if (config.userId) {
        formData.append('userId', config.userId);
    }

    try {
        const response = await fetch(`${config.serverUrl}/upload`, {
            method: 'POST',
            body: formData
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

async function takeScreenshot() {
    const captureUrl = window.location.href;
    if (captureUrl !== lastCapturedUrl) {
        lastCapturedUrl = captureUrl;
        initializeUrlData(captureUrl);
    }
    if (!heatmapData[captureUrl] || heatmapData[captureUrl].positions.length === 0) return;

    const positions = heatmapData[captureUrl].positions;
    try {
        const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            scale: 0.4,
            logging: false,
            removeContainer: true,
            backgroundColor: '#ffffff',
            optimizeForSpeed: true,
            width: Math.min(window.innerWidth, 1600),
            height: Math.min(window.innerHeight, 900)
        });
        const resizedCanvas = resizeCanvas(canvas, 1600, 900);
        const finalCanvas = drawHeatmapOnImage(resizedCanvas, positions);
        addUrlInfo(finalCanvas, captureUrl, positions.length);
        const { blob, format } = await compressImage(finalCanvas, config.imageQuality);
        const urlInfo = createSafeFilename(new URL(captureUrl).pathname || 'root');
        const filename = `heatmap_${sessionId}_${urlInfo}_${Date.now()}.${format}`;
        
        uploadQueue.push({ blob, filename });
        processUploadQueue();
    } catch (error) {
        
    }
}

initializeUrlData(currentUrl);
setupMouseTracking();
setupClickTracking();
startFastCapture();

let lastUrl = window.location.href;
setInterval(() => {
    const nowUrl = window.location.href;
    if (nowUrl !== lastUrl) {
        lastUrl = nowUrl;
        currentUrl = nowUrl;
        initializeUrlData(currentUrl);
    }
}, 400);

setInterval(takeScreenshot, 12000);
setInterval(cleanupOldData, 30 * 60 * 1000);

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
    } catch (error) {
        
    }
}

window.addEventListener('beforeunload', function (e) {
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

document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        if (fastCaptureTimer) {
            clearInterval(fastCaptureTimer);
            fastCaptureTimer = null;
        }
    } else {
        if (!fastCaptureTimer) {
            startFastCapture();
        }
    }
});

window.addEventListener('pagehide', function () {
    sendSessionEndEvent();
});

window.getSessionInfo = function () {
    return {
        sessionId: sessionId,
        currentUrl: currentUrl,
        trackedUrls: Object.keys(heatmapData),
        serverUrl: config.serverUrl,
        imageQuality: config.imageQuality,
        userId: config.userId
    };
};