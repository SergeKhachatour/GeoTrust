import React from 'react';
import { CombinedSessionsPanel } from './CombinedSessionsPanel';
import './SessionsOverlay.css';

interface Session {
  sessionId: number;
  player1: string | null;
  player2: string | null;
  state: string;
  p1CellId?: number;
  p2CellId?: number;
  p1Country?: number;
  p2Country?: number;
  createdLedger?: number;
}

interface SessionsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  userCurrentSession: number | null;
  activeSessions: Session[];
  walletAddress: string | null;
  onJoinSession: (sessionId: number) => Promise<void>;
  onEndSession: (sessionId: number, isPlayer1: boolean, isPlayer2: boolean, sessionState: string) => Promise<void>;
  onViewSessionDetails: () => void;
  contractClient: any;
  gameHubId: string | null;
}

export const SessionsOverlay: React.FC<SessionsOverlayProps> = ({
  isOpen,
  onClose,
  userCurrentSession,
  activeSessions,
  walletAddress,
  onJoinSession,
  onEndSession,
  onViewSessionDetails,
  contractClient,
  gameHubId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="sessions-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>Sessions</h2>
          <button className="overlay-close-button" onClick={onClose}>×</button>
        </div>
        <div className="sessions-overlay-content">
          <CombinedSessionsPanel
            userCurrentSession={userCurrentSession}
            activeSessions={activeSessions}
            walletAddress={walletAddress}
            onJoinSession={onJoinSession}
            onEndSession={onEndSession}
            onViewSessionDetails={onViewSessionDetails}
            contractClient={contractClient}
            gameHubId={gameHubId}
          />
        </div>
      </div>
    </div>
  );
};
