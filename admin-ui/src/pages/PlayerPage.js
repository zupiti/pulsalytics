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
    return sessionId && groups ? (groups[sessionId] || []) : [];
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
          Nenhuma sessão selecionada
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Selecione uma sessão para reproduzir
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/sessions')}
          sx={{ mt: 2 }}
        >
          Ver Sessões
        </Button>
      </Box>
    );
  }

  if (!groups || !groups[sessionId] || groups[sessionId].length === 0) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Sessão sem imagens
          </Typography>
          <Typography variant="body1">
            A sessão "{sessionId}" não possui imagens ou não foi encontrada no sistema.
          </Typography>
        </Alert>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Info sx={{ mr: 1, color: 'info.main' }} />
            <Typography variant="h6">
              Informações da Sessão
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            ID da Sessão: <strong>{sessionId}</strong>
          </Typography>

          {sessionInfo && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Status:</strong> {sessionInfo.status || 'Desconhecido'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Existe:</strong> {sessionInfo.exists ? 'Sim' : 'Não'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Tem imagens:</strong> {sessionInfo.hasImages ? 'Sim' : 'Não'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Quantidade de imagens:</strong> {sessionInfo.imageCount || 0}
              </Typography>

              {sessionInfo.message && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {sessionInfo.message}
                </Alert>
              )}

              {sessionInfo.possibleReasons && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Possíveis motivos:</strong>
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
                    🔍 Diagnósticos Avançados
                  </Typography>

                  <Typography variant="body2" gutterBottom>
                    <strong>Servidor WebSocket (porta 3002):</strong>
                  </Typography>
                  <ul>
                    <li>Sessão existe: {sessionInfo.websocket.exists ? '✅ Sim' : '❌ Não'}</li>
                    <li>Sessão ativa: {sessionInfo.websocket.isActive ? '✅ Sim' : '❌ Não'}</li>
                    <li>Arquivos encontrados: {sessionInfo.websocket.fileCount || 0}</li>
                  </ul>

                  {sessionInfo.websocket.sessionInfo && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Detalhes da sessão:</strong>
                      </Typography>
                      <ul>
                        <li>Início: {new Date(sessionInfo.websocket.sessionInfo.startTime).toLocaleString()}</li>
                        <li>Última atividade: {new Date(sessionInfo.websocket.sessionInfo.lastActivity).toLocaleString()}</li>
                        <li>Duração: {sessionInfo.websocket.sessionInfo.duration}s</li>
                        <li>Imagens recebidas: {sessionInfo.websocket.sessionInfo.imagesReceived}</li>
                        <li>Pontos de mouse: {sessionInfo.websocket.sessionInfo.mousePoints}</li>
                        <li>Cliques: {sessionInfo.websocket.sessionInfo.clicks}</li>
                        <li>URL: {sessionInfo.websocket.sessionInfo.url}</li>
                      </ul>
                    </Box>
                  )}

                  {sessionInfo.websocket.files && sessionInfo.websocket.files.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Arquivos encontrados:</strong>
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
                        <strong>Comparação entre servidores:</strong>
                      </Typography>
                      <ul>
                        <li>Servidor básico (3001): {sessionInfo.diagnostics.comparison.arquivosNoBasico} arquivos</li>
                        <li>Servidor WebSocket (3002): {sessionInfo.diagnostics.comparison.arquivosNoWebSocket} arquivos</li>
                        <li>Sincronização: {sessionInfo.diagnostics.comparison.arquivosNoBasico === sessionInfo.diagnostics.comparison.arquivosNoWebSocket ? '✅ OK' : '⚠️ Dessincronia'}</li>
                      </ul>
                    </Box>
                  )}
                </Box>
              )}

              {sessionInfo.wsError && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Aviso:</strong> {sessionInfo.wsError}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Para diagnósticos completos, certifique-se de que o servidor WebSocket está rodando.
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
              {loadingInfo ? 'Carregando...' : 'Verificar Detalhes'}
            </Button>

            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={() => window.location.reload()}
            >
              Recarregar Página
            </Button>

            <Button
              variant="contained"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/sessions')}
            >
              Voltar para Sessões
            </Button>
          </Box>
        </Paper>

        <Alert severity="info">
          <Typography variant="body2">
            <strong>Dica:</strong> Se esta sessão deveria ter imagens, verifique se:
          </Typography>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>O Flutter está executando e conectado ao WebSocket</li>
            <li>O servidor WebSocket está rodando na porta 3002</li>
            <li>Não há erros de rede ou CORS</li>
            <li>A sessão não foi deletada acidentalmente</li>
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
