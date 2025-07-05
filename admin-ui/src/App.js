import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import {
  Box, CircularProgress, AppBar, CssBaseline, Toolbar, Typography
} from '@mui/material';

// Importar componentes
import { Sidebar } from './components/Sidebar';
import OverviewPage from './pages/OverviewPage';
import SessionsPage from './pages/SessionsPage';
import PlayerPage from './pages/PlayerPage';

// CSS para animações
const styles = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

// Inserir CSS no head se ainda não existir
if (!document.querySelector('#clarity-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'clarity-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

const drawerWidth = 280;

// Componente principal da aplicação com router
function AppContent() {
  const navigate = useNavigate();

  // Estados principais
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState(new Map());
  const [disconnectedSessions, setDisconnectedSessions] = useState(new Set());

  // Estados do player
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(42); // ms between frames (24 FPS)

  // Estados WebSocket
  const [wsServerConnected, setWsServerConnected] = useState(false);

  const videoIntervalRef = useRef(null);
  const wsRef = useRef(null);

  // Configurações com variáveis de ambiente
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Função para buscar dados da API
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/uploads`);
      if (response.ok) {
        const data = await response.json();
        console.log('Dados recebidos:', data);

        // Processar dados - agora o servidor já retorna apenas imagens WebP
        const processedGroups = {};

        Object.keys(data).forEach(sessionId => {
          const files = data[sessionId];

          if (files.length > 0) {
            processedGroups[sessionId] = files.map(file => ({
              filename: file.filename,
              timestamp: file.timestamp,
              url: file.url,
              positions: file.positions || [],
              clickPoints: file.clickPoints || [],
              originalUrl: file.originalUrl || '',
              hasMetadata: file.hasMetadata || false,
              metadata: file.metadata
            }));
          }
        });

        setGroups(processedGroups);

        // Calcular estatísticas das sessões
        const stats = new Map();
        Object.keys(processedGroups).forEach(sessionId => {
          const images = processedGroups[sessionId];
          if (images.length > 0) {
            const firstImage = images[images.length - 1];
            const lastImage = images[0];

            stats.set(sessionId, {
              sessionId,
              totalImages: images.length,
              startTime: new Date(firstImage.timestamp),
              endTime: new Date(lastImage.timestamp),
              lastImageTime: new Date(lastImage.timestamp),
              duration: lastImage.timestamp - firstImage.timestamp,
              isActive: true,
              totalPositions: images.reduce((sum, img) => sum + (img.positions?.length || 0), 0),
              totalClicks: images.reduce((sum, img) => sum + (img.clickPoints?.length || 0), 0),
              hasMetadata: images.some(img => img.hasMetadata)
            });
          }
        });

        setSessionStats(stats);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  // Função para deletar sessão
  const deleteSession = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${apiUrl}/api/session/${sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log(`Sessão ${sessionId} deletada com sucesso`);
        await fetchData(); // Recarregar dados
      }
    } catch (error) {
      console.error('Erro ao deletar sessão:', error);
    }
  }, [apiUrl, fetchData]);

  // Conectar WebSocket para atualizações em tempo real
  useEffect(() => {
    fetchData();

    // Configurar WebSocket para atualizações
    const wsUrl = `ws://localhost:3004`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket conectado');
      setWsServerConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'new_data') {
          console.log('📡 Novos dados recebidos:', data);
          fetchData(); // Recarregar dados quando houver novos dados
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };

    ws.onclose = () => {
      console.log('🔌 WebSocket desconectado');
      setWsServerConnected(false);
    };

    ws.onerror = (error) => {
      console.error('❌ Erro WebSocket:', error);
      setWsServerConnected(false);
    };

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [fetchData]);

  // Handlers para o player
  const handlePlayPause = useCallback((currentImages) => {
    if (isPlaying) {
      clearInterval(videoIntervalRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      videoIntervalRef.current = setInterval(() => {
        setCurrentImageIndex(prev => {
          // Usar as imagens da sessão específica que está sendo reproduzida
          const totalImages = currentImages ? currentImages.length : 0;
          // Se chegou no último frame, para a reprodução
          if (prev >= totalImages - 1) {
            clearInterval(videoIntervalRef.current);
            setIsPlaying(false);
            return prev; // Mantém no último frame
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
  }, [isPlaying, playbackSpeed]);

  const handleStop = useCallback(() => {
    clearInterval(videoIntervalRef.current);
    setIsPlaying(false);
    setCurrentImageIndex(0);
  }, []);

  // Handlers para navegação
  const handleSelectSession = useCallback((sessionId) => {
    navigate(`/online-session/${sessionId}`);
  }, [navigate]);

  const handleCreateVideo = useCallback((sessionId) => {
    navigate(`/online-session/${sessionId}`);
    setCurrentImageIndex(0);
  }, [navigate]);

  // Memoizar dados derivados
  const sessionIds = useMemo(() => groups ? Object.keys(groups) : [], [groups]);

  // Memoizar sessões ordenadas por atividade
  const sortedSessionIds = useMemo(() => {
    if (!groups || !sessionStats) return sessionIds;

    return sessionIds.sort((a, b) => {
      const aStats = sessionStats.get(a);
      const bStats = sessionStats.get(b);

      if (!aStats || !bStats) return 0;

      // Ordenar por última atividade (mais recente primeiro)
      const aLastActivity = aStats.lastImageTime?.getTime() || 0;
      const bLastActivity = bStats.lastImageTime?.getTime() || 0;
      return bLastActivity - aLastActivity;
    });
  }, [sessionIds, sessionStats, groups]);

  // Preparar dados das estatísticas
  const preparedSessionStats = useMemo(() => {
    const totalSessions = sessionIds.length;
    const totalImages = sessionIds.reduce((sum, sessionId) => {
      const sessionData = groups[sessionId];
      return sum + (sessionData ? sessionData.length : 0);
    }, 0);

    const sessionDetails = {};
    sessionStats.forEach((stats, sessionId) => {
      sessionDetails[sessionId] = stats;
    });

    return {
      totalSessions,
      totalImages,
      totalClicks: 0, // Será calculado quando implementarmos cliques
      avgSessionTime: 0, // Será calculado quando implementarmos duração
      sessionDetails
    };
  }, [sessionIds, groups, sessionStats]);

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#222' }}>
        <Toolbar>
          <Typography variant="h5" noWrap component="div">
            📊 Clarity Analytics Platform
          </Typography>
        </Toolbar>
      </AppBar>

      <Sidebar
        sortedSessionIds={sortedSessionIds}
        groups={groups}
        sessionStats={preparedSessionStats}
        disconnectedSessions={disconnectedSessions}
      />

      <Box component="main" sx={{ flexGrow: 1, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar />

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
            <CircularProgress />
          </Box>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <OverviewPage
                  sessionStats={preparedSessionStats}
                  lastUpdateTime={Date.now()}
                  wsStats={{
                    totalMessages: 0,
                    imagesReceived: preparedSessionStats.totalImages,
                    activeConnections: sortedSessionIds.length,
                    serverStatus: wsServerConnected ? 'connected' : 'disconnected'
                  }}
                />
              }
            />
            <Route
              path="/sessions"
              element={
                <SessionsPage
                  sessionStats={preparedSessionStats}
                  groups={groups}
                  selectedSession={null}
                  onSelectSession={handleSelectSession}
                  onCreateVideo={handleCreateVideo}
                  onDeleteSession={deleteSession}
                  disconnectedSessions={disconnectedSessions}
                  sessionStatus={{}}
                />
              }
            />
            <Route
              path="/online-session/:sessionId"
              element={
                <PlayerPage
                  groups={groups}
                  isPlaying={isPlaying}
                  currentImageIndex={currentImageIndex}
                  playbackSpeed={playbackSpeed}
                  onPlayPause={handlePlayPause}
                  onStop={handleStop}
                  onIndexChange={setCurrentImageIndex}
                  onSpeedChange={setPlaybackSpeed}
                  onDeleteSession={deleteSession}
                  sessionStats={preparedSessionStats}
                  disconnectedSessions={disconnectedSessions}
                  sessionStatus={{}}
                />
              }
            />
          </Routes>
        )}
      </Box>
    </Box>
  );
}

// Componente principal com Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
