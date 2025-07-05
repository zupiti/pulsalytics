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
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionStats, setSessionStats] = useState({});
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [sessionStatus, setSessionStatus] = useState({});
  const [disconnectedSessions, setDisconnectedSessions] = useState(new Set());

  // Estados do player
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(42); // ms between frames (24 FPS)

  // Estados WebSocket
  const [wsStats, setWsStats] = useState({
    totalMessages: 0,
    imagesReceived: 0,
    activeConnections: 0,
    serverStatus: 'connecting'
  });
  const [activeWsConnections, setActiveWsConnections] = useState({});
  const [wsServerConnected, setWsServerConnected] = useState(false);

  const wsRef = useRef(null);
  const wsHeatmapRef = useRef(null);
  const videoIntervalRef = useRef(null);

  // Substituir URLs hardcoded por variáveis de ambiente
  const apiUrl = process.env.REACT_APP_API_URL;
  const wsUrl = process.env.REACT_APP_WS_URL;
  const wsHeatmapUrl = process.env.REACT_APP_WS_HEATMAP_URL;

  // Memoizar fetchImages para evitar recriações desnecessárias
  const fetchImages = useCallback(async () => {
    // Se não houver backend, simular resposta vazia
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/images`);
      if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
        // Backend fora do ar ou resposta inválida
        setGroups({});
        setSessionStats({ totalSessions: 0 });
        setLoading(false);
        return;
      }
      const data = await res.json();

      // Processar URLs das imagens para incluir prefixo do servidor
      const processedData = {};
      Object.entries(data).forEach(([sessionId, images]) => {
        processedData[sessionId] = images.map(image => ({
          ...image,
          url: image.url.startsWith('http') ? image.url : `${apiUrl}${image.url}`
        }));
      });
      setGroups(processedData);

      // Buscar status das sessões
      try {
        const statusRes = await fetch(`${apiUrl}/api/session-status`);
        if (!statusRes.ok) throw new Error('no backend');
        const statusData = await statusRes.json();
        setSessionStatus(statusData);
      } catch (error) {
        setSessionStatus({});
      }

      // Calcular estatísticas das sessões
      const stats = calculateSessionStats(processedData);
      setSessionStats(stats);

      // Atualizar tempo da última atualização
      setLastUpdateTime(Date.now());

      setLoading(false);
    } catch (error) {
      // Backend fora do ar
      setGroups({});
      setSessionStats({ totalSessions: 0 });
      setSessionStatus({});
      setLoading(false);
    }
  }, []); // Sem dependências para evitar recriação

  // Função para calcular estatísticas das sessões - memoizada
  const calculateSessionStats = useCallback((groups) => {
    if (!groups) return {};

    const stats = {
      totalSessions: Object.keys(groups).length,
      totalImages: 0,
      totalClicks: 0,
      avgSessionTime: 0,
      mostActiveSession: null,
      sessionDetails: {}
    };

    let totalDuration = 0;
    let maxImages = 0;
    const currentTime = Date.now();

    Object.entries(groups).forEach(([sessionId, images]) => {
      if (images.length === 0) return;

      // Ordenar por timestamp
      const sortedImages = images.sort((a, b) => a.timestamp - b.timestamp);
      const startTime = sortedImages[0].timestamp;
      const lastImageTime = sortedImages[sortedImages.length - 1].timestamp;

      // Verificar se a sessão está ativa:
      // - Última imagem há menos de 20 segundos = Online
      // - Última imagem há mais de 20 segundos = Offline (timeout)
      const TIMEOUT_THRESHOLD = 20 * 1000; // 20 segundos
      const isSessionActive = currentTime - lastImageTime < TIMEOUT_THRESHOLD;
      const serverStatus = sessionStatus[sessionId]?.status;
      const isDisconnected = disconnectedSessions.has(sessionId) || serverStatus === 'disconnected';

      // Calcular duração real da sessão
      let endTime;
      if (isDisconnected && sessionStatus[sessionId]?.disconnectedAt) {
        endTime = sessionStatus[sessionId].disconnectedAt;
      } else if (isSessionActive) {
        endTime = currentTime; // Sessão ainda ativa, usar tempo atual
      } else {
        endTime = lastImageTime; // Sessão inativa, usar última imagem
      }

      const duration = endTime - startTime;

      // Contar cliques estimados (assumindo cliques a cada 2-3 imagens fast)
      const fastImages = images.filter(img => img.filename.includes('_fast_'));
      const estimatedClicks = Math.floor(fastImages.length / 2.5);

      // Analisar atividade por hora
      const activityByHour = {};
      images.forEach(img => {
        const hour = new Date(img.timestamp).getHours();
        activityByHour[hour] = (activityByHour[hour] || 0) + 1;
      });

      const sessionDetail = {
        sessionId,
        totalImages: images.length,
        fastImages: fastImages.length,
        regularImages: images.length - fastImages.length,
        estimatedClicks,
        duration: duration,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        lastImageTime: new Date(lastImageTime),
        avgInterval: images.length > 1 ? duration / (images.length - 1) : 0,
        activityByHour,
        isActive: isSessionActive && !isDisconnected,
        isDisconnected: isDisconnected,
        realEndTime: endTime
      };

      stats.sessionDetails[sessionId] = sessionDetail;
      stats.totalImages += images.length;
      stats.totalClicks += estimatedClicks;
      totalDuration += duration;

      if (images.length > maxImages) {
        maxImages = images.length;
        stats.mostActiveSession = sessionId;
      }
    });

    stats.avgSessionTime = stats.totalSessions > 0 ? totalDuration / stats.totalSessions : 0;

    return stats;
  }, [sessionStatus, disconnectedSessions]);

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

  // Função para deletar uma sessão
  const handleDeleteSession = useCallback(async (sessionId) => {
    if (!window.confirm(`Tem certeza que deseja deletar a sessão "${sessionId}"?\n\nEsta ação irá remover todas as imagens e não pode ser desfeita.`)) {
      return;
    }

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

    try {
      const response = await fetch(`${apiUrl}/api/session/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        // Remover sessão dos estados locais
        setGroups(prev => {
          const newGroups = { ...prev };
          delete newGroups[sessionId];
          return newGroups;
        });

        setDisconnectedSessions(prev => {
          const newSet = new Set(prev);
          newSet.delete(sessionId);
          return newSet;
        });

        // Navegar para overview
        navigate('/');

        // Recarregar dados para garantir consistência
        setTimeout(fetchImages, 500);
      } else {
        alert('Erro ao deletar sessão: ' + result.error);
      }
    } catch (error) {
      alert('Erro ao deletar sessão. Verifique a conexão.');
    }
  }, [navigate, fetchImages]);

  // Handlers para navegação
  const handleSelectSession = useCallback((sessionId) => {
    navigate(`/player/${sessionId}`);
  }, [navigate]);

  const handleCreateVideo = useCallback((sessionId) => {
    navigate(`/player/${sessionId}`);
    setCurrentImageIndex(0);
  }, [navigate]);

  // UseEffect para WebSocket - OTIMIZADO
  useEffect(() => {
    let mounted = true;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout = null;
    let statsInterval = null;
    let lastFetchTime = 0;
    const FETCH_THROTTLE = 1000; // Throttle fetch para evitar muitas chamadas

    const connectWebSockets = () => {
      if (!mounted) return;

      fetchImages();

      // WebSocket para atualização instantânea (servidor admin)
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // WebSocket para monitorar heatmap server (porta 3002)
      const wsHeatmap = new WebSocket(wsHeatmapUrl);
      wsHeatmapRef.current = wsHeatmap;

      // Função throttled para fetch
      const throttledFetch = () => {
        const now = Date.now();
        if (now - lastFetchTime > FETCH_THROTTLE) {
          lastFetchTime = now;
          fetchImages();
        }
      };

      // Configurar WebSocket admin
      ws.onopen = () => {
        if (!mounted) return;
        setWsStats(prev => ({ ...prev, serverStatus: 'connected' }));
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'new-image') {
            setWsStats(prev => ({
              ...prev,
              imagesReceived: prev.imagesReceived + 1,
              totalMessages: prev.totalMessages + 1
            }));

            throttledFetch();
          } else if (data.type === 'session_disconnected') {
            setDisconnectedSessions(prev => new Set(prev).add(data.sessionId));
            setSessionStatus(prev => ({
              ...prev,
              [data.sessionId]: {
                ...prev[data.sessionId],
                status: 'disconnected',
                disconnectedAt: data.timestamp
              }
            }));

            throttledFetch();
          } else if (data.type === 'session_deleted') {
            throttledFetch();
          }

          setWsStats(prev => ({ ...prev, totalMessages: prev.totalMessages + 1 }));
        } catch (error) {
          if (event.data === 'new-image') {
            throttledFetch();
          }
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        setWsStats(prev => ({ ...prev, serverStatus: 'disconnected' }));

        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          reconnectAttempts++;
          reconnectTimeout = setTimeout(() => {
            if (mounted) connectWebSockets();
          }, delay);
        }
      };

      ws.onerror = () => {
        if (!mounted) return;
        setWsStats(prev => ({ ...prev, serverStatus: 'error' }));
      };

      // Configurar WebSocket heatmap monitor
      wsHeatmap.onopen = () => {
        if (!mounted) return;
        setWsServerConnected(true);
        wsHeatmap.send(JSON.stringify({
          type: 'admin_monitor_start',
          timestamp: Date.now()
        }));
      };

      wsHeatmap.onmessage = (event) => {
        if (!mounted) return;
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'session_started':
              setActiveWsConnections(prev => ({
                ...prev,
                [data.sessionId]: {
                  sessionId: data.sessionId,
                  connectedAt: Date.now(),
                  lastActivity: Date.now(),
                  imagesReceived: 0,
                  qualityMode: 'balanced',
                  uploading: false,
                  url: data.url || 'unknown'
                }
              }));
              throttledFetch();
              break;

            case 'image_uploaded':
              setActiveWsConnections(prev => ({
                ...prev,
                [data.sessionId]: {
                  ...prev[data.sessionId],
                  lastActivity: Date.now(),
                  imagesReceived: (prev[data.sessionId]?.imagesReceived || 0) + 1,
                  uploading: false
                }
              }));
              throttledFetch();
              break;

            case 'session_ended':
              setActiveWsConnections(prev => {
                const newConnections = { ...prev };
                delete newConnections[data.sessionId];
                return newConnections;
              });
              setLastUpdateTime(Date.now());
              break;

            case 'connections_status':
              setActiveWsConnections(data.connections || {});
              setWsStats(prev => ({
                ...prev,
                activeConnections: Object.keys(data.connections || {}).length
              }));
              break;
          }
        } catch (error) {
          // Silenciar erros
        }
      };

      wsHeatmap.onclose = () => {
        if (!mounted) return;
        setWsServerConnected(false);
        setActiveWsConnections({});
      };

      // Atualizar estatísticas das conexões ativas periodicamente
      statsInterval = setInterval(() => {
        if (!mounted) return;
        setWsStats(prev => ({
          ...prev,
          activeConnections: Object.keys(activeWsConnections).length
        }));
      }, 10000);
    };

    // Conectar WebSockets após pequeno delay
    const initTimeout = setTimeout(() => {
      if (mounted) connectWebSockets();
    }, 500);

    return () => {
      mounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (initTimeout) clearTimeout(initTimeout);
      if (statsInterval) clearInterval(statsInterval);
      if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
      if (wsHeatmapRef.current) wsHeatmapRef.current.close();
    };
  }, []); // Sem dependências para evitar re-execução

  // UseEffect otimizado para auto-update
  useEffect(() => {
    const autoUpdateInterval = setInterval(() => {
      if (document.hasFocus() && !loading) {
        fetchImages();
      }
    }, 10000); // 10 segundos

    return () => clearInterval(autoUpdateInterval);
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
  }, [sessionIds, sessionStats.sessionDetails, disconnectedSessions]);

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
                  lastUpdateTime={lastUpdateTime}
                  wsStats={wsStats}
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
                  onDeleteSession={handleDeleteSession}
                  disconnectedSessions={disconnectedSessions}
                  sessionStatus={sessionStatus}
                />
              }
            />
            <Route
              path="/player/:sessionId"
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
                  onDeleteSession={handleDeleteSession}
                  sessionStats={sessionStats}
                  disconnectedSessions={disconnectedSessions}
                  sessionStatus={sessionStatus}
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
