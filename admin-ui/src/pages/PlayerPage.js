import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
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
  sessionStatus
}) {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Memoizar as imagens da sessão selecionada
  const images = useMemo(() => {
    return sessionId && groups ? (groups[sessionId] || []) : [];
  }, [sessionId, groups]);

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
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Sessão não encontrada ou sem imagens
        </Typography>
        <Typography variant="body1" color="text.secondary">
          A sessão "{sessionId}" não possui imagens ou não existe
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<ArrowBack />}
          onClick={() => navigate('/sessions')}
          sx={{ mt: 2 }}
        >
          Voltar para Sessões
        </Button>
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
      onPlayPause={onPlayPause}
      onStop={onStop}
      onIndexChange={onIndexChange}
      onSpeedChange={onSpeedChange}
      onDeleteSession={onDeleteSession}
      sessionStats={sessionStats}
      disconnectedSessions={disconnectedSessions}
      sessionStatus={sessionStatus}
    />
  );
}
