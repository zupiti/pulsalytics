// Servidor Node.js para receber uploads de imagens do heatmap e exibir via interface admin
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(express.json()); // Para receber JSON

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Servir também arquivos da pasta uploads do servidor WebSocket
app.use('/uploads', express.static(path.join(__dirname, '../websocket-server/uploads')));

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Servir o arquivo heatmap.js da pasta flutter_heatmap_tracker/web/
app.get('/heatmap.js', (req, res) => {
    const heatmapPath = path.join(__dirname, '../flutter_heatmap_tracker/web/heatmap.js');
    if (fs.existsSync(heatmapPath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(heatmapPath);
    } else {
        res.status(404).send('heatmap.js not found');
    }
});

// Servir arquivos estáticos da pasta flutter_heatmap_tracker/web/
app.use('/web', express.static(path.join(__dirname, '../flutter_heatmap_tracker/web')));

const PORT = 3001;

// Armazenar status das sessões em memória
const sessionStatus = new Map();

// Pasta para uploads
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Configuração do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        // Usa o nome original ou gera um nome único
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext);
        const unique = `${base}_${Date.now()}${ext}`;
        cb(null, unique);
    }
});
const upload = multer({ storage });

// Permite uploads via POST /upload
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Extrair sessionId do nome do arquivo para atualizar status
    const match = req.file.filename.match(/^heatmap(_fast)?_(.+)_(\d{13})_\d+\./);
    let sessionInfo = null;
    if (match) {
        sessionInfo = match[2];
        sessionStatus.set(sessionInfo, {
            status: 'active',
            lastActivity: Date.now(),
            totalImages: (sessionStatus.get(sessionInfo)?.totalImages || 0) + 1
        });
    }

    res.json({ success: true, filename: req.file.filename });

    // Broadcast específico da nova imagem com informações da sessão
    broadcastNewImage(sessionInfo, req.file.filename);
});

// Endpoint para receber eventos de sessão
app.post('/session-event', upload.none(), (req, res) => {
    const { sessionId, eventType, timestamp } = req.body;

    console.log(`Session event received: ${eventType} for session ${sessionId}`);

    if (eventType === 'session_end') {
        sessionStatus.set(sessionId, {
            status: 'disconnected',
            lastActivity: parseInt(timestamp),
            disconnectedAt: Date.now()
        });

        // Broadcast para todos os clientes conectados
        broadcastSessionEvent('session_disconnected', sessionId);
    }

    res.json({ success: true });
});

// Novo endpoint para receber notificações do servidor WebSocket (porta 3002)
app.post('/api/websocket-notify', (req, res) => {
    const { sessionId, filename, dataType, timestamp } = req.body;

    console.log(`🔗 Notificação recebida do WebSocket server: ${dataType || 'new-image'} para sessão ${sessionId}`);

    if (sessionId) {
        // Atualizar status da sessão
        sessionStatus.set(sessionId, {
            status: 'active',
            lastActivity: timestamp || Date.now(),
            totalImages: (sessionStatus.get(sessionId)?.totalImages || 0) + (dataType === 'image' ? 1 : 0)
        });

        // Broadcast para todos os clientes React conectados
        if (filename) {
            broadcastNewImage(sessionId, filename);
        }
    }

    res.json({ success: true });
});

// Endpoint para obter status das sessões
app.get('/api/session-status', (req, res) => {
    const statusObj = {};
    sessionStatus.forEach((value, key) => {
        statusObj[key] = value;
    });
    res.json(statusObj);
});

// Endpoint para deletar uma sessão e suas imagens
app.delete('/api/session/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        console.log(`🗑️ Iniciando deleção da sessão: ${sessionId}`);

        // Buscar todas as imagens da sessão em ambos os diretórios
        const wsUploadsDir = path.join(__dirname, 'uploads');
        const mainUploadsDir = UPLOAD_DIR;

        let deletedCount = 0;

        // Deletar arquivos do diretório principal
        if (fs.existsSync(mainUploadsDir)) {
            const mainFiles = fs.readdirSync(mainUploadsDir);
            const mainSessionFiles = mainFiles.filter(file => {
                return file.includes(sessionId);
            });

            mainSessionFiles.forEach(file => {
                try {
                    fs.unlinkSync(path.join(mainUploadsDir, file));
                    deletedCount++;
                    console.log(`🗑️ Arquivo deletado (main): ${file}`);
                } catch (err) {
                    console.error(`Erro ao deletar arquivo ${file}:`, err);
                }
            });
        }

        // Deletar arquivos do diretório WebSocket
        if (fs.existsSync(wsUploadsDir)) {
            const wsFiles = fs.readdirSync(wsUploadsDir);
            const wsSessionFiles = wsFiles.filter(file => {
                return file.includes(sessionId);
            });

            wsSessionFiles.forEach(file => {
                try {
                    fs.unlinkSync(path.join(wsUploadsDir, file));
                    deletedCount++;
                    console.log(`🗑️ Arquivo deletado (ws): ${file}`);
                } catch (err) {
                    console.error(`Erro ao deletar arquivo ${file}:`, err);
                }
            });
        }

        // Remover do status de sessões
        sessionStatus.delete(sessionId);

        // Notificar o servidor WebSocket para remover a sessão também
        try {
            const wsResponse = await fetch(`http://localhost:3003/api/session-cleanup?sessionId=${sessionId}`, {
                method: 'POST'
            });
            if (wsResponse.ok) {
                console.log(`📡 Sessão ${sessionId} removida do WebSocket server`);
            }
        } catch (error) {
            console.warn('⚠️ Não foi possível notificar o WebSocket server:', error.message);
        }

        // Broadcast para todos os clientes
        broadcastSessionEvent('session_deleted', sessionId);

        res.json({
            success: true,
            deletedFiles: deletedCount,
            message: `Sessão ${sessionId} deletada com sucesso`
        });

        console.log(`✅ Sessão ${sessionId} deletada: ${deletedCount} arquivos removidos`);

    } catch (error) {
        console.error('Erro ao deletar sessão:', error);
        res.status(500).json({
            error: 'Erro ao deletar sessão',
            details: error.message
        });
    }
});

// Servir imagens
app.use('/uploads', express.static(UPLOAD_DIR));

// Servir interface admin
app.use('/admin', express.static(path.join(__dirname, 'public')));

// Endpoint para listar imagens agrupadas por sessionId
app.get('/api/images', async (req, res) => {
    const wsUploadsDir = path.join(__dirname, 'uploads'); // Pasta do servidor WebSocket
    const mainUploadsDir = UPLOAD_DIR; // Pasta do servidor principal

    // Função para processar arquivos de um diretório
    const processFiles = (dir) => {
        if (!fs.existsSync(dir)) return [];
        try {
            const files = fs.readdirSync(dir);
            return files.filter(f => f.startsWith('heatmap_') || f.startsWith('heatmap_ws_'));
        } catch (error) {
            console.error(`Erro ao ler diretório ${dir}:`, error);
            return [];
        }
    };

    try {
        // Buscar arquivos de ambos os diretórios
        const mainFiles = processFiles(mainUploadsDir);
        const wsFiles = processFiles(wsUploadsDir);
        const allFiles = [...mainFiles, ...wsFiles];

        // Agrupa por sessionId extraído do nome
        const groups = {};
        allFiles.forEach(file => {
            // Padrões: heatmap_[sessionInfo]_[timestamp].ext ou heatmap_ws_[sessionId]_[timestamp].ext
            let match = file.match(/^heatmap_ws_(.+)_(\d{13})\.(webp|jpeg|jpg|png)$/);
            if (!match) {
                match = file.match(/^heatmap_(.+)_(\d{13})_\d+\.(webp|jpeg|jpg|png)$/);
            }

            if (match) {
                const sessionInfo = match[1]; // SessionId ou sessionInfo
                const timestamp = match[2];

                // Agrupa por sessionInfo
                if (!groups[sessionInfo]) groups[sessionInfo] = [];
                groups[sessionInfo].push({
                    filename: file,
                    timestamp: parseInt(timestamp),
                    url: `/uploads/${file}`
                });
            }
        });

        // Ordena cada grupo por timestamp
        for (const sessionId in groups) {
            groups[sessionId].sort((a, b) => b.timestamp - a.timestamp);
        }

        // Buscar sessões ativas do servidor WebSocket
        try {
            const wsResponse = await fetch('http://localhost:3003/api/status');
            if (wsResponse.ok) {
                const wsData = await wsResponse.json();

                // Incluir sessões ativas do WebSocket mesmo sem imagens
                wsData.sessions?.forEach(session => {
                    if (!groups[session.sessionId]) {
                        groups[session.sessionId] = []; // Sessão vazia mas ativa

                        // Atualizar status da sessão
                        sessionStatus.set(session.sessionId, {
                            status: 'active',
                            lastActivity: Date.now(),
                            totalImages: session.imagesReceived || 0
                        });
                    }
                });

                console.log(`📡 Sincronizadas ${wsData.sessions?.length || 0} sessões do WebSocket server`);
            }
        } catch (error) {
            console.warn('⚠️ Não foi possível sincronizar com o WebSocket server:', error.message);
        }

        res.json(groups);
    } catch (err) {
        console.error('Erro ao listar imagens:', err);
        res.status(500).json({ error: 'Erro ao listar imagens' });
    }
});

// Endpoint para gerar vídeo de uma sessão
app.get('/api/video/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: 'Erro ao listar imagens' });

        // Filtra arquivos da sessão específica
        const sessionFiles = files.filter(file => {
            const match = file.match(/^heatmap_(.+)_(\d{13})_\d+\.(webp|jpeg|jpg|png)$/);
            return match && match[1] === sessionId;
        });

        if (sessionFiles.length === 0) {
            return res.status(404).json({ error: 'Nenhuma imagem encontrada para esta sessão' });
        }

        // Ordena por timestamp
        sessionFiles.sort((a, b) => {
            const aMatch = a.match(/^heatmap_.+_(\d{13})_\d+\./);
            const bMatch = b.match(/^heatmap_.+_(\d{13})_\d+\./);
            const aTime = aMatch ? parseInt(aMatch[1]) : 0;
            const bTime = bMatch ? parseInt(bMatch[1]) : 0;
            return aTime - bTime;
        });

        res.json({
            sessionId,
            images: sessionFiles.map(file => ({
                filename: file,
                url: `/uploads/${file}`,
                timestamp: parseInt(file.match(/^heatmap_.+_(\d{13})_\d+\./)[1])
            })),
            totalImages: sessionFiles.length
        });
    });
});

// Novo endpoint para obter dados de mouse por sessão
app.get('/api/mouse-data/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    try {
        // Buscar todos os arquivos de dados de mouse para a sessão
        const mouseDataFiles = fs.readdirSync(UPLOAD_DIR)
            .filter(file => file.includes(sessionId) && file.endsWith('.mouse.json'));

        let allMouseData = [];

        mouseDataFiles.forEach(file => {
            try {
                const filePath = path.join(UPLOAD_DIR, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (Array.isArray(data)) {
                    allMouseData = allMouseData.concat(data);
                }
            } catch (error) {
                console.error(`Erro ao ler arquivo de mouse ${file}:`, error);
            }
        });

        // Ordenar por timestamp
        allMouseData.sort((a, b) => a.timestamp - b.timestamp);

        console.log(`📊 Dados de mouse para sessão ${sessionId}: ${allMouseData.length} pontos`);
        res.json(allMouseData);

    } catch (error) {
        console.error('Erro ao buscar dados de mouse:', error);
        res.json([]);
    }
});

// Novo endpoint para obter dados de cliques por sessão
app.get('/api/click-data/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    try {
        // Buscar todos os arquivos de dados de cliques para a sessão
        const clickDataFiles = fs.readdirSync(UPLOAD_DIR)
            .filter(file => file.includes(sessionId) && file.endsWith('.clicks.json'));

        let allClickData = [];

        clickDataFiles.forEach(file => {
            try {
                const filePath = path.join(UPLOAD_DIR, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (Array.isArray(data)) {
                    allClickData = allClickData.concat(data);
                }
            } catch (error) {
                console.error(`Erro ao ler arquivo de cliques ${file}:`, error);
            }
        });

        // Ordenar por timestamp
        allClickData.sort((a, b) => a.timestamp - b.timestamp);

        console.log(`🖱️ Dados de cliques para sessão ${sessionId}: ${allClickData.length} cliques`);
        res.json(allClickData);

    } catch (error) {
        console.error('Erro ao buscar dados de cliques:', error);
        res.json([]);
    }
});

// Novo endpoint para estatísticas de heatmap por sessão
app.get('/api/heatmap-stats/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    try {
        // Buscar dados de mouse e cliques
        const mouseDataFiles = fs.readdirSync(UPLOAD_DIR)
            .filter(file => file.includes(sessionId) && file.endsWith('.mouse.json'));
        const clickDataFiles = fs.readdirSync(UPLOAD_DIR)
            .filter(file => file.includes(sessionId) && file.endsWith('.clicks.json'));

        let totalMousePoints = 0;
        let totalClicks = 0;
        let sessionDuration = 0;
        let firstTimestamp = null;
        let lastTimestamp = null;

        // Processar dados de mouse
        mouseDataFiles.forEach(file => {
            try {
                const filePath = path.join(UPLOAD_DIR, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (Array.isArray(data)) {
                    totalMousePoints += data.length;
                    data.forEach(point => {
                        if (!firstTimestamp || point.timestamp < firstTimestamp) {
                            firstTimestamp = point.timestamp;
                        }
                        if (!lastTimestamp || point.timestamp > lastTimestamp) {
                            lastTimestamp = point.timestamp;
                        }
                    });
                }
            } catch (error) {
                console.error(`Erro ao processar ${file}:`, error);
            }
        });

        // Processar dados de cliques
        clickDataFiles.forEach(file => {
            try {
                const filePath = path.join(UPLOAD_DIR, file);
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (Array.isArray(data)) {
                    totalClicks += data.length;
                }
            } catch (error) {
                console.error(`Erro ao processar ${file}:`, error);
            }
        });

        if (firstTimestamp && lastTimestamp) {
            sessionDuration = lastTimestamp - firstTimestamp;
        }

        const stats = {
            sessionId,
            totalMousePoints,
            totalClicks,
            sessionDuration,
            avgMousePointsPerSecond: sessionDuration > 0 ? totalMousePoints / (sessionDuration / 1000) : 0,
            avgClicksPerMinute: sessionDuration > 0 ? totalClicks / (sessionDuration / 60000) : 0,
            firstActivity: firstTimestamp ? new Date(firstTimestamp).toISOString() : null,
            lastActivity: lastTimestamp ? new Date(lastTimestamp).toISOString() : null
        };

        console.log(`📈 Estatísticas de heatmap para sessão ${sessionId}:`, stats);
        res.json(stats);

    } catch (error) {
        console.error('Erro ao calcular estatísticas de heatmap:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Endpoint para obter informações detalhadas de uma sessão
app.get('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    try {
        const wsUploadsDir = path.join(__dirname, 'uploads');
        const mainUploadsDir = UPLOAD_DIR;

        // Verificar se a sessão existe em memória
        const sessionInfo = sessionStatus.get(sessionId);

        // Buscar arquivos da sessão
        const processFiles = (dir) => {
            if (!fs.existsSync(dir)) return [];
            try {
                const files = fs.readdirSync(dir);
                return files.filter(f => f.includes(sessionId));
            } catch (error) {
                return [];
            }
        };

        const mainFiles = processFiles(mainUploadsDir);
        const wsFiles = processFiles(wsUploadsDir);
        const allFiles = [...mainFiles, ...wsFiles];

        const result = {
            sessionId: sessionId,
            exists: !!sessionInfo || allFiles.length > 0,
            hasImages: allFiles.length > 0,
            imageCount: allFiles.length,
            status: sessionInfo?.status || 'unknown',
            lastActivity: sessionInfo?.lastActivity || null,
            files: allFiles.map(file => ({
                filename: file,
                url: `/uploads/${file}`
            }))
        };

        if (!result.exists) {
            return res.status(404).json({
                error: 'Sessão não encontrada',
                message: `A sessão "${sessionId}" não foi encontrada no sistema`,
                sessionId: sessionId
            });
        }

        if (!result.hasImages) {
            return res.json({
                ...result,
                message: `A sessão "${sessionId}" existe mas não possui imagens`,
                possibleReasons: [
                    'Sessão ainda não começou a capturar imagens',
                    'Problemas na comunicação com o Flutter',
                    'Sessão foi criada mas não enviou dados',
                    'Arquivos foram deletados ou corrompidos'
                ]
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Erro ao buscar informações da sessão:', error);
        res.status(500).json({
            error: 'Erro interno do servidor',
            sessionId: sessionId
        });
    }
});

const server = app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}/admin`);
});

// Criar servidor WebSocket para comunicação com React Admin
const wssAdmin = new WebSocket.Server({ port: 3004 }); // Usar porta 3004 para WebSocket admin

console.log(`📡 WebSocket Server (Admin) iniciado na porta 3004`);

// Array para manter conexões WebSocket abertas
const adminConnections = new Set();

wssAdmin.on('connection', (ws) => {
    console.log('✅ Nova conexão WebSocket do Admin');
    adminConnections.add(ws);

    ws.on('close', () => {
        console.log('🔌 Conexão WebSocket do Admin fechada');
        adminConnections.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('❌ Erro WebSocket Admin:', error);
        adminConnections.delete(ws);
    });
});

function broadcastNewImage(sessionId = null, filename = null) {
    const message = JSON.stringify({
        type: 'new_image',
        sessionId: sessionId,
        filename: filename,
        timestamp: Date.now()
    });

    // Broadcast para todas as conexões WebSocket ativas
    adminConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(message);
                console.log(`📤 Broadcast enviado: nova imagem (${filename})`);
            } catch (error) {
                console.error('Erro ao enviar broadcast:', error);
                adminConnections.delete(ws);
            }
        }
    });
}

function broadcastSessionEvent(eventType, sessionId) {
    const message = JSON.stringify({
        type: eventType,
        sessionId: sessionId,
        timestamp: Date.now()
    });

    // Broadcast para todas as conexões WebSocket ativas
    adminConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(message);
                console.log(`📤 Broadcast enviado: ${eventType} (${sessionId})`);
            } catch (error) {
                console.error('Erro ao enviar broadcast:', error);
                adminConnections.delete(ws);
            }
        }
    });
}

// Limpar sessões inativas periodicamente (mais de 30 minutos sem atividade)
setInterval(() => {
    const now = Date.now();
    const maxInactivity = 30 * 60 * 1000; // 30 minutos

    sessionStatus.forEach((status, sessionId) => {
        if (now - status.lastActivity > maxInactivity) {
            console.log(`Removendo sessão inativa: ${sessionId}`);
            sessionStatus.delete(sessionId);
        }
    });
}, 5 * 60 * 1000); // Verificar a cada 5 minutos 