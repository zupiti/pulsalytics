import React, { memo, useCallback, useMemo } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Chip, Avatar, IconButton, Paper, Badge
} from '@mui/material';
import {
  Timeline, Visibility, SignalWifiOff, Schedule, TouchApp, 
  VideoLibrary, Delete, Warning
} from '@mui/icons-material';

// Componente de Lista de Sessões com Estatísticas
export const SessionsList = memo(function SessionsList({ 
  stats, 
  groups, 
  selectedSession, 
  onSelectSession, 
  onCreateVideo, 
  onDeleteSession, 
  disconnectedSessions, 
  sessionStatus 
}) {
  const formatDuration = useCallback((ms) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
    return `${Math.round(ms / 3600000)}h`;
  }, []);

  const getSessionDisplayName = useCallback((sessionId) => {
    // Extrair porta automaticamente do sessionId
    const portMatch = sessionId.match(/localhost[_:](\d+)/);
    const userMatch = sessionId.match(/user_([^_]+)/);
    const hostMatch = sessionId.match(/(https?:\/\/[^_]+)/);

    let displayName = '';
    let icon = '👤';

    // Determinar ícone baseado na porta ou contexto
    if (portMatch) {
      const port = portMatch[1];
      switch (port) {
        case '3000':
        case '3001':
          icon = '⚛️';
          displayName = `React App (${port})`;
          break;
        case '5000':
          icon = '🖥️';
          displayName = `Flutter Desktop (${port})`;
          break;
        case '8080':
          icon = '🚀';
          displayName = `ExaConecta (${port})`;
          break;
        case '8090':
          icon = '🌐';
          displayName = `Flutter Web (${port})`;
          break;
        default:
          icon = '💻';
          displayName = `Local App (${port})`;
      }
    } else if (hostMatch) {
      // Para URLs completas (produção)
      const host = hostMatch[1];
      icon = '🌍';
      displayName = `Web App (${host.replace('https://', '').replace('http://', '')})`;
    } else if (userMatch) {
      // Para IDs com user_
      icon = '👤';
      displayName = `User ${userMatch[1]}`;
    } else {
      // Fallback genérico
      icon = '👤';
      const parts = sessionId.split('_');
      displayName = parts[1] ? `Usuário ${parts[1]}` : 'Sessão Anônima';
    }

    return `${icon} ${displayName}`;
  }, []);

  const getSessionStatus = useCallback((sessionId, detail) => {
    const isDisconnected = disconnectedSessions.has(sessionId);
    const serverStatus = sessionStatus[sessionId]?.status;

    if (isDisconnected || serverStatus === 'disconnected') {
      return {
        label: 'Offline',
        color: 'error',
        icon: <SignalWifiOff fontSize="small" />,
        description: 'Usuário desconectado'
      };
    } else if (detail.isActive) {
      return {
        label: 'Online',
        color: 'success',
        icon: <Visibility fontSize="small" />,
        description: 'Usuário ativo agora'
      };
    } else {
      return {
        label: 'Offline',
        color: 'warning',
        icon: <Schedule fontSize="small" />,
        description: 'Usuário inativo'
      };
    }
  }, [disconnectedSessions, sessionStatus]);

  // Memoizar dados para evitar re-renders
  const sessionCounts = useMemo(() => {
    const onlineCount = Object.values(stats.sessionDetails || {})
      .filter(detail => detail.isActive && !disconnectedSessions.has(detail.sessionId)).length;
    const offlineCount = disconnectedSessions.size;
    const inactiveCount = Object.keys(stats.sessionDetails || {}).length - onlineCount - offlineCount;
    
    return { onlineCount, offlineCount, inactiveCount };
  }, [stats.sessionDetails, disconnectedSessions]);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Timeline /> Sessões Detalhadas
        </Typography>

        {/* Resumo de Status */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            label={`${sessionCounts.onlineCount} Online`}
            color="success"
            size="small"
            icon={<Visibility fontSize="small" />}
          />
          <Chip
            label={`${sessionCounts.offlineCount} Offline`}
            color="error"
            size="small"
            icon={<SignalWifiOff fontSize="small" />}
          />
          {sessionCounts.inactiveCount > 0 && (
            <Chip
              label={`${sessionCounts.inactiveCount} Inativo`}
              color="warning"
              size="small"
              icon={<Schedule fontSize="small" />}
            />
          )}
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Sessão</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Capturas</TableCell>
              <TableCell align="center">Cliques</TableCell>
              <TableCell align="center">Duração</TableCell>
              <TableCell align="center">Última Atividade</TableCell>
              <TableCell align="center">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(stats.sessionDetails || {}).map(([sessionId, detail]) => {
              const status = getSessionStatus(sessionId, detail);
              const isDisconnected = disconnectedSessions.has(sessionId);

              return (
                <TableRow
                  key={sessionId}
                  sx={{
                    bgcolor: selectedSession === sessionId ? 'action.selected' :
                      isDisconnected ? 'error.light' : 'inherit',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    opacity: isDisconnected ? 0.7 : 1
                  }}
                  onClick={() => onSelectSession(sessionId)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{
                        width: 32,
                        height: 32,
                        bgcolor: isDisconnected ? 'error.main' :
                          detail.isActive ? 'success.main' : 'grey.400'
                      }}>
                        {getSessionDisplayName(sessionId).charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          {getSessionDisplayName(sessionId)}
                          {isDisconnected && (
                            <Chip
                              label="DESCONECTADO"
                              size="small"
                              color="error"
                              sx={{ ml: 1, fontSize: '0.7rem' }}
                            />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {sessionId.substring(0, 30)}...
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={status.label}
                      color={status.color}
                      size="small"
                      icon={status.icon}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Badge badgeContent={detail.fastImages} color="primary">
                      <Chip label={detail.totalImages} variant="outlined" />
                    </Badge>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <TouchApp fontSize="small" />
                      {detail.estimatedClicks}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {formatDuration(detail.duration)}
                      </Typography>
                      {detail.isActive && (
                        <Typography variant="caption" color="success.main">
                          (em andamento)
                        </Typography>
                      )}
                      {detail.isDisconnected && (
                        <Typography variant="caption" color="error.main">
                          (finalizada)
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <Typography variant="caption">
                        {detail.isActive ?
                          'Agora' :
                          detail.lastImageTime.toLocaleTimeString()
                        }
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {detail.isActive ?
                          'Ativo' :
                          detail.isDisconnected ?
                            'Desconectado' :
                            'Inativo'
                        }
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateVideo(sessionId);
                        }}
                        color="primary"
                        title="Reproduzir vídeo"
                      >
                        <VideoLibrary />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(sessionId);
                        }}
                        color="error"
                        title="Deletar sessão"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Aviso sobre sessões desconectadas */}
      {disconnectedSessions.size > 0 && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'warning.light' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="warning" />
            <Typography variant="body2" color="warning.dark">
              {disconnectedSessions.size} sessão(ões) desconectada(s).
              Use o botão de deletar para remover sessões que não serão mais utilizadas.
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );
});
