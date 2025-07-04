const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configurações
const WS_PORT = 3002;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Cria diretório de uploads se não existir
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Servidor WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });

// Armazena clientes ativos por sessão
const activeClients = new Map();
const sessionStats = new Map();

console.log(`🚀 WebSocket Server iniciado na porta ${WS_PORT}`);

wss.on('connection', (ws, req) => {
    let sessionId = null;
    let clientInfo = {
        ip: req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        connectedAt: new Date().toISOString()
    };

    console.log(`✅ Nova conexão WebSocket: ${clientInfo.ip}`);

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'session_start':
                    sessionId = message.sessionId;
                    clientInfo.sessionId = sessionId;
                    activeClients.set(sessionId, { ws, info: clientInfo });

                    // Inicializa stats da sessão
                    sessionStats.set(sessionId, {
                        startTime: Date.now(),
                        imagesReceived: 0,
                        lastActivity: Date.now(),
                        url: message.url || 'unknown'
                    });

                    console.log(`📱 Sessão iniciada: ${sessionId}`);

                    // Broadcast para admin
                    broadcastToAdmin('session_started', {
                        sessionId: sessionId,
                        url: message.url,
                        timestamp: Date.now()
                    });

                    // Responde com configurações otimizadas
                    ws.send(JSON.stringify({
                        type: 'config',
                        captureInterval: 8000, // 8 segundos entre capturas
                        minMouseMoves: 10, // Mínimo de movimentos para capturar
                        qualityMode: 'balanced' // low, balanced, high
                    }));
                    break;

                case 'mouse_data':
                    if (sessionId && sessionStats.has(sessionId)) {
                        const stats = sessionStats.get(sessionId);
                        stats.lastActivity = Date.now();

                        // Lógica inteligente: só solicita captura se houver atividade significativa
                        if (message.positions && message.positions.length > 15) {
                            ws.send(JSON.stringify({
                                type: 'capture_request',
                                timestamp: Date.now()
                            }));
                        }
                    }
                    break;

                case 'image_data':
                    if (sessionId) {
                        // Broadcast upload em progresso
                        broadcastToAdmin('upload_in_progress', {
                            sessionId: sessionId,
                            timestamp: Date.now()
                        });

                        await handleImageUpload(message, sessionId);

                        // Atualiza estatísticas
                        if (sessionStats.has(sessionId)) {
                            const stats = sessionStats.get(sessionId);
                            stats.imagesReceived++;
                            stats.lastActivity = Date.now();
                        }

                        // Broadcast upload completo
                        broadcastToAdmin('image_uploaded', {
                            sessionId: sessionId,
                            filename: message.filename,
                            timestamp: Date.now()
                        });
                    }
                    break;

                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                    break;

                case 'session_end':
                    if (sessionId) {
                        console.log(`🔚 Sessão finalizada: ${sessionId}`);
                        logSessionSummary(sessionId);

                        // Broadcast para admin
                        broadcastToAdmin('session_ended', {
                            sessionId: sessionId,
                            timestamp: Date.now()
                        });

                        activeClients.delete(sessionId);
                        sessionStats.delete(sessionId);
                    }
                    break;

                case 'admin_monitor_start':
                    // Resposta para admin com status atual
                    ws.send(JSON.stringify({
                        type: 'connections_status',
                        connections: getActiveConnectionsStatus(),
                        timestamp: Date.now()
                    }));
                    break;
            }
        } catch (error) {
            console.error('❌ Erro ao processar mensagem WebSocket:', error);
        }
    });

    ws.on('close', () => {
        if (sessionId) {
            console.log(`🔌 Conexão WebSocket fechada: ${sessionId}`);
            activeClients.delete(sessionId);
            sessionStats.delete(sessionId);
        }
    });

    ws.on('error', (error) => {
        console.error('❌ Erro WebSocket:', error);
    });
});

async function handleImageUpload(message, sessionId) {
    try {
        // Decodifica imagem base64
        const base64Data = message.imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Gera nome do arquivo
        const filename = `heatmap_ws_${sessionId}_${Date.now()}.${message.format || 'webp'}`;
        const filepath = path.join(UPLOAD_DIR, filename);

        // Salva arquivo
        fs.writeFileSync(filepath, buffer);

        console.log(`💾 Imagem salva via WebSocket: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);

        // Responde confirmação
        const client = activeClients.get(sessionId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
                type: 'upload_success',
                filename: filename,
                size: buffer.length
            }));
        }

    } catch (error) {
        console.error('❌ Erro ao salvar imagem:', error);
    }
}

function logSessionSummary(sessionId) {
    if (sessionStats.has(sessionId)) {
        const stats = sessionStats.get(sessionId);
        const duration = Math.round((Date.now() - stats.startTime) / 1000);

        console.log(`📊 Resumo da Sessão ${sessionId}:`);
        console.log(`   ⏱️  Duração: ${duration}s`);
        console.log(`   📸 Imagens: ${stats.imagesReceived}`);
        console.log(`   🌐 URL: ${stats.url}`);
    }
}

// Função para broadcast para admin
function broadcastToAdmin(eventType, data) {
    // Nota: Como este é o servidor dedicado WebSocket (porta 3002),
    // não temos conexão direta com o admin React.
    // O admin React se conecta ao servidor HTTP (porta 3001).
    // Para integração completa, seria necessário um sistema de comunicação entre servidores.
    console.log(`📡 Admin Event: ${eventType}`, data);
}

// Função para obter status das conexões ativas
function getActiveConnectionsStatus() {
    const connections = {};

    for (const [sessionId, client] of activeClients.entries()) {
        const stats = sessionStats.get(sessionId);
        connections[sessionId] = {
            sessionId: sessionId,
            connectedAt: client.info.connectedAt,
            lastActivity: stats?.lastActivity || Date.now(),
            imagesReceived: stats?.imagesReceived || 0,
            qualityMode: 'balanced', // Default
            uploading: false,
            url: stats?.url || 'unknown'
        };
    }

    return connections;
}

// Limpa sessões inativas (mais de 1 hora sem atividade)
setInterval(() => {
    const now = Date.now();
    const maxInactivity = 60 * 60 * 1000; // 1 hora

    for (const [sessionId, stats] of sessionStats.entries()) {
        if (now - stats.lastActivity > maxInactivity) {
            console.log(`🧹 Limpando sessão inativa: ${sessionId}`);
            activeClients.delete(sessionId);
            sessionStats.delete(sessionId);
        }
    }
}, 10 * 60 * 1000); // Verifica a cada 10 minutos

// API de status
setInterval(() => {
    console.log(`📈 Status: ${activeClients.size} clientes ativos, ${sessionStats.size} sessões`);
}, 60000); // Log a cada minuto
