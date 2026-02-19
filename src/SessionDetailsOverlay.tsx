import React from 'react';
import './SessionDetailsOverlay.css';

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

interface SessionDetailsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: Session | null;
  allSessions: Session[];
  walletAddress: string | null;
  onJoinSession: (sessionId: number) => Promise<void>;
  onEndSession?: (sessionId: number) => Promise<void>;
}

export const SessionDetailsOverlay: React.FC<SessionDetailsOverlayProps> = ({
  isOpen,
  onClose,
  currentSession,
  allSessions,
  walletAddress,
  onJoinSession,
  onEndSession,
}) => {
  if (!isOpen) return null;

  const otherSessions = allSessions.filter(s => s.sessionId !== currentSession?.sessionId);
  const isPlayerInCurrentSession = currentSession && walletAddress && 
    (currentSession.player1 === walletAddress || currentSession.player2 === walletAddress);

  return (
    <div className="session-details-overlay" onClick={onClose}>
      <div className="session-details-modal" onClick={(e) => e.stopPropagation()}>
        <div className="session-details-header">
          <h2>Session Details</h2>
          <button className="session-details-close" onClick={onClose}>×</button>
        </div>
        
        <div className="session-details-content">
          {/* Current Session Details */}
          {currentSession && (
            <div className="session-details-section">
              <h3>Your Current Session</h3>
              <div className="session-info-card">
                <div className="session-info-row">
                  <span className="session-info-label">Session ID:</span>
                  <span className="session-info-value">#{currentSession.sessionId}</span>
                </div>
                <div className="session-info-row">
                  <span className="session-info-label">Status:</span>
                  <span className={`session-status session-status-${currentSession.state.toLowerCase()}`}>
                    {currentSession.state}
                  </span>
                </div>
                {currentSession.player1 && (
                  <div className="session-info-row">
                    <span className="session-info-label">Player 1:</span>
                    <span className="session-info-value">
                      {currentSession.player1.slice(0, 8)}...{currentSession.player1.slice(-6)}
                      {currentSession.player1 === walletAddress && <span className="session-you-badge"> (You)</span>}
                    </span>
                  </div>
                )}
                {currentSession.p1CellId && (
                  <div className="session-info-row">
                    <span className="session-info-label">Player 1 Cell:</span>
                    <span className="session-info-value">{currentSession.p1CellId}</span>
                  </div>
                )}
                {currentSession.p1Country && (
                  <div className="session-info-row">
                    <span className="session-info-label">Player 1 Country:</span>
                    <span className="session-info-value">{currentSession.p1Country}</span>
                  </div>
                )}
                {currentSession.player2 && (
                  <div className="session-info-row">
                    <span className="session-info-label">Player 2:</span>
                    <span className="session-info-value">
                      {currentSession.player2.slice(0, 8)}...{currentSession.player2.slice(-6)}
                      {currentSession.player2 === walletAddress && <span className="session-you-badge"> (You)</span>}
                    </span>
                  </div>
                )}
                {currentSession.p2CellId && (
                  <div className="session-info-row">
                    <span className="session-info-label">Player 2 Cell:</span>
                    <span className="session-info-value">{currentSession.p2CellId}</span>
                  </div>
                )}
                {currentSession.p2Country && (
                  <div className="session-info-row">
                    <span className="session-info-label">Player 2 Country:</span>
                    <span className="session-info-value">{currentSession.p2Country}</span>
                  </div>
                )}
                {currentSession.createdLedger && (
                  <div className="session-info-row">
                    <span className="session-info-label">Created at Ledger:</span>
                    <span className="session-info-value">{currentSession.createdLedger}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other Sessions */}
          <div className="session-details-section">
            <h3>Other Active Sessions ({otherSessions.length})</h3>
            {otherSessions.length === 0 ? (
              <div className="session-empty-state">
                <p>No other active sessions available.</p>
              </div>
            ) : (
              <div className="session-list">
                {otherSessions.map((session) => {
                  const canJoin = walletAddress && 
                    session.player1 !== walletAddress && 
                    session.player2 !== walletAddress &&
                    session.state === 'Waiting';
                  
                  return (
                    <div key={session.sessionId} className="session-item">
                      <div className="session-item-header">
                        <span className="session-item-id">Session #{session.sessionId}</span>
                        <span className={`session-item-status session-status-${session.state.toLowerCase()}`}>
                          {session.state}
                        </span>
                      </div>
                      <div className="session-item-details">
                        {session.player1 && (
                          <div className="session-item-player">
                            <strong>Player 1:</strong> {session.player1.slice(0, 8)}...{session.player1.slice(-6)}
                            {session.p1CellId && <span className="session-item-meta"> (Cell: {session.p1CellId})</span>}
                          </div>
                        )}
                        {session.player2 && (
                          <div className="session-item-player">
                            <strong>Player 2:</strong> {session.player2.slice(0, 8)}...{session.player2.slice(-6)}
                            {session.p2CellId && <span className="session-item-meta"> (Cell: {session.p2CellId})</span>}
                          </div>
                        )}
                        {!session.player2 && (
                          <div className="session-item-meta">Waiting for player 2...</div>
                        )}
                      </div>
                      {canJoin && (
                        <button
                          className="session-join-button"
                          onClick={async () => {
                            try {
                              await onJoinSession(session.sessionId);
                              onClose();
                            } catch (error: any) {
                              console.error('Failed to join session:', error);
                            }
                          }}
                        >
                          Join Session
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
