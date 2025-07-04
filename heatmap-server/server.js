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
    if (match) {
        const sessionInfo = match[2];
        sessionStatus.set(sessionInfo, {
            status: 'active',
            lastActivity: Date.now(),
            totalImages: (sessionStatus.get(sessionInfo)?.totalImages || 0) + 1
        });
    }

    res.json({ success: true, filename: req.file.filename });
    broadcastNewImage();
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

// Endpoint para obter status das sessões
app.get('/api/session-status', (req, res) => {
    const statusObj = {};
    sessionStatus.forEach((value, key) => {
        statusObj[key] = value;
    });
    res.json(statusObj);
});

// Endpoint para deletar uma sessão e suas imagens
app.delete('/api/session/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    try {
        // Buscar todas as imagens da sessão
        const files = fs.readdirSync(UPLOAD_DIR);
        const sessionFiles = files.filter(file => {
            const match = file.match(/^heatmap(_fast)?_(.+)_(\d{13})_\d+\./);
            return match && match[2] === sessionId;
        });

        // Deletar arquivos físicos
        let deletedCount = 0;
        sessionFiles.forEach(file => {
            try {
                fs.unlinkSync(path.join(UPLOAD_DIR, file));
                deletedCount++;
            } catch (err) {
                console.error(`Erro ao deletar arquivo ${file}:`, err);
            }
        });

        // Remover do status de sessões
        sessionStatus.delete(sessionId);

        // Broadcast para todos os clientes
        broadcastSessionEvent('session_deleted', sessionId);

        res.json({
            success: true,
            deletedFiles: deletedCount,
            message: `Sessão ${sessionId} deletada com sucesso`
        });

        console.log(`Sessão ${sessionId} deletada: ${deletedCount} arquivos removidos`);

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
app.get('/api/images', (req, res) => {
    fs.readdir(UPLOAD_DIR, (err, files) => {
        if (err) return res.status(500).json({ error: 'Erro ao listar imagens' });
        files = files.filter(f => f.startsWith('heatmap_'));
        // Agrupa por sessionId extraído do nome
        const groups = {};
        files.forEach(file => {
            // Padrão: heatmap_[sessionInfo]_[timestamp].ext
            // Extrair tudo entre 'heatmap_' e o último '_[timestamp]'
            const match = file.match(/^heatmap_(.+)_(\d{13})_\d+\.(webp|jpeg|jpg|png)$/);
            if (match) {
                const sessionInfo = match[1]; // Tudo antes do timestamp final
                const timestamp = match[2];

                // Agrupa por sessionInfo (que pode incluir URL e página)
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

        res.json(groups);
    });
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

const server = app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}/admin`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

function broadcastNewImage() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'new-image' }));
        }
    });
}

function broadcastSessionEvent(eventType, sessionId) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: eventType,
                sessionId: sessionId,
                timestamp: Date.now()
            }));
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