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

  // Configurações com variáveis de ambiente corretas
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  const heatmapWsUrl = process.env.REACT_APP_HEATMAP_WS_URL || 'ws://localhost:3002';

  // Throttle para evitar múltiplas chamadas
  const lastFetchTime = useRef(0);
  const FETCH_THROTTLE = 2000; // 2 segundos entre chamadas

  // Função para buscar imagens com throttling
  const fetchImages = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchTime.current < FETCH_THROTTLE) {
      console.log('⏸️ Fetch throttled - muito recente');
      return;
    }

    try {
      lastFetchTime.current = now;
      setLoading(true);

      console.log('🔄 Buscando imagens do servidor...');
      const response = await fetch(`${apiUrl}/api/images`);
      const data = await response.json();

      // Ordenar por timestamp da última imagem de cada sessão
      const sortedGroups = Object.entries(data).sort(([, a], [, b]) => {
        const lastA = a.length > 0 ? Math.max(...a.map(img => img.timestamp)) : 0;
        const lastB = b.length > 0 ? Math.max(...b.map(img => img.timestamp)) : 0;
        return lastB - lastA;
      });

      setGroups(Object.fromEntries(sortedGroups));

      // Atualizar estatísticas das sessões
      const newStats = new Map();
      sortedGroups.forEach(([sessionId, images]) => {
        if (images.length > 0) {
          const timestamps = images.map(img => img.timestamp);
          const startTime = Math.min(...timestamps);
          const endTime = Math.max(...timestamps);

          newStats.set(sessionId, {
            totalImages: images.length,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            duration: Math.round((endTime - startTime) / 1000),
            sessionId: sessionId
          });
        } else {
          // Sessão ativa sem imagens
          newStats.set(sessionId, {
            totalImages: 0,
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            sessionId: sessionId,
            isActive: true
          });
        }
      });

      setSessionStats(newStats);
      setLoading(false);
      console.log(`📊 Carregadas ${sortedGroups.length} sessões (${Array.from(newStats.values()).reduce((sum, stat) => sum + stat.totalImages, 0)} imagens)`);

    } catch (error) {
      console.error('Erro ao buscar imagens:', error);
      setLoading(false);
      setGroups({});
      setSessionStats(new Map());
    }
  }, [apiUrl]);

  // Função para deletar sessão
  const deleteSession = useCallback(async (sessionId) => {
    if (!window.confirm(`Tem certeza que deseja deletar a sessão ${sessionId}?`)) {
      return;
    }

    try {
      console.log(`🗑️ Deletando sessão: ${sessionId}`);

      const response = await fetch(`${apiUrl}/api/session/${sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Sessão deletada:`, result);

        // Atualizar lista de imagens após deleção
        setTimeout(() => fetchImages(), 1000);

        // Mostrar notificação de sucesso
        alert(`Sessão ${sessionId} deletada com sucesso!\nArquivos removidos: ${result.deletedFiles}`);
      } else {
        const error = await response.json();
        console.error('Erro ao deletar sessão:', error);
        alert(`Erro ao deletar sessão: ${error.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao deletar sessão:', error);
      alert(`Erro ao deletar sessão: ${error.message}`);
    }
  }, [apiUrl, fetchImages]);

  // Handlers para o player
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      clearInterval(videoIntervalRef.current);
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      videoIntervalRef.current = setInterval(() => {
        setCurrentImageIndex(prev => {
          // Se chegou no último frame, para a reprodução
          if (prev >= (groups ? Object.values(groups)[0]?.length - 1 : 0)) {
            clearInterval(videoIntervalRef.current);
            setIsPlaying(false);
            return prev; // Mantém no último frame
          }
          return prev + 1;
        });
      }, playbackSpeed);
    }
  }, [isPlaying, groups, playbackSpeed]);

  const handleStop = useCallback(() => {
    clearInterval(videoIntervalRef.current);
    setIsPlaying(false);
    setCurrentImageIndex(0);
  }, []);

  // Handlers para navegação
  const handleSelectSession = useCallback((sessionId) => {
    navigate(`/player/${sessionId}`);
  }, [navigate]);

  const handleCreateVideo = useCallback((sessionId) => {
    navigate(`/player/${sessionId}`);
    setCurrentImageIndex(0);
  }, [navigate]);

  // Conectar ao WebSocket para receber atualizações em tempo real
  useEffect(() => {
    let isConnected = false;
    let reconnectTimeout = null;
    let ws = null;

    const connectToWebSocket = () => {
      if (ws) {
        ws.close();
      }

      try {
        console.log('🔌 Conectando ao WebSocket do heatmap...');
        ws = new WebSocket(heatmapWsUrl);

        ws.onopen = () => {
          console.log('✅ WebSocket do heatmap conectado');
          setWsServerConnected(true);
          isConnected = true;

          // Buscar imagens após conexão
          fetchImages();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('�� Mensagem WebSocket do heatmap recebida:', data);

            switch (data.type) {
              case 'image_uploaded':
                console.log(`🖼️ Nova imagem enviada: ${data.filename} (sessão: ${data.sessionId})`);
                // Throttled fetch para evitar múltiplas chamadas
                setTimeout(() => fetchImages(), 1000);
                break;

              case 'upload_in_progress':
                console.log(`⏳ Upload em progresso (sessão: ${data.sessionId})`);
                // Opcional: mostrar indicador de upload
                break;

              case 'session_started':
                console.log(`🆕 Nova sessão heatmap iniciada: ${data.sessionId}`);
                // Esperar um pouco para sessão se estabelecer
                setTimeout(() => fetchImages(), 2000);
                break;

              case 'session_ended':
                console.log(`⏹️ Sessão heatmap finalizada: ${data.sessionId}`);
                // Marcar sessão como desconectada
                setDisconnectedSessions(prev => new Set(prev).add(data.sessionId));
                setTimeout(() => fetchImages(), 1000);
                break;

              case 'connections_status':
                console.log(`📊 Status das conexões heatmap:`, data.connections);
                // Atualizar status das conexões ativas
                break;

              case 'upload_success':
                console.log(`✅ Upload concluído: ${data.filename}`);
                // Fetch imediato após confirmação de upload
                setTimeout(() => fetchImages(), 500);
                break;

              case 'upload_error':
                console.error(`❌ Erro no upload: ${data.error}`);
                break;

              default:
                console.log('Mensagem WebSocket heatmap desconhecida:', data);
            }
          } catch (error) {
            console.error('Erro ao processar mensagem WebSocket do heatmap:', error);
          }
        };

        ws.onclose = () => {
          console.log('🔌 Conexão WebSocket do heatmap fechada');
          setWsServerConnected(false);
          isConnected = false;

          // Tentar reconectar após 5 segundos apenas se o componente ainda estiver montado
          if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
              if (!isConnected) {
                console.log('🔄 Tentando reconectar WebSocket do heatmap...');
                connectToWebSocket();
              }
            }, 5000);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ Erro WebSocket do heatmap:', error);
          setWsServerConnected(false);
          isConnected = false;
        };

      } catch (error) {
        console.error('❌ Erro ao criar WebSocket do heatmap:', error);
        setWsServerConnected(false);
        isConnected = false;

        // Tentar reconectar após 5 segundos
        if (!reconnectTimeout) {
          reconnectTimeout = setTimeout(() => {
            if (!isConnected) {
              connectToWebSocket();
            }
          }, 5000);
        }
      }
    };

    // Conectar inicialmente
    connectToWebSocket();

    return () => {
      isConnected = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [heatmapWsUrl, fetchImages]);

  // Atualizar lista de imagens periodicamente - REDUZIDO para evitar spam
  useEffect(() => {
    // Buscar imagens na inicialização
    fetchImages();

    // Atualizar periodicamente a cada 30 segundos (reduzido de 15 para 30)
    const interval = setInterval(() => {
      // Só atualizar se não estiver em loading e se a janela estiver ativa
      if (!loading && document.hasFocus()) {
        console.log('🔄 Update automático (30s)');
        fetchImages();
      }
    }, 30000); // 30 segundos

    return () => {
      clearInterval(interval);
    };
  }, [fetchImages, loading]);

  // Memoizar dados derivados
  const sessionIds = useMemo(() => groups ? Object.keys(groups) : [], [groups]);

  // Memoizar sessões ordenadas por status e atividade
  const sortedSessionIds = useMemo(() => {
    if (!groups || !sessionStats.sessionDetails) return sessionIds;

    return sessionIds.sort((a, b) => {
      const aDetail = sessionStats.sessionDetails[a];
      const bDetail = sessionStats.sessionDetails[b];
      const aDisconnected = disconnectedSessions.has(a);
      const bDisconnected = disconnectedSessions.has(b);
      const aOnline = aDetail?.isActive && !aDisconnected;
      const bOnline = bDetail?.isActive && !bDisconnected;

      // Primeiro: sessões online
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;

      // Segundo: sessões desconectadas ficam por último
      if (aDisconnected && !bDisconnected) return 1;
      if (!aDisconnected && bDisconnected) return -1;

      // Terceiro: por última atividade (mais recente primeiro)
      const aLastActivity = aDetail?.lastImageTime?.getTime() || 0;
      const bLastActivity = bDetail?.lastImageTime?.getTime() || 0;
      return bLastActivity - aLastActivity;
    });
  }, [sessionIds, sessionStats.sessionDetails, disconnectedSessions, groups]);

  return (
    <Box sx={{ display: 'flex', bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#222' }}>
        <Toolbar>
          <Typography variant="h5" noWrap component="div">
            📊 Clarity Analytics Platform {wsServerConnected && '🟢'}
          </Typography>
        </Toolbar>
      </AppBar>

      <Sidebar
        sortedSessionIds={sessionIds}
        groups={groups}
        sessionStats={sessionStats}
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
                  sessionStats={sessionStats}
                  lastUpdateTime={Date.now()} // Valor padrão
                  wsStats={{ totalMessages: 0, imagesReceived: 0, activeConnections: 0, serverStatus: wsServerConnected ? 'connected' : 'disconnected' }} // Valor padrão
                />
              }
            />
            <Route
              path="/sessions"
              element={
                <SessionsPage
                  sessionStats={sessionStats}
                  groups={groups}
                  selectedSession={null}
                  onSelectSession={handleSelectSession}
                  onCreateVideo={handleCreateVideo}
                  onDeleteSession={deleteSession}
                  disconnectedSessions={disconnectedSessions}
                  sessionStatus={{}} // Valor padrão vazio
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
                  sessionStats={sessionStats}
                  disconnectedSessions={disconnectedSessions}
                  sessionStatus={{}} // Valor padrão vazio
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
