import React, { memo, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Drawer, List, ListItem, ListItemButton, ListItemText, Toolbar,
  Typography, Divider, Box
} from '@mui/material';
import { Analytics, Timeline } from '@mui/icons-material';

const drawerWidth = 280;

export const Sidebar = memo(function Sidebar({
  sortedSessionIds,
  groups,
  sessionStats,
  disconnectedSessions
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determinar qual aba está ativa baseado na rota
  const activeTab = useMemo(() => {
    if (location.pathname === '/') return 0;
    if (location.pathname === '/sessions') return 1;
    if (location.pathname.startsWith('/player/')) return 2;
    return 0;
  }, [location.pathname]);

  const handleTabChange = useCallback((tabIndex) => {
    switch (tabIndex) {
      case 0:
        navigate('/');
        break;
      case 1:
        navigate('/sessions');
        break;
      case 2:
        if (sortedSessionIds.length > 0) {
          navigate(`/online-session/${sortedSessionIds[0]}`);
        } else {
          navigate('/sessions');
        }
        break;
      default:
        navigate('/');
    }
  }, [navigate, sortedSessionIds]);

  const handleSessionClick = useCallback((sessionId) => {
    navigate(`/online-session/${sessionId}`);
  }, [navigate]);

  // Memoizar conteúdo da navegação
  const navigationContent = useMemo(() => (
    <>
      <Typography variant="subtitle1" sx={{ px: 2, mb: 1, color: '#bbb' }}>Navigation</Typography>
      <Divider sx={{ bgcolor: '#444' }} />

      <List>
        <ListItem disablePadding>
          <ListItemButton
            selected={activeTab === 0}
            onClick={() => handleTabChange(0)}
            sx={{ borderRadius: 1, mx: 1, my: 0.5 }}
          >
            <Analytics sx={{ mr: 1, color: activeTab === 0 ? '#90caf9' : '#bbb' }} />
            <ListItemText primary="Overview" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton
            selected={activeTab === 1}
            onClick={() => handleTabChange(1)}
            sx={{ borderRadius: 1, mx: 1, my: 0.5 }}
          >
            <Timeline sx={{ mr: 1, color: activeTab === 1 ? '#90caf9' : '#bbb' }} />
            <ListItemText primary="Sessions" />
          </ListItemButton>
        </ListItem>

      </List>

      <Divider sx={{ bgcolor: '#444', my: 2 }} />

      <Typography variant="subtitle1" sx={{ px: 2, mb: 1, color: '#bbb' }}>
        Active Sessions ({sortedSessionIds.length})
      </Typography>
    </>
  ), [activeTab, handleTabChange, sortedSessionIds.length]);

  // Memoizar lista de sessões
  const sessionList = useMemo(() => (
    <List sx={{
      maxHeight: 'calc(100vh - 400px)',
      overflow: 'auto',
      '&::-webkit-scrollbar': {
        width: '6px',
      },
      '&::-webkit-scrollbar-track': {
        background: '#333',
      },
      '&::-webkit-scrollbar-thumb': {
        background: '#555',
        borderRadius: '3px',
      },
      '&::-webkit-scrollbar-thumb:hover': {
        background: '#777',
      }
    }}>
      {sortedSessionIds.length === 0 && (
        <ListItem>
          <ListItemText primary={<span style={{ color: '#888' }}>No session</span>} />
        </ListItem>
      )}
      {sortedSessionIds.map((sessionId, index) => {
        const sessionDetail = sessionStats.sessionDetails?.[sessionId];
        const isDisconnected = disconnectedSessions.has(sessionId);
        const isOnline = sessionDetail?.isActive && !isDisconnected;
        const isSelected = location.pathname === `/player/${sessionId}`;

        // Verificar se deve mostrar separador
        const prevSessionId = index > 0 ? sortedSessionIds[index - 1] : null;
        const prevSessionDetail = prevSessionId ? sessionStats.sessionDetails?.[prevSessionId] : null;
        const prevIsDisconnected = prevSessionId ? disconnectedSessions.has(prevSessionId) : false;
        const prevIsOnline = prevSessionDetail?.isActive && !prevIsDisconnected;

        const showSeparator = index > 0 && (
          (prevIsOnline && !isOnline && !isDisconnected) || // Online para Inativo
          (!prevIsDisconnected && isDisconnected) // Qualquer para Desconectado
        );

        return (
          <React.Fragment key={sessionId}>
            {showSeparator && (
              <ListItem sx={{ py: 0.5 }}>
                <Divider sx={{
                  width: '100%',
                  bgcolor: '#444',
                  '&::before, &::after': {
                    borderColor: '#444',
                  }
                }} textAlign="center">
                  <Typography variant="caption" sx={{
                    color: '#666',
                    fontSize: '0.7rem',
                    px: 1,
                    textTransform: 'uppercase'
                  }}>
                    {isDisconnected ? 'Offline' : 'Inactive'}
                  </Typography>
                </Divider>
              </ListItem>
            )}
            <ListItem disablePadding>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleSessionClick(sessionId)}
                sx={{ borderRadius: 1, mx: 1, my: 0.5 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                  {/* Indicador de status online/offline */}
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: isOnline ? '#4caf50' : isDisconnected ? '#f44336' : '#ff9800',
                      flexShrink: 0
                    }}
                  />
                  <ListItemText
                    primary={
                      <span style={{
                        fontWeight: 500,
                        color: isSelected ? '#90caf9' : '#fff',
                        fontSize: '0.85rem'
                      }}>
                        {sessionId.length > 18 ? sessionId.substring(0, 18) + '...' : sessionId}
                      </span>
                    }
                    secondary={
                      <span style={{ color: '#bbb', fontSize: '0.75rem' }}>
                        {`${groups[sessionId]?.length || 0} frames • ${isOnline ? 'Online' : isDisconnected ? 'Offline' : 'Inactive'}`}
                      </span>
                    }
                  />
                </Box>
              </ListItemButton>
            </ListItem>
          </React.Fragment>
        );
      })}
    </List>
  ), [sortedSessionIds, sessionStats.sessionDetails, disconnectedSessions, groups, location.pathname, handleSessionClick]);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: '#23272f',
          color: '#fff'
        },
      }}
    >
      <Toolbar />
      <Box sx={{ overflow: 'auto', pt: 2 }}>
        {navigationContent}
        {sessionList}
      </Box>
    </Drawer>
  );
});
