import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert, CircularProgress, Paper, Divider } from '@mui/material';
import { ArrowBack, Info, Refresh } from '@mui/icons-material';
import { VideoPlayer } from '../components/VideoPlayer';

export default function PlayerPage({
  groups,
  isPlaying,
  currentImageIndex,
  playbackSpeed,
  onPlayPause,
  onStop,
  onIndexChange,
  onSpeedChange,
  onDeleteSession,
  sessionStats,
  disconnectedSessions,
  sessionStatus,
  mouseTrail = [],
  mouseClicks = []
}) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Memoizar as imagens da sessão selecionada
  const images = useMemo(() => {
    return sessionId && groups ? (groups[sessionId] || []).slice().reverse() : [];
  }, [sessionId, groups]);

  // Função para buscar informações detalhadas da sessão
  const fetchSessionInfo = async () => {
    if (!sessionId) return;

    setLoadingInfo(true);
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

      // Tentar buscar informações básicas primeiro
      const response = await fetch(`${apiUrl}/api/session/${sessionId}`);
      const basicInfo = await response.json();

      // Buscar diagnósticos avançados do servidor WebSocket
      try {
        const wsResponse = await fetch(`http://localhost:3003/api/session-diagnostics?sessionId=${sessionId}`);
        const wsInfo = await wsResponse.json();

        // Combinar informações
        const combinedInfo = {
          ...basicInfo,
          websocket: wsInfo,
          diagnostics: {
            serverBasico: basicInfo,
            serverWebSocket: wsInfo,
            comparison: {
              existeNoBasico: basicInfo.exists,
              existeNoWebSocket: wsInfo.exists,
              ativoNoWebSocket: wsInfo.isActive,
              arquivosNoBasico: basicInfo.imageCount || 0,
              arquivosNoWebSocket: wsInfo.fileCount || 0
            }
          }
        };

        setSessionInfo(combinedInfo);
      } catch (wsError) {
        console.warn('Erro ao buscar diagnósticos do WebSocket:', wsError);
        setSessionInfo({
          ...basicInfo,
          websocket: null,
          wsError: 'Servidor WebSocket não disponível na porta 3003'
        });
      }
    } catch (error) {
      console.error('Erro ao buscar informações da sessão:', error);
      setSessionInfo({
        error: 'Erro ao buscar informações da sessão',
        sessionId: sessionId
      });
    } finally {
      setLoadingInfo(false);
    }
  };

  // Se não há sessão ou não há imagens, mostrar mensagem
  if (!sessionId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          No session selected
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Select a session to play
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/sessions')}
          sx={{ mt: 2 }}
        >
          View Sessions
        </Button>
      </Box>
    );
  }

  if (!groups || !groups[sessionId] || groups[sessionId].length === 0) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Session without images
          </Typography>
          <Typography variant="body1">
            The session "{sessionId}" has no images or was not found in the system.
          </Typography>
        </Alert>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Info sx={{ mr: 1, color: 'info.main' }} />
            <Typography variant="h6">
              Session Information
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            Session ID: <strong>{sessionId}</strong>
          </Typography>

          {sessionInfo && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Status:</strong> {sessionInfo.status || 'Unknown'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Exists:</strong> {sessionInfo.exists ? 'Yes' : 'No'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Has images:</strong> {sessionInfo.hasImages ? 'Yes' : 'No'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Image count:</strong> {sessionInfo.imageCount || 0}
              </Typography>

              {sessionInfo.message && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {sessionInfo.message}
                </Alert>
              )}

              {sessionInfo.possibleReasons && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Possible reasons:</strong>
                  </Typography>
                  <ul>
                    {sessionInfo.possibleReasons.map((reason, index) => (
                      <li key={index}>
                        <Typography variant="body2" color="text.secondary">
                          {reason}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                </Box>
              )}

              {/* Diagnósticos avançados do WebSocket */}
              {sessionInfo.websocket && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    🔍 Advanced Diagnostics
                  </Typography>

                  <Typography variant="body2" gutterBottom>
                    <strong>WebSocket Server (port 3002):</strong>
                  </Typography>
                  <ul>
                    <li>Session exists: {sessionInfo.websocket.exists ? '✅ Yes' : '❌ No'}</li>
                    <li>Active session: {sessionInfo.websocket.isActive ? '✅ Yes' : '❌ No'}</li>
                    <li>Files found: {sessionInfo.websocket.fileCount || 0}</li>
                  </ul>

                  {sessionInfo.websocket.sessionInfo && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Session details:</strong>
                      </Typography>
                      <ul>
                        <li>Start: {new Date(sessionInfo.websocket.sessionInfo.startTime).toLocaleString()}</li>
                        <li>Last activity: {new Date(sessionInfo.websocket.sessionInfo.lastActivity).toLocaleString()}</li>
                        <li>Duration: {sessionInfo.websocket.sessionInfo.duration}s</li>
                        <li>Images received: {sessionInfo.websocket.sessionInfo.imagesReceived}</li>
                        <li>Mouse points: {sessionInfo.websocket.sessionInfo.mousePoints}</li>
                        <li>Clicks: {sessionInfo.websocket.sessionInfo.clicks}</li>
                        <li>URL: {sessionInfo.websocket.sessionInfo.url}</li>
                      </ul>
                    </Box>
                  )}

                  {sessionInfo.websocket.files && sessionInfo.websocket.files.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Files found:</strong>
                      </Typography>
                      <ul>
                        {sessionInfo.websocket.files.map((file, index) => (
                          <li key={index}>
                            <Typography variant="body2" color="text.secondary">
                              📄 {file}
                            </Typography>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  )}

                  {/* Comparação entre servidores */}
                  {sessionInfo.diagnostics && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Server comparison:</strong>
                      </Typography>
                      <ul>
                        <li>Basic server (3001): {sessionInfo.diagnostics.comparison.arquivosNoBasico} files</li>
                        <li>WebSocket server (3002): {sessionInfo.diagnostics.comparison.arquivosNoWebSocket} files</li>
                        <li>Synchronization: {sessionInfo.diagnostics.comparison.arquivosNoBasico === sessionInfo.diagnostics.comparison.arquivosNoWebSocket ? '✅ OK' : '⚠️ Out of sync'}</li>
                      </ul>
                    </Box>
                  )}
                </Box>
              )}

              {sessionInfo.wsError && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Warning:</strong> {sessionInfo.wsError}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    For complete diagnostics, make sure the WebSocket server is running.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={loadingInfo ? <CircularProgress size={16} /> : <Info />}
              onClick={fetchSessionInfo}
              disabled={loadingInfo}
            >
              {loadingInfo ? 'Loading...' : 'Check Details'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>

            <Button
              variant="contained"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/sessions')}
            >
              Back to Sessions
            </Button>
          </Box>
        </Paper>

        <Alert severity="info">
          <Typography variant="body2">
            <strong>Tip:</strong> If this session should have images, check if:
          </Typography>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>Flutter is running and connected to the WebSocket</li>
            <li>The WebSocket server is running on port 3002</li>
            <li>There are no network or CORS errors</li>
            <li>The session was not accidentally deleted</li>
          </ul>
        </Alert>
      </Box>
    );
  }

  return (
    <VideoPlayer
      sessionId={sessionId}
      images={images}
      isPlaying={isPlaying}
      currentIndex={currentImageIndex}
      playbackSpeed={playbackSpeed}
      onPlayPause={() => onPlayPause(images)}
      onStop={onStop}
      onIndexChange={onIndexChange}
      onSpeedChange={onSpeedChange}
      onDeleteSession={onDeleteSession}
      sessionStats={sessionStats}
      disconnectedSessions={disconnectedSessions}
      sessionStatus={sessionStatus}
      mouseTrail={mouseTrail}
      mouseClicks={mouseClicks}
    />
  );
}
