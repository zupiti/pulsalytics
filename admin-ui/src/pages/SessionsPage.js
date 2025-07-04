import React from 'react';
import { SessionsList } from '../components/SessionsList';

export default function SessionsPage({ 
  sessionStats, 
  groups, 
  selectedSession, 
  onSelectSession, 
  onCreateVideo, 
  onDeleteSession, 
  disconnectedSessions, 
  sessionStatus 
}) {
  return (
    <SessionsList
      stats={sessionStats}
      groups={groups}
      selectedSession={selectedSession}
      onSelectSession={onSelectSession}
      onCreateVideo={onCreateVideo}
      onDeleteSession={onDeleteSession}
      disconnectedSessions={disconnectedSessions}
      sessionStatus={sessionStatus}
    />
  );
}
