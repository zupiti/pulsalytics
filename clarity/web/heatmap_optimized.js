(function() {
    'use strict';

    const UNIQUE_PAGE_KEY = `heatmap_${window.location.href}_${Date.now()}`;
    let heatmapData = {};
    let currentUrl = window.location.href;
    let lastCapturedUrl = currentUrl;
    let trailPoints = [];
    let clickPoints = [];
    let lastMousePosition = null;
    let isMouseInFocus = false;
    let fastCaptureTimer = null;
    let pendingCapture = false;
    let lastCaptureTime = 0;
    let captureTimeout = null;
    
    const MIN_CAPTURE_INTERVAL = 5000;
    const DEBOUNCE_DELAY = 1000;
    const TRAIL_RETENTION = 2000;
    const CLICK_RETENTION = 5000;
    const MAX_POSITIONS_PER_URL = 1000;
    const DATA_CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
    const SERVER_URL = 'http://localhost:3001';

    function getSessionId() {
        const sessionKey = `heatmapSessionId_${UNIQUE_PAGE_KEY}`;
        let sessionId = sessionStorage.getItem(sessionKey);
        
        if (!sessionId) {
            const urlBase = createSafeFilename(window.location.origin + window.location.pathname);
            sessionId = `${urlBase}_${Math.random().toString(36).substr(2, 6)}_${Date.now()}`;
            sessionStorage.setItem(sessionKey, sessionId);
        }
        return sessionId;
    }

    const sessionId = getSessionId();

    function createSafeFilename(url) {
        return url
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50)
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

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
        Object.keys(heatmapData).forEach(url => {
            if (now - heatmapData[url].timestamp > DATA_CLEANUP_INTERVAL) {
                delete heatmapData[url];
            }
        });
    }

    function setupMouseTracking() {
        let lastRecordedTime = 0;
        const RECORD_THROTTLE = 50;

        document.addEventListener('mousemove', function(e) {
            const now = Date.now();
            
            if (now - lastRecordedTime < RECORD_THROTTLE) return;
            lastRecordedTime = now;

            lastMousePosition = { x: e.clientX, y: e.clientY };
            isMouseInFocus = true;

            trailPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: now,
                id: Math.random().toString(36).substr(2, 9)
            });

            trailPoints = trailPoints.filter(point => now - point.timestamp < TRAIL_RETENTION);

            const nowUrl = window.location.href;
            if (nowUrl !== currentUrl) {
                currentUrl = nowUrl;
                initializeUrlData(currentUrl);
            }

            heatmapData[currentUrl].positions.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: now
            });

            if (heatmapData[currentUrl].positions.length > MAX_POSITIONS_PER_URL) {
                heatmapData[currentUrl].positions.shift();
            }
            heatmapData[currentUrl].timestamp = now;
        }, { passive: true });

        document.addEventListener('mouseleave', () => isMouseInFocus = false, { passive: true });
        document.addEventListener('mouseenter', () => isMouseInFocus = true, { passive: true });
    }

    function setupClickTracking() {
        document.addEventListener('click', function(e) {
            const now = Date.now();
            
            clickPoints.push({
                x: e.clientX,
                y: e.clientY,
                timestamp: now,
                id: Math.random().toString(36).substr(2, 9)
            });

            clickPoints = clickPoints.filter(click => now - click.timestamp < CLICK_RETENTION);
        }, { passive: true });
    }

    function startFastCapture() {
        fastCaptureTimer = setInterval(() => {
            if (isMouseInFocus && lastMousePosition && !pendingCapture) {
                const now = Date.now();
                if (now - lastCaptureTime >= MIN_CAPTURE_INTERVAL) {
                    debouncedCapture();
                }
            }
        }, 1000);
    }

    function debouncedCapture() {
        if (captureTimeout) {
            clearTimeout(captureTimeout);
        }

        captureTimeout = setTimeout(() => {
            if (!pendingCapture) {
                takeScreenshotAtPosition(lastMousePosition);
            }
        }, DEBOUNCE_DELAY);
    }

    async function takeScreenshotAtPosition(position) {
        if (pendingCapture) return;
        
        const captureUrl = window.location.href;
        if (captureUrl !== lastCapturedUrl) {
            lastCapturedUrl = captureUrl;
            initializeUrlData(captureUrl);
        }

        if (!heatmapData[captureUrl] || heatmapData[captureUrl].positions.length === 0) {
            return;
        }

        pendingCapture = true;
        lastCaptureTime = Date.now();

        try {
            const positions = heatmapData[captureUrl].positions;
            
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

            const { blob, format } = await compressImage(finalCanvas, 0.25);
            const urlInfo = createSafeFilename(new URL(captureUrl).pathname || 'root');
            const filename = `heatmap_fast_${sessionId}_${urlInfo}_${Date.now()}.${format}`;

            await uploadImageToServer(blob, filename);
        } catch (error) {
            console.error('Capture error:', error);
        } finally {
            pendingCapture = false;
        }
    }

    function drawHeatmapOnImage(imageCanvas, positions) {
        const ctx = imageCanvas.getContext('2d');
        ctx.globalCompositeOperation = 'multiply';

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

        if (trailPoints.length > 0) {
            const now = Date.now();
            trailPoints.forEach(point => {
                const age = now - point.timestamp;
                if (age < TRAIL_RETENTION) {
                    const opacity = Math.max(0, 1 - (age / TRAIL_RETENTION));
                    ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.4})`;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        }

        if (clickPoints.length > 0) {
            const now = Date.now();
            clickPoints.forEach(click => {
                const age = now - click.timestamp;
                if (age < CLICK_RETENTION) {
                    const opacity = Math.max(0, 1 - (age / CLICK_RETENTION));
                    const scale = 1 + (age / CLICK_RETENTION) * 1.5;

                    ctx.fillStyle = `rgba(0, 100, 255, ${opacity * 0.6})`;
                    ctx.beginPath();
                    ctx.arc(click.x, click.y, 10 * scale, 0, 2 * Math.PI);
                    ctx.fill();

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

    function compressImage(canvas, quality = 0.25) {
        return new Promise((resolve) => {
            canvas.toBlob(function(webpBlob) {
                if (webpBlob) {
                    resolve({ blob: webpBlob, format: 'webp' });
                } else {
                    canvas.toBlob(function(jpegBlob) {
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
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(sourceCanvas, 0, 0, newCanvas.width, newCanvas.height);
        return newCanvas;
    }

    async function uploadImageToServer(blob, filename) {
        const formData = new FormData();
        formData.append('image', blob, filename);
        
        try {
            const response = await fetch(`${SERVER_URL}/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    }

    async function takeScreenshot() {
        if (pendingCapture) return;
        
        const captureUrl = window.location.href;
        if (captureUrl !== lastCapturedUrl) {
            lastCapturedUrl = captureUrl;
            initializeUrlData(captureUrl);
        }
        
        if (!heatmapData[captureUrl] || heatmapData[captureUrl].positions.length === 0) {
            return;
        }

        pendingCapture = true;

        try {
            const positions = heatmapData[captureUrl].positions;
            
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

            const { blob, format } = await compressImage(finalCanvas, 0.3);
            const urlInfo = createSafeFilename(new URL(captureUrl).pathname || 'root');
            const filename = `heatmap_${sessionId}_${urlInfo}_${Date.now()}.${format}`;

            await uploadImageToServer(blob, filename);
        } catch (error) {
            console.error('Screenshot error:', error);
        } finally {
            pendingCapture = false;
        }
    }

    async function sendSessionEndEvent() {
        try {
            const formData = new FormData();
            formData.append('sessionId', sessionId);
            formData.append('eventType', 'session_end');
            formData.append('timestamp', Date.now().toString());

            await fetch(`${SERVER_URL}/session-event`, {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error('Session end event failed:', error);
        }
    }

    function initialize() {
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
        }, 500);

        setInterval(takeScreenshot, 10000);
        setInterval(cleanupOldData, 60 * 60 * 1000);

        window.addEventListener('beforeunload', function() {
            navigator.sendBeacon(`${SERVER_URL}/session-event`,
                new URLSearchParams({
                    sessionId: sessionId,
                    eventType: 'session_end',
                    timestamp: Date.now()
                })
            );
        });

        document.addEventListener('visibilitychange', function() {
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

        window.addEventListener('pagehide', sendSessionEndEvent);
    }

    window.showHeatmapData = () => ({
        sessionId,
        currentUrl,
        trackedUrls: Object.keys(heatmapData),
        serverUrl: SERVER_URL
    });

    window.resetSession = () => {
        sessionStorage.removeItem(`heatmapSessionId_${UNIQUE_PAGE_KEY}`);
        location.reload();
    };

    window.manualCapture = takeScreenshot;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
