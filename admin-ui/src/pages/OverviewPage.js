import React from 'react';
import { OverviewStats } from '../components/OverviewStats';
import { Box, Typography } from '@mui/material';

const MOCK_STATS = {
  totalSessions: 1,
  totalImages: 12,
  totalClicks: 5,
  avgSessionTime: 120000,
  sessionDetails: {
    'mock-session': {
      sessionId: 'mock-session',
      totalImages: 12,
      fastImages: 4,
      regularImages: 8,
      estimatedClicks: 5,
      duration: 120000,
      startTime: new Date(Date.now() - 120000),
      endTime: new Date(),
      lastImageTime: new Date(),
      avgInterval: 10000,
      activityByHour: { [new Date().getHours()]: 12 },
      isActive: true,
      isDisconnected: false,
      realEndTime: Date.now()
    }
  }
};

export default function OverviewPage({ sessionStats, lastUpdateTime, wsStats }) {
  // If there is no data, show an empty state
  if (!sessionStats || !sessionStats.totalSessions) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <img src="https://cdn-icons-png.flaticon.com/512/4076/4076549.png" alt="No data" width={120} style={{ opacity: 0.3, marginBottom: 16 }} />
        <h2>No connection or data available</h2>
        <p>Check if the backend is online or wait for new sessions.</p>
      </div>
    );
  }

  return (
    <OverviewStats
      stats={sessionStats}
      lastUpdateTime={lastUpdateTime}
      wsStats={wsStats}
    />
  );
}
