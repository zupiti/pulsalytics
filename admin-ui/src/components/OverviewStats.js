import React, { memo, useCallback, useMemo } from 'react';
import {
  Box, Typography, Card, Grid, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Accordion, AccordionSummary,
  AccordionDetails, Paper
} from '@mui/material';
import SettingsEthernet from '@mui/icons-material/SettingsEthernet';
import WifiTethering from '@mui/icons-material/WifiTethering';
import CloudUpload from '@mui/icons-material/CloudUpload';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Person from '@mui/icons-material/Person';
import NetworkCheck from '@mui/icons-material/NetworkCheck';
import Memory from '@mui/icons-material/Memory';
import Analytics from '@mui/icons-material/Analytics';
import Visibility from '@mui/icons-material/Visibility';
import TouchApp from '@mui/icons-material/TouchApp';
import Schedule from '@mui/icons-material/Schedule';

// Componente para monitorar WebSocket
export const WebSocketMonitor = memo(function WebSocketMonitor({ wsStats, activeConnections }) {
  const totalConnections = Object.keys(activeConnections || {}).length;
  const activeUploads = Object.values(activeConnections || {}).filter(conn => conn.uploading).length;

  return (
    <Card sx={{ mb: 2, p: 2 }}>
      <Typography variant="h6" gutterBottom>
        <SettingsEthernet sx={{ mr: 1, verticalAlign: 'middle' }} />
        Monitor WebSocket
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <WifiTethering color={totalConnections > 0 ? 'success' : 'disabled'} sx={{ fontSize: 40 }} />
            <Typography variant="h6">{totalConnections}</Typography>
            <Typography variant="body2" color="text.secondary">
              Conexões Ativas
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <CloudUpload color={activeUploads > 0 ? 'warning' : 'disabled'} sx={{ fontSize: 40 }} />
            <Typography variant="h6">{activeUploads}</Typography>
            <Typography variant="body2" color="text.secondary">
              Uploads Ativos
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Memory color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h6">{wsStats?.totalMessages || 0}</Typography>
            <Typography variant="body2" color="text.secondary">
              Mensagens Total
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={12} md={3}>
          <Box sx={{ textAlign: 'center' }}>
            <NetworkCheck color="info" sx={{ fontSize: 40 }} />
            <Typography variant="h6">{wsStats?.imagesReceived || 0}</Typography>
            <Typography variant="body2" color="text.secondary">
              Imagens Recebidas
            </Typography>
          </Box>
        </Grid>
      </Grid>

      {totalConnections > 0 && (
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>Detalhes das Conexões Ativas</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Session ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Última Atividade</TableCell>
                  <TableCell>Imagens</TableCell>
                  <TableCell>Qualidade</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(activeConnections || {}).map(([sessionId, conn]) => (
                  <TableRow key={sessionId}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {sessionId.length > 20 ? `${sessionId.substring(0, 20)}...` : sessionId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={conn.uploading ? 'Uploading' : 'Connected'}
                        color={conn.uploading ? 'warning' : 'success'}
                        icon={conn.uploading ? <CloudUpload /> : <WifiTethering />}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(conn.lastActivity).toLocaleTimeString()}
                      </Typography>
                    </TableCell>
                    <TableCell>{conn.imagesReceived || 0}</TableCell>
                    <TableCell>
                      <Chip size="small" label={conn.qualityMode || 'balanced'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      )}
    </Card>
  );
});

// Componente de Estatísticas Gerais
export const OverviewStats = memo(function OverviewStats({ stats, lastUpdateTime, wsStats }) {
  const formatDuration = useCallback((ms) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
    return `${Math.round(ms / 3600000)}h`;
  }, []);

  const statCards = useMemo(() => [
    {
      title: 'Total de Sessões',
      value: stats.totalSessions || 0,
      icon: <Person />,
      color: '#1976d2'
    },
    {
      title: 'Total de Capturas',
      value: stats.totalImages || 0,
      icon: <Visibility />,
      color: '#388e3c'
    },
    {
      title: 'Cliques Estimados',
      value: stats.totalClicks || 0,
      icon: <TouchApp />,
      color: '#f57c00'
    },
    {
      title: 'Tempo Médio/Sessão',
      value: formatDuration(stats.avgSessionTime || 0),
      icon: <Schedule />,
      color: '#7b1fa2'
    }
  ], [stats, formatDuration]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Analytics /> Analytics Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ p: 2, textAlign: 'center', height: '140px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Box sx={{ color: stat.color, mb: 1 }}>
                {stat.icon}
              </Box>
              <Typography variant="h4" color={stat.color} fontWeight="bold">
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.title}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Estatísticas do WebSocket */}
      <WebSocketMonitor
        wsStats={wsStats}
        activeConnections={stats.activeConnections}
      />
    </Box>
  );
});
