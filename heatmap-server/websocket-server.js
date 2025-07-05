const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');

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
                        mousePoints: 0,
                        clicks: 0,
                        lastActivity: Date.now(),
                        url: message.url || 'unknown'
                    });

                    console.log(`📱 Sessão iniciada: ${sessionId}`);

                    // Notificar servidor principal sobre nova sessão
                    notifyMainServer(sessionId, null, 'session_start');

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
                    // Processar dados de mouse sem salvar imagem
                    if (sessionId && message.positions) {
                        try {
                            // Atualizar estatísticas de mouse
                            if (sessionStats.has(sessionId)) {
                                const stats = sessionStats.get(sessionId);
                                stats.mousePoints += message.positions.length;
                                stats.lastActivity = Date.now();
                            }

                            console.log(`🖱️ Dados de mouse recebidos: ${message.positions.length} pontos da sessão ${sessionId}`);

                            // Opcional: Salvar dados de mouse em arquivo JSON
                            if (message.positions.length > 0) {
                                const mouseFilename = `mouse_data_${sessionId}_${Date.now()}.json`;
                                const mouseFilepath = path.join(UPLOAD_DIR, mouseFilename);

                                fs.writeFileSync(mouseFilepath, JSON.stringify({
                                    sessionId: sessionId,
                                    url: message.url,
                                    positions: message.positions,
                                    timestamp: Date.now()
                                }, null, 2));

                                console.log(`📁 Dados de mouse salvos: ${mouseFilename}`);
                            }

                        } catch (error) {
                            console.error('❌ Erro ao processar dados de mouse:', error);
                        }
                    }
                    break;

                case 'click_data':
                    // Processar dados de cliques
                    if (sessionId && message.clicks) {
                        try {
                            // Atualizar estatísticas de cliques
                            if (sessionStats.has(sessionId)) {
                                const stats = sessionStats.get(sessionId);
                                stats.clicks += message.clicks.length;
                                stats.lastActivity = Date.now();
                            }

                            console.log(`👆 Dados de cliques recebidos: ${message.clicks.length} cliques da sessão ${sessionId}`);

                            // Opcional: Salvar dados de cliques em arquivo JSON
                            if (message.clicks.length > 0) {
                                const clicksFilename = `click_data_${sessionId}_${Date.now()}.json`;
                                const clicksFilepath = path.join(UPLOAD_DIR, clicksFilename);

                                fs.writeFileSync(clicksFilepath, JSON.stringify({
                                    sessionId: sessionId,
                                    url: message.url,
                                    clicks: message.clicks,
                                    timestamp: Date.now()
                                }, null, 2));

                                console.log(`📁 Dados de cliques salvos: ${clicksFilename}`);
                            }

                        } catch (error) {
                            console.error('❌ Erro ao processar dados de cliques:', error);
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

                        // Log customizado para recebimento de imagem
                        console.log(`🟣 Imagem recebida do Flutter: sessionId=${sessionId}, tamanho=${message.imageData ? (message.imageData.length / 1024).toFixed(2) : 'N/A'} KB`);

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

                        // Notificar servidor principal sobre fim da sessão
                        notifyMainServer(sessionId, null, 'session_end');

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

                case 'heatmap_image':
                    // Salvar imagem base64
                    const base64Data = message.image;
                    const buffer = Buffer.from(base64Data, 'base64');
                    const filename = message.filename || `heatmap_ws_${message.sessionId}_${Date.now()}.webp`;
                    const filepath = path.join(UPLOAD_DIR, filename);
                    fs.writeFileSync(filepath, buffer);
                    console.log(`🖼️ Imagem recebida via WebSocket: ${filename}`);
                    // Log customizado para recebimento de imagem do Flutter
                    console.log(`🟣 Imagem recebida do Flutter (heatmap_image): sessionId=${message.sessionId}, tamanho=${(buffer.length / 1024).toFixed(2)} KB`);

                    // Salvar mouseTrail e mouseClicks (opcional: em arquivos separados ou log)
                    if (message.mouseTrail) {
                        const trailPath = path.join(UPLOAD_DIR, filename + '.trail.json');
                        fs.writeFileSync(trailPath, JSON.stringify(message.mouseTrail, null, 2));
                        console.log(`🟢 MouseTrail salvo: ${trailPath}`);
                    }
                    if (message.mouseClicks) {
                        const clicksPath = path.join(UPLOAD_DIR, filename + '.clicks.json');
                        fs.writeFileSync(clicksPath, JSON.stringify(message.mouseClicks, null, 2));
                        console.log(`🔵 MouseClicks salvo: ${clicksPath}`);
                    }
                    break;

                case 'screenshot':
                    // Processar mensagens do tipo 'screenshot' que o heatmap.js envia
                    if (sessionId && message.imageData) {
                        try {
                            // Medir tempo de processamento
                            const startTime = Date.now();

                            // Decodifica imagem base64 (remove prefixo data:image se presente)
                            const base64Data = message.imageData.replace(/^data:image\/\w+;base64,/, '');

                            // Validar se é base64 válido
                            if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
                                throw new Error('Base64 inválido');
                            }

                            const buffer = Buffer.from(base64Data, 'base64');

                            // Validar tamanho mínimo da imagem
                            if (buffer.length < 100) {
                                throw new Error('Imagem muito pequena');
                            }

                            // Gera nome do arquivo com timestamp mais preciso
                            const filename = `heatmap_ws_${sessionId}_${Date.now()}.webp`;
                            const filepath = path.join(UPLOAD_DIR, filename);

                            // Salva arquivo de forma síncrona (mais confiável para WebSocket)
                            fs.writeFileSync(filepath, buffer);

                            const processingTime = Date.now() - startTime;
                            console.log(`💾 Screenshot salvo: ${filename} (${(buffer.length / 1024).toFixed(2)} KB) - ${processingTime}ms`);

                            // Atualiza estatísticas
                            if (sessionStats.has(sessionId)) {
                                const stats = sessionStats.get(sessionId);
                                stats.imagesReceived++;
                                stats.lastActivity = Date.now();
                            }

                            // Broadcast para admin de forma otimizada
                            setImmediate(() => {
                                broadcastToAdmin('image_uploaded', {
                                    sessionId: sessionId,
                                    filename: filename,
                                    timestamp: Date.now()
                                });
                            });

                            // Notificar servidor principal de forma assíncrona
                            setImmediate(() => {
                                notifyMainServer(sessionId, filename, 'image');
                            });

                            // Responde confirmação imediata
                            const client = activeClients.get(sessionId);
                            if (client && client.ws.readyState === WebSocket.OPEN) {
                                client.ws.send(JSON.stringify({
                                    type: 'upload_success',
                                    filename: filename,
                                    size: buffer.length,
                                    processingTime: processingTime
                                }));
                            }

                        } catch (error) {
                            console.error('❌ Erro ao processar screenshot:', error);

                            // Responder com erro para o cliente
                            const client = activeClients.get(sessionId);
                            if (client && client.ws.readyState === WebSocket.OPEN) {
                                client.ws.send(JSON.stringify({
                                    type: 'upload_error',
                                    error: error.message,
                                    timestamp: Date.now()
                                }));
                            }
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error('❌ Erro ao processar mensagem WebSocket:', error);
        }
    });

    ws.on('close', () => {
        if (sessionId) {
            console.log(`🔌 Conexão WebSocket fechada: ${sessionId}`);

            // Log resumo da sessão ao fechar conexão
            logSessionSummary(sessionId);

            // Notificar servidor principal sobre desconexão
            notifyMainServer(sessionId, null, 'session_disconnect');

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
        if (client && client.ws.readyState === 1) { // WebSocket.OPEN
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
        console.log(`   🖱️  Pontos de Mouse: ${stats.mousePoints || 0}`);
        console.log(`   👆 Cliques: ${stats.clicks || 0}`);
        console.log(`   🌐 URL: ${stats.url}`);

        // Diagnosticar problemas se não há imagens
        if (stats.imagesReceived === 0) {
            console.log(`⚠️  DIAGNÓSTICO - Sessão ${sessionId} sem imagens:`);
            console.log(`   - Duração da sessão: ${duration}s`);
            console.log(`   - Última atividade: ${new Date(stats.lastActivity).toLocaleString()}`);
            console.log(`   - URL da sessão: ${stats.url}`);
            console.log(`   - Possíveis causas:`);
            console.log(`     • Flutter não está enviando imagens`);
            console.log(`     • Problemas de conectividade WebSocket`);
            console.log(`     • Sessão muito curta (< 10s)`);
            console.log(`     • Problemas no processo de captura`);

            // Verificar se há arquivos órfãos
            const orphanFiles = fs.readdirSync(UPLOAD_DIR).filter(file =>
                file.includes(sessionId)
            );

            if (orphanFiles.length > 0) {
                console.log(`   - Arquivos encontrados: ${orphanFiles.length}`);
                orphanFiles.forEach(file => {
                    console.log(`     📄 ${file}`);
                });
            } else {
                console.log(`   - Nenhum arquivo encontrado no diretório de uploads`);
            }
        }
    }
}

// Função para broadcast para admin
function broadcastToAdmin(eventType, data) {
    // Nota: Como este é o servidor dedicado WebSocket (porta 3002),
    // não temos conexão direta com o admin React.
    // O admin React se conecta ao servidor HTTP (porta 3001).
    // Para integração completa, seria necessário um sistema de comunicação entre servidores.
    console.log(`📡 Admin Event: ${eventType}`, data);

    // Nova funcionalidade: Notificar servidor da porta 3001
    if (eventType === 'image_uploaded' && data.sessionId && data.filename) {
        notifyMainServer(data.sessionId, data.filename);
    }
}

// Nova função para notificar o servidor principal sobre eventos importantes
function notifyMainServer(sessionId, filename, dataType = 'image') {
    try {
        const axios = require('axios');

        const payload = {
            sessionId,
            filename,
            dataType,
            timestamp: Date.now()
        };

        axios.post('http://localhost:3001/api/websocket-notify', payload)
            .then(response => {
                console.log(`🔗 Notificação enviada para servidor principal: ${response.status}`);
            })
            .catch(error => {
                console.error('Erro ao notificar servidor principal:', error.message);
            });

    } catch (error) {
        console.error('Erro ao enviar notificação:', error);
    }
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
            mousePoints: stats?.mousePoints || 0,
            clicks: stats?.clicks || 0,
            qualityMode: 'balanced', // Default
            uploading: false,
            url: stats?.url || 'unknown'
        };
    }

    return connections;
}

// Adicionar endpoint para diagnóstico de sessões
// (Será usado via HTTP GET)
const server = require('http').createServer((req, res) => {
    const url = require('url').parse(req.url, true);

    // Adicionar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (url.pathname === '/api/session-diagnostics') {
        const sessionId = url.query.sessionId;

        if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId é obrigatório' }));
            return;
        }

        // Buscar informações da sessão
        const sessionInfo = sessionStats.get(sessionId);
        const isActive = activeClients.has(sessionId);

        // Buscar arquivos relacionados
        const sessionFiles = fs.readdirSync(UPLOAD_DIR).filter(file =>
            file.includes(sessionId)
        );

        const diagnostics = {
            sessionId: sessionId,
            exists: !!sessionInfo,
            isActive: isActive,
            hasFiles: sessionFiles.length > 0,
            fileCount: sessionFiles.length,
            files: sessionFiles,
            sessionInfo: sessionInfo ? {
                startTime: new Date(sessionInfo.startTime),
                lastActivity: new Date(sessionInfo.lastActivity),
                imagesReceived: sessionInfo.imagesReceived,
                mousePoints: sessionInfo.mousePoints || 0,
                clicks: sessionInfo.clicks || 0,
                url: sessionInfo.url,
                duration: Math.round((Date.now() - sessionInfo.startTime) / 1000)
            } : null,
            server: {
                activeClients: activeClients.size,
                totalSessions: sessionStats.size,
                uploadDir: UPLOAD_DIR
            },
            timestamp: new Date().toISOString()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(diagnostics, null, 2));
        return;
    }

    if (url.pathname === '/api/status') {
        const status = {
            server: 'WebSocket Heatmap Server',
            port: WS_PORT,
            activeClients: activeClients.size,
            activeSessions: sessionStats.size,
            sessions: Array.from(sessionStats.entries()).map(([id, stats]) => ({
                sessionId: id,
                startTime: new Date(stats.startTime),
                lastActivity: new Date(stats.lastActivity),
                imagesReceived: stats.imagesReceived,
                url: stats.url,
                duration: Math.round((Date.now() - stats.startTime) / 1000)
            })),
            timestamp: new Date().toISOString()
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
        return;
    }

    if (url.pathname === '/api/session-cleanup' && req.method === 'POST') {
        const sessionId = url.query.sessionId;

        if (!sessionId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'sessionId é obrigatório' }));
            return;
        }

        console.log(`🧹 Limpeza solicitada para sessão: ${sessionId}`);

        // Remover sessão do WebSocket server
        if (activeClients.has(sessionId)) {
            const client = activeClients.get(sessionId);
            if (client.ws.readyState === 1) { // WebSocket.OPEN
                client.ws.close();
            }
            activeClients.delete(sessionId);
        }

        if (sessionStats.has(sessionId)) {
            sessionStats.delete(sessionId);
        }

        // Deletar arquivos locais da sessão
        try {
            const files = fs.readdirSync(UPLOAD_DIR);
            const sessionFiles = files.filter(file => file.includes(sessionId));
            let deletedCount = 0;

            sessionFiles.forEach(file => {
                try {
                    fs.unlinkSync(path.join(UPLOAD_DIR, file));
                    deletedCount++;
                } catch (err) {
                    console.error(`Erro ao deletar arquivo ${file}:`, err);
                }
            });

            console.log(`🧹 Sessão ${sessionId} limpa: ${deletedCount} arquivos removidos`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: `Sessão ${sessionId} limpa com sucesso`,
                deletedFiles: deletedCount
            }));
        } catch (error) {
            console.error('Erro ao limpar sessão:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Erro ao limpar sessão' }));
        }

        return;
    }

    // Endpoint padrão
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint não encontrado' }));
});

// Iniciar servidor HTTP na porta 3003 para diagnósticos
server.listen(3003, () => {
    console.log('🌐 Servidor HTTP para diagnósticos iniciado na porta 3003');
});

// Melhorar o processo de limpeza para registrar sessões órfãs
setInterval(() => {
    const now = Date.now();
    const maxInactivity = 60 * 60 * 1000; // 1 hora

    console.log(`🧹 Executando limpeza de sessões inativas...`);

    let cleanedSessions = 0;
    for (const [sessionId, stats] of sessionStats.entries()) {
        if (now - stats.lastActivity > maxInactivity) {
            console.log(`🧹 Limpando sessão inativa: ${sessionId}`);

            // Log resumo antes de limpar
            logSessionSummary(sessionId);

            activeClients.delete(sessionId);
            sessionStats.delete(sessionId);
            cleanedSessions++;
        }
    }

    if (cleanedSessions > 0) {
        console.log(`🧹 Limpeza concluída: ${cleanedSessions} sessões removidas`);
    }

    // Verificar arquivos órfãos
    try {
        const allFiles = fs.readdirSync(UPLOAD_DIR);
        const orphanFiles = allFiles.filter(file => {
            // Extrair sessionId do nome do arquivo
            const match = file.match(/^heatmap_ws_(.+)_(\d{13})\.(webp|jpeg|jpg|png)$/);
            if (match) {
                const sessionId = match[1];
                return !sessionStats.has(sessionId);
            }
            return false;
        });

        if (orphanFiles.length > 0) {
            console.log(`🗂️  Arquivos órfãos encontrados: ${orphanFiles.length}`);
            orphanFiles.forEach(file => {
                console.log(`   📄 ${file}`);
            });
        }
    } catch (error) {
        console.error('Erro ao verificar arquivos órfãos:', error);
    }
}, 10 * 60 * 1000); // A cada 10 minutos

// API de status
setInterval(() => {
    const activeSessionsCount = activeClients.size;
    const totalSessionsCount = sessionStats.size;

    if (activeSessionsCount > 0 || totalSessionsCount > 0) {
        console.log(`📈 Status: ${activeSessionsCount} clientes ativos, ${totalSessionsCount} sessões`);

        // Mostrar detalhes das sessões ativas
        if (totalSessionsCount > 0) {
            console.log(`📋 Sessões ativas:`);
            for (const [sessionId, stats] of sessionStats.entries()) {
                const duration = Math.round((Date.now() - stats.startTime) / 1000);
                const isActive = activeClients.has(sessionId);
                console.log(`   🔸 ${sessionId}: ${stats.imagesReceived} imagens, ${duration}s, ${isActive ? 'ativo' : 'inativo'}`);
            }
        }
    }
}, 60000); // Log a cada minuto

// Função para listar sessões (para diagnóstico)
function listAllSessions() {
    console.log(`\n📋 === DIAGNÓSTICO DE SESSÕES ===`);
    console.log(`📊 Total de sessões: ${sessionStats.size}`);
    console.log(`🔗 Clientes ativos: ${activeClients.size}`);
    console.log(`📂 Diretório de uploads: ${UPLOAD_DIR}`);

    if (sessionStats.size === 0) {
        console.log(`❌ Nenhuma sessão encontrada`);
        return;
    }

    // Listar arquivos no diretório
    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        console.log(`📄 Arquivos no diretório: ${files.length}`);

        for (const [sessionId, stats] of sessionStats.entries()) {
            const duration = Math.round((Date.now() - stats.startTime) / 1000);
            const isActive = activeClients.has(sessionId);

            // Buscar arquivos da sessão
            const sessionFiles = files.filter(file => file.includes(sessionId));

            console.log(`\n🔸 Sessão: ${sessionId}`);
            console.log(`   ⏱️  Duração: ${duration}s`);
            console.log(`   🔗 Ativo: ${isActive ? 'Sim' : 'Não'}`);
            console.log(`   📸 Imagens recebidas: ${stats.imagesReceived}`);
            console.log(`   📁 Arquivos encontrados: ${sessionFiles.length}`);
            console.log(`   🌐 URL: ${stats.url}`);
            console.log(`   📅 Início: ${new Date(stats.startTime).toLocaleString()}`);
            console.log(`   🕐 Última atividade: ${new Date(stats.lastActivity).toLocaleString()}`);

            if (sessionFiles.length > 0) {
                console.log(`   📄 Arquivos:`);
                sessionFiles.forEach(file => {
                    console.log(`      • ${file}`);
                });
            }

            if (stats.imagesReceived === 0) {
                console.log(`   ⚠️  PROBLEMA: Sessão sem imagens!`);
            }
        }
    } catch (error) {
        console.error(`❌ Erro ao listar arquivos:`, error);
    }

    console.log(`\n=== FIM DO DIAGNÓSTICO ===\n`);
}

// Comando para diagnóstico manual
process.on('SIGUSR1', () => {
    console.log('\n🔍 Diagnóstico manual solicitado...');
    listAllSessions();
});
