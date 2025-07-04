import React from 'react';
import { OverviewStats } from '../components/OverviewStats';

export default function OverviewPage({ sessionStats, lastUpdateTime, wsStats }) {
  return (
    <OverviewStats
      stats={sessionStats}
      lastUpdateTime={lastUpdateTime}
      wsStats={wsStats}
    />
  );
}
