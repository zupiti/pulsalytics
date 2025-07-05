import React, { memo, useMemo, useCallback, useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Grid, IconButton, Slider, Chip,
  Button, Switch, FormControlLabel, Card, CardContent
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, Delete, Visibility,
  Schedule, SignalWifiOff, ThermostatAuto, Mouse, TouchApp,
  SkipNext, SkipPrevious, VolumeUp, Settings
} from '@mui/icons-material';

// Componente de Player de Vídeo com Mapa de Calor Avançado
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
  const canvasRef = useRef(null);
  const [mouseData, setMouseData] = useState([]);
  const [clickData, setClickData] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [showClicks, setShowClicks] = useState(true);
  const [heatmapIntensity, setHeatmapIntensity] = useState(50);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [lastDataUpdate, setLastDataUpdate] = useState(0);

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

  // URL base da API
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Função para construir URL completa da imagem
  const getImageUrl = useCallback((image) => {
    if (!image?.url) return '';

    // Se a URL já for completa (começa com http), usar como está
    if (image.url.startsWith('http')) {
      return image.url;
    }

    // Caso contrário, construir URL completa com o servidor da API
    return `${apiUrl}${image.url}`;
  }, [apiUrl]);

  // Função para buscar dados de mouse e cliques
  const fetchMouseData = useCallback(async () => {
    if (!sessionId) return;

    try {
      // Buscar dados de mouse
      const mouseResponse = await fetch(`${apiUrl}/api/mouse-data/${sessionId}`);
      if (mouseResponse.ok) {
        const mousePoints = await mouseResponse.json();
        setMouseData(mousePoints);
      }

      // Buscar dados de cliques
      const clickResponse = await fetch(`${apiUrl}/api/click-data/${sessionId}`);
      if (clickResponse.ok) {
        const clickPoints = await clickResponse.json();
        setClickData(clickPoints);
      }

      setLastDataUpdate(Date.now());
    } catch (error) {
      console.error('Erro ao buscar dados de interação:', error);
    }
  }, [sessionId, apiUrl]);

  // Buscar dados iniciais e configurar atualização automática
  useEffect(() => {
    if (!sessionId) return;

    // Buscar dados iniciais
    fetchMouseData();

    // Configurar atualização automática a cada 5 segundos
    const interval = setInterval(() => {
      fetchMouseData();
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId, fetchMouseData]);

  // Função para criar mapa de calor baseado nos dados de mouse
  const createHeatmapData = useCallback(() => {
    if (!mouseData.length) return [];

    // Agrupar pontos próximos para criar zonas de calor
    const heatmapPoints = [];
    const threshold = 30; // Distância para agrupar pontos

    mouseData.forEach(point => {
      let merged = false;

      for (let i = 0; i < heatmapPoints.length; i++) {
        const existing = heatmapPoints[i];
        const distance = Math.sqrt(
          Math.pow(point.x - existing.x, 2) +
          Math.pow(point.y - existing.y, 2)
        );

        if (distance < threshold) {
          // Mesclar pontos próximos
          existing.x = (existing.x * existing.intensity + point.x) / (existing.intensity + 1);
          existing.y = (existing.y * existing.intensity + point.y) / (existing.intensity + 1);
          existing.intensity += 1;
          merged = true;
          break;
        }
      }

      if (!merged) {
        heatmapPoints.push({
          x: point.x,
          y: point.y,
          intensity: 1
        });
      }
    });

    return heatmapPoints;
  }, [mouseData]);

  // Função para desenhar o mapa de calor no canvas
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const ctx = canvas.getContext('2d');

    // Limpar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Configurar canvas para corresponder ao tamanho da imagem
    const img = canvas.previousElementSibling;
    if (img && img.tagName === 'IMG') {
      const imgRect = img.getBoundingClientRect();
      canvas.width = imgRect.width;
      canvas.height = imgRect.height;

      // Calcular escala
      const scaleX = imgRect.width / img.naturalWidth;
      const scaleY = imgRect.height / img.naturalHeight;

      // Desenhar mapa de calor
      if (showHeatmap) {
        const heatmapPoints = createHeatmapData();

        heatmapPoints.forEach(point => {
          const x = point.x * scaleX;
          const y = point.y * scaleY;
          const intensity = Math.min(point.intensity / 10, 1); // Normalizar intensidade
          const radius = Math.max(20, point.intensity * 3) * (heatmapIntensity / 50);

          // Criar gradiente radial para o ponto de calor
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
          gradient.addColorStop(0, `rgba(255, 0, 0, ${0.6 * intensity})`);
          gradient.addColorStop(0.3, `rgba(255, 165, 0, ${0.4 * intensity})`);
          gradient.addColorStop(0.6, `rgba(255, 255, 0, ${0.2 * intensity})`);
          gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = gradient;
          ctx.fill();
        });
      }

      // Desenhar trilha do mouse
      if (showTrail && mouseData.length > 1) {
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        mouseData.forEach((point, index) => {
          const x = point.x * scaleX;
          const y = point.y * scaleY;

          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        ctx.stroke();

        // Desenhar pontos da trilha
        mouseData.forEach(point => {
          const x = point.x * scaleX;
          const y = point.y * scaleY;

          ctx.beginPath();
          ctx.arc(x, y, 2, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.fill();
        });
      }

      // Desenhar cliques
      if (showClicks) {
        clickData.forEach(click => {
          const x = click.x * scaleX;
          const y = click.y * scaleY;

          // Círculo externo (azul)
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, 2 * Math.PI);
          ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Círculo interno (preenchido)
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 100, 255, 0.4)';
          ctx.fill();

          // Ponto central
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 100, 255, 1)';
          ctx.fill();
        });
      }
    }
  }, [mouseData, clickData, showHeatmap, showTrail, showClicks, heatmapIntensity, imageLoaded, createHeatmapData]);

  // Redesenhar quando os dados ou configurações mudarem
  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  // Status da sessão
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

  const sessionStatusInfo = getSessionStatus();

  return (
    <Box sx={{
      bgcolor: '#fafafa',
      minHeight: '100vh',
      pb: 4
    }}>
      {/* Header Limpo */}
      <Box sx={{
        bgcolor: 'white',
        borderBottom: '1px solid #e0e0e0',
        px: 4,
        py: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <Typography variant="h4" sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          color: '#2196f3',
          fontWeight: 500
        }}>
          <ThermostatAuto sx={{ fontSize: 32 }} />
          Heatmap Player
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={sessionStatusInfo.icon}
            label={sessionStatusInfo.label}
            color={sessionStatusInfo.color}
            variant="filled"
            sx={{ px: 2, py: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            Sessão: {sessionId?.slice(-8)}
          </Typography>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<Delete />}
            onClick={() => onDeleteSession(sessionId)}
            sx={{
              textTransform: 'none',
              borderRadius: 2
            }}
          >
            Deletar
          </Button>
        </Box>
      </Box>

      {images.length > 0 ? (
        <>
          {/* Player Principal - Estilo YouTube/Netflix */}
          <Box sx={{
            bgcolor: 'white',
            m: 4,
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            overflow: 'hidden'
          }}>
            {/* Área do Vídeo */}
            <Box sx={{
              position: 'relative',
              bgcolor: '#000',
              borderRadius: '12px 12px 0 0',
              overflow: 'hidden'
            }}>
              <Box sx={{
                position: 'relative',
                width: '100%',
                paddingTop: '56.25%', // 16:9 aspect ratio
                overflow: 'hidden'
              }}>
                <img
                  src={getImageUrl(images[currentIndex])}
                  alt={`Frame ${currentIndex + 1}`}
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                />
              </Box>
            </Box>

            {/* Controles do Player - Estilo Moderno */}
            <Box sx={{
              bgcolor: '#f8f9fa',
              p: 3,
              borderTop: '1px solid #e9ecef'
            }}>
              {/* Barra de Progresso */}
              <Box sx={{ mb: 3 }}>
                <Slider
                  value={currentIndex}
                  min={0}
                  max={Math.max(images.length - 1, 0)}
                  onChange={(e, value) => onIndexChange(value)}
                  sx={{
                    color: '#2196f3',
                    height: 6,
                    '& .MuiSlider-thumb': {
                      width: 16,
                      height: 16,
                      '&:hover': {
                        boxShadow: '0 0 0 8px rgba(33, 150, 243, 0.16)'
                      }
                    },
                    '& .MuiSlider-track': {
                      height: 6,
                      borderRadius: 3
                    },
                    '& .MuiSlider-rail': {
                      height: 6,
                      borderRadius: 3,
                      bgcolor: '#e0e0e0'
                    }
                  }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {formatDuration((images[currentIndex]?.timestamp || 0) - (images[0]?.timestamp || 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDuration(stats.duration)}
                  </Typography>
                </Box>
              </Box>

              {/* Controles Principais */}
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <IconButton
                    onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    sx={{
                      color: '#2196f3',
                      '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.08)' }
                    }}
                  >
                    <SkipPrevious />
                  </IconButton>
                  <IconButton
                    onClick={onPlayPause}
                    sx={{
                      bgcolor: '#2196f3',
                      color: 'white',
                      width: 56,
                      height: 56,
                      '&:hover': {
                        bgcolor: '#1976d2',
                        transform: 'scale(1.05)'
                      },
                      transition: 'all 0.2s ease',
                      mx: 1
                    }}
                  >
                    {isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  <IconButton
                    onClick={() => onIndexChange(Math.min(images.length - 1, currentIndex + 1))}
                    disabled={currentIndex === images.length - 1}
                    sx={{
                      color: '#2196f3',
                      '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.08)' }
                    }}
                  >
                    <SkipNext />
                  </IconButton>
                  <IconButton
                    onClick={onStop}
                    sx={{
                      color: '#666',
                      ml: 1,
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                    }}
                  >
                    <Stop />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {currentIndex + 1} / {images.length}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 150 }}>
                    <VolumeUp sx={{ color: '#666', fontSize: 20 }} />
                    <Slider
                      value={playbackSpeed}
                      min={42}
                      max={2000}
                      step={1}
                      onChange={(e, value) => onSpeedChange(value)}
                      sx={{
                        color: '#2196f3',
                        '& .MuiSlider-thumb': {
                          width: 14,
                          height: 14
                        }
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35 }}>
                      {(1000 / playbackSpeed).toFixed(1)}x
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => setShowControls(!showControls)}
                    sx={{
                      color: '#666',
                      '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' }
                    }}
                  >
                    <Settings />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Controles de Heatmap - Design Limpo */}
          {showControls && (
            <Grid container spacing={4} sx={{ px: 4 }}>
              <Grid item xs={12} md={4}>
                <Card sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: '#2196f3',
                      fontWeight: 600
                    }}>
                      <ThermostatAuto /> Visualização
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showHeatmap}
                            onChange={(e) => setShowHeatmap(e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Mapa de Calor"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showTrail}
                            onChange={(e) => setShowTrail(e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Trilha do Mouse"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={showClicks}
                            onChange={(e) => setShowClicks(e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Cliques"
                        sx={{
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Box>
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="body2" gutterBottom sx={{ fontWeight: 500 }}>
                        Intensidade: {heatmapIntensity}%
                      </Typography>
                      <Slider
                        value={heatmapIntensity}
                        onChange={(e, value) => setHeatmapIntensity(value)}
                        min={10}
                        max={100}
                        step={10}
                        sx={{
                          color: '#2196f3',
                          '& .MuiSlider-thumb': {
                            width: 16,
                            height: 16
                          }
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: '#2196f3',
                      fontWeight: 600
                    }}>
                      📊 Estatísticas
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box sx={{
                          textAlign: 'center',
                          p: 2.5,
                          bgcolor: '#f8f9fa',
                          borderRadius: 2,
                          border: '1px solid #e9ecef'
                        }}>
                          <Typography variant="h4" sx={{
                            color: '#2196f3',
                            fontWeight: 600
                          }}>
                            {stats.totalFrames}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Frames
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{
                          textAlign: 'center',
                          p: 2.5,
                          bgcolor: '#f8f9fa',
                          borderRadius: 2,
                          border: '1px solid #e9ecef'
                        }}>
                          <Typography variant="h4" sx={{
                            color: '#ff9800',
                            fontWeight: 600
                          }}>
                            {formatDuration(stats.duration)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            Duração
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card sx={{
                  height: '100%',
                  borderRadius: 3,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
                }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: '#2196f3',
                      fontWeight: 600
                    }}>
                      🎯 Interações
                      {lastDataUpdate > 0 && (
                        <Chip
                          label="Atualizado"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Chip
                        icon={<Mouse />}
                        label={`${mouseData.length} Movimentos`}
                        color="primary"
                        variant="outlined"
                        sx={{
                          justifyContent: 'flex-start',
                          py: 2,
                          '& .MuiChip-label': { fontWeight: 500 }
                        }}
                      />
                      <Chip
                        icon={<TouchApp />}
                        label={`${clickData.length} Cliques`}
                        color="secondary"
                        variant="outlined"
                        sx={{
                          justifyContent: 'flex-start',
                          py: 2,
                          '& .MuiChip-label': { fontWeight: 500 }
                        }}
                      />
                      <Chip
                        icon={<ThermostatAuto />}
                        label={`${createHeatmapData().length} Zonas de Calor`}
                        color="success"
                        variant="outlined"
                        sx={{
                          justifyContent: 'flex-start',
                          py: 2,
                          '& .MuiChip-label': { fontWeight: 500 }
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      ) : (
        <Box sx={{
          textAlign: 'center',
          py: 12,
          bgcolor: 'white',
          m: 4,
          borderRadius: 3,
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
        }}>
          <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
            📹 Nenhuma captura encontrada
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Esta sessão ainda não possui dados de captura de tela
          </Typography>
        </Box>
      )}
    </Box>
  );
});
