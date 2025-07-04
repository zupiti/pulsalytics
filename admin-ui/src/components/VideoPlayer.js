import React, { memo, useMemo, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, IconButton, Slider, Chip, Card,
  LinearProgress, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Button
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, VideoLibrary, Delete, Visibility, 
  Schedule, SignalWifiOff
} from '@mui/icons-material';

// Componente de Player de Vídeo
export const VideoPlayer = memo(function VideoPlayer({ 
  sessionId, 
  images, 
  isPlaying, 
  currentIndex, 
  playbackSpeed, 
  onPlayPause, 
  onStop, 
  onIndexChange, 
  onSpeedChange, 
  onDeleteSession, 
  sessionStats, 
  disconnectedSessions, 
  sessionStatus 
}) {
  const stats = useMemo(() => ({
    totalFrames: images.length,
    duration: images.length > 1 ? images[images.length - 1].timestamp - images[0].timestamp : 0,
    avgFPS: images.length > 1 ? (images.length - 1) / ((images[images.length - 1].timestamp - images[0].timestamp) / 1000) : 0
  }), [images]);

  const formatDuration = useCallback((ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  }, []);

  // Obter informações da sessão atual
  const sessionDetail = sessionStats.sessionDetails?.[sessionId];
  const isDisconnected = disconnectedSessions.has(sessionId);
  const isOnline = sessionDetail?.isActive && !isDisconnected;

  // Calcular tempo desde última atividade
  const timeSinceLastActivity = useMemo(() => {
    if (!sessionDetail?.lastImageTime) return null;
    const now = Date.now();
    const lastActivity = sessionDetail.lastImageTime.getTime();
    const diffSeconds = Math.floor((now - lastActivity) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s atrás`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}min atrás`;
    return `${Math.floor(diffSeconds / 3600)}h atrás`;
  }, [sessionDetail?.lastImageTime]);

  // Status da sessão com timeout de 20s
  const getSessionStatus = useCallback(() => {
    if (isDisconnected) {
      return {
        label: 'Offline',
        color: 'error',
        icon: <SignalWifiOff />,
        description: 'Usuário desconectado'
      };
    } else if (isOnline) {
      return {
        label: 'Online',
        color: 'success',
        icon: <Visibility />,
        description: 'Usuário ativo agora'
      };
    } else {
      return {
        label: 'Timeout (20s)',
        color: 'warning',
        icon: <Schedule />,
        description: 'Sem atividade há mais de 20 segundos'
      };
    }
  }, [isDisconnected, isOnline]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VideoLibrary /> Player de Sessão
        </Typography>
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<Delete />}
          onClick={() => onDeleteSession(sessionId)}
          sx={{ textTransform: 'none' }}
        >
          Deletar Sessão
        </Button>
      </Box>

      {images.length > 0 ? (
        <Grid container spacing={3}>
          {/* Player Principal */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <img
                  src={images[currentIndex]?.url}
                  alt={`Frame ${currentIndex + 1}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '500px',
                    objectFit: 'contain',
                    border: '1px solid #ddd',
                    borderRadius: '8px'
                  }}
                />
              </Box>

              {/* Informações do Frame */}
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="primary">
                  Frame {currentIndex + 1} de {images.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {images[currentIndex]?.timestamp &&
                    new Date(images[currentIndex].timestamp).toLocaleString()
                  }
                </Typography>
              </Box>

              {/* Controles */}
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
                <IconButton onClick={onPlayPause} color="primary" size="large">
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
                <IconButton onClick={onStop} color="secondary" size="large">
                  <Stop />
                </IconButton>
              </Box>

              {/* Slider de Progresso */}
              <Box sx={{ px: 2, mb: 3 }}>
                <Slider
                  value={currentIndex}
                  min={0}
                  max={images.length - 1}
                  onChange={(e, value) => onIndexChange(value)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `Frame ${value + 1}`}
                />
              </Box>

              {/* Controle de Velocidade */}
              <Box sx={{ px: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Velocidade: {(1000 / playbackSpeed).toFixed(1)} FPS
                </Typography>
                <Slider
                  value={playbackSpeed}
                  min={42}
                  max={2000}
                  step={1}
                  onChange={(e, value) => onSpeedChange(value)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${(1000 / value).toFixed(1)} FPS`}
                  marks={[
                    { value: 42, label: '24 FPS' },
                    { value: 100, label: '10 FPS' },
                    { value: 200, label: '5 FPS' },
                    { value: 500, label: '2 FPS' },
                    { value: 1000, label: '1 FPS' },
                    { value: 2000, label: '0.5 FPS' }
                  ]}
                />
              </Box>
            </Paper>
          </Grid>

          {/* Estatísticas da Sessão */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: 'fit-content' }}>
              <Typography variant="h6" gutterBottom>
                📊 Estatísticas da Sessão
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Sessão ID:
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>
                  {sessionId}
                </Typography>
              </Box>

              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2, mb: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {stats.totalFrames}
                      </Typography>
                      <Typography variant="caption">Total Frames</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="secondary">
                        {formatDuration(stats.duration)}
                      </Typography>
                      <Typography variant="caption">Duração</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="success.main">
                        {stats.avgFPS.toFixed(1)}
                      </Typography>
                      <Typography variant="caption">FPS Médio</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="warning.main">
                        {Math.floor(stats.totalFrames / 2.5)}
                      </Typography>
                      <Typography variant="caption">Cliques Est.</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Progresso da Reprodução */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Progresso da Reprodução
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(currentIndex / (images.length - 1)) * 100}
                  sx={{ height: 8, borderRadius: 1 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {((currentIndex / (images.length - 1)) * 100).toFixed(1)}% completo
                </Typography>
              </Box>

              {/* Status da Sessão com Timeout */}
              <Box sx={{ mb: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="body2" gutterBottom>
                  Status da Sessão
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  {(() => {
                    const status = getSessionStatus();
                    return (
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                        icon={status.icon}
                        sx={{ minWidth: '80px' }}
                      />
                    );
                  })()}
                  {timeSinceLastActivity && (
                    <Typography variant="caption" color="text.secondary">
                      {timeSinceLastActivity}
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {getSessionStatus().description}
                  {!isDisconnected && !isOnline && (
                    <span style={{ color: '#f57c00' }}> - Sistema detecta inatividade após 20s sem atualizações</span>
                  )}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary">
            Nenhuma imagem encontrada para esta sessão
          </Typography>
        </Box>
      )}
    </Box>
  );
});
