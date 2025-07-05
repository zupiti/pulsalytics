// Servidor Node.js simplificado para receber dados do heatmap via WebSocket
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configurar CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: false
}));

// Middleware para JSON
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Diretório para uploads
const UPLOAD_DIR = path.join(__dirname, 'upload');

// Garantir que a pasta upload existe
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const PORT = 3001;

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// Servir arquivos estáticos da pasta public (admin)
app.use('/admin', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// Servir o arquivo heatmap.js
app.get('/flutter_heatmap_tracker/web/heatmap.js', (req, res) => {
    const heatmapPath = path.join(__dirname, '../flutter_heatmap_tracker/web/heatmap.js');
    if (fs.existsSync(heatmapPath)) {
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(heatmapPath);
    } else {
        res.status(404).send('heatmap.js not found');
    }
});

// Endpoint para listar arquivos da pasta upload
app.get('/api/uploads', (req, res) => {
    try {
        const files = fs.readdirSync(UPLOAD_DIR);

        // Filtrar apenas arquivos de imagem WebP
        const imageFiles = files.filter(file => file.endsWith('.webp'));

        const fileList = imageFiles.map(filename => {
            const filePath = path.join(UPLOAD_DIR, filename);
            const stats = fs.statSync(filePath);

            // Extrair informações do nome do arquivo
            // Formato esperado: sessionId_timestamp.webp ou sessionId_suffix_timestamp.webp
            const parts = filename.replace('.webp', '').split('_');
            let sessionId = null;
            let timestamp = null;

            if (parts.length >= 2) {
                sessionId = parts[0];
                // O timestamp é sempre a última parte
                timestamp = parts[parts.length - 1];
            }

            // Tentar encontrar arquivo JSON correspondente para obter metadados
            const jsonFilename = filename.replace('.webp', '.json');
            const jsonPath = path.join(UPLOAD_DIR, jsonFilename);

            let metadata = null;
            try {
                if (fs.existsSync(jsonPath)) {
                    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
                    metadata = JSON.parse(jsonContent);
                }
            } catch (error) {
                console.error('Erro ao ler metadados:', error);
            }

            return {
                filename,
                sessionId,
                timestamp: timestamp ? parseInt(timestamp) : stats.mtime.getTime(),
                size: stats.size,
                url: `/uploads/${filename}`,
                metadata: metadata,
                positions: metadata?.positions || [],
                clickPoints: metadata?.clickPoints || [],
                originalUrl: metadata?.url || '',
                hasMetadata: !!metadata
            };
        });

        // Agrupar por sessionId
        const grouped = {};
        fileList.forEach(file => {
            if (file.sessionId && !grouped[file.sessionId]) {
                grouped[file.sessionId] = [];
            }
            if (file.sessionId) {
                grouped[file.sessionId].push(file);
            }
        });

        // Ordenar cada grupo por timestamp (mais recente primeiro)
        Object.keys(grouped).forEach(sessionId => {
            grouped[sessionId].sort((a, b) => b.timestamp - a.timestamp);
        });

        res.json(grouped);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao listar arquivos' });
    }
});

// Endpoint para deletar sessão
app.delete('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    try {
        const files = fs.readdirSync(UPLOAD_DIR);
        const sessionFiles = files.filter(file => file.startsWith(sessionId + '_'));

        let deletedCount = 0;
        sessionFiles.forEach(file => {
            try {
                fs.unlinkSync(path.join(UPLOAD_DIR, file));
                deletedCount++;
            } catch (err) {
                console.error(`Erro ao deletar arquivo ${file}:`, err);
            }
        });

        res.json({
            success: true,
            deletedFiles: deletedCount,
            message: `Sessão ${sessionId} deletada com sucesso`
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar sessão' });
    }
});

// Iniciar servidor HTTP
server.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}/admin`);
});

// Criar servidor WebSocket para receber dados do heatmap
const wss = new WebSocket.Server({ port: 3002 });

console.log(`📡 WebSocket Server iniciado na porta 3002`);

// WebSocket para receber dados do heatmap
wss.on('connection', (ws) => {
    let currentSession = null; // Armazenar dados da sessão atual

    ws.on('message', (message) => {
        try {
            // Verificar se é JSON (metadados) ou ArrayBuffer (imagem)
            if (message instanceof Buffer) {
                try {
                    const data = JSON.parse(message.toString());

                    // Processar metadados
                    if (data.type === 'heatmap_metadata') {
                        // Validar formato esperado
                        if (!data.sessionId || !data.timestamp || !data.url) {
                            return;
                        }

                        // Armazenar dados da sessão para quando a imagem chegar
                        currentSession = {
                            sessionId: data.sessionId,
                            timestamp: data.timestamp,
                            url: data.url,
                            positions: Array.isArray(data.positions) ? data.positions : [],
                            clickPoints: Array.isArray(data.clickPoints) ? data.clickPoints : [],
                            imageSize: data.imageSize,
                            imageType: data.imageType,
                            waitingForImage: true
                        };
                    }
                } catch (parseError) {
                    // Se não conseguir fazer parse, é provavelmente um ArrayBuffer (imagem)
                    if (currentSession && currentSession.waitingForImage) {
                        // Processar imagem recebida
                        const imageData = message;

                        // Salvar imagem
                        const imageFilename = `${currentSession.sessionId}_${currentSession.timestamp}.webp`;
                        const imageFilePath = path.join(UPLOAD_DIR, imageFilename);

                        try {
                            fs.writeFileSync(imageFilePath, imageData);

                            // Salvar metadados em JSON
                            const jsonData = {
                                sessionId: currentSession.sessionId,
                                timestamp: currentSession.timestamp,
                                url: currentSession.url,
                                positions: currentSession.positions,
                                clickPoints: currentSession.clickPoints,
                                savedAt: Date.now(),
                                hasImage: true,
                                imageFilename: imageFilename
                            };

                            const jsonFilename = `${currentSession.sessionId}_${currentSession.timestamp}.json`;
                            const jsonFilePath = path.join(UPLOAD_DIR, jsonFilename);
                            fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));

                            // Notificar admin sobre novos dados
                            broadcastToAdmin({
                                type: 'new_data',
                                sessionId: currentSession.sessionId,
                                timestamp: currentSession.timestamp,
                                filename: jsonFilename,
                                imageFilename: imageFilename
                            });

                            // Limpar sessão atual
                            currentSession = null;

                        } catch (error) {
                            console.error('Erro ao salvar imagem:', error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
        }
    });

    ws.on('close', () => {
    });

    ws.on('error', (error) => {
        console.error('❌ Erro WebSocket:', error);
    });
});

// Criar servidor WebSocket para admin (comunicação com React)
const adminWss = new WebSocket.Server({ port: 3004 });

console.log(`📡 WebSocket Admin iniciado na porta 3004`);

const adminConnections = new Set();

adminWss.on('connection', (ws) => {
    console.log('✅ Nova conexão WebSocket Admin');
    adminConnections.add(ws);

    ws.on('close', () => {
        console.log('🔌 Conexão WebSocket Admin fechada');
        adminConnections.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('❌ Erro WebSocket Admin:', error);
        adminConnections.delete(ws);
    });
});

// Função para broadcast para admin
function broadcastToAdmin(message) {
    const messageStr = JSON.stringify(message);

    adminConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageStr);
            } catch (error) {
                console.error('Erro ao enviar mensagem para admin:', error);
                adminConnections.delete(ws);
            }
        }
    });
} 