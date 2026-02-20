import React, { useState } from 'react';
import { CollapsiblePanel } from '../CollapsiblePanel';
import './CombinedSessionsPanel.css';

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

interface CombinedSessionsPanelProps {
  userCurrentSession: number | null;
  activeSessions: Session[];
  walletAddress: string | null;
  onJoinSession: (sessionId: number) => Promise<void>;
  onEndSession: (sessionId: number, isPlayer1: boolean, isPlayer2: boolean, sessionState: string) => Promise<void>;
  onViewSessionDetails: () => void;
  contractClient: any;
  gameHubId: string | null;
}

export const CombinedSessionsPanel: React.FC<CombinedSessionsPanelProps> = ({
  userCurrentSession,
  activeSessions,
  walletAddress,
  onJoinSession,
  onEndSession,
  onViewSessionDetails,
  contractClient,
  gameHubId,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'your' | 'other'>('your');

  const yourSession = userCurrentSession !== null 
    ? activeSessions.find(s => s.sessionId === userCurrentSession)
    : null;

  const otherSessions = activeSessions.filter(
    s => s.sessionId !== userCurrentSession && s.state !== 'Ended'
  );

  const sessionCount = activeSessions.filter(s => s.state !== 'Ended').length;
  const activePlayerCount = activeSessions.filter(s => s.state !== 'Ended').reduce((count, s) => {
    if (s.player1) count++;
    if (s.player2) count++;
    return count;
  }, 0);

  return (
    <CollapsiblePanel
      title={`Sessions (${sessionCount} active, ${activePlayerCount} players)`}
      minimized={minimized}
      onToggleMinimize={() => setMinimized(!minimized)}
      className="combined-sessions-panel"
      style={{ marginTop: '8px', padding: '20px' }}
    >
      {!minimized && (
        <>
          {/* Tab Navigation */}
          <div className="sessions-tabs">
            <button
              className={`session-tab ${activeTab === 'your' ? 'active' : ''}`}
              onClick={() => setActiveTab('your')}
              disabled={userCurrentSession === null}
            >
              Your Session {userCurrentSession !== null && `#${userCurrentSession}`}
            </button>
            <button
              className={`session-tab ${activeTab === 'other' ? 'active' : ''}`}
              onClick={() => setActiveTab('other')}
            >
              Other Sessions ({otherSessions.length})
            </button>
          </div>

          {/* Your Session Tab */}
          {activeTab === 'your' && userCurrentSession !== null && yourSession && (
            <div className="session-tab-content">
              <div className="session-header-section" style={{ backgroundColor: '#FFD700', color: '#000', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                  <div><strong>Session #{userCurrentSession}</strong></div>
                  <div style={{ marginTop: '4px' }}><strong>Status:</strong> {yourSession.state || 'Active'}</div>
                  {yourSession?.player1 && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>Player 1:</strong> {yourSession.player1.slice(0, 6)}...{yourSession.player1.slice(-4)}
                      {yourSession.p1CellId && <span style={{ color: '#666', fontSize: '10px' }}> (Cell: {yourSession.p1CellId})</span>}
                      {yourSession.p1Country && <span style={{ color: '#666', fontSize: '10px' }}> (Country: {yourSession.p1Country})</span>}
                    </div>
                  )}
                  {yourSession?.player2 && (
                    <div style={{ marginTop: '4px' }}>
                      <strong>Player 2:</strong> {yourSession.player2.slice(0, 6)}...{yourSession.player2.slice(-4)}
                      {yourSession.p2CellId && <span style={{ color: '#666', fontSize: '10px' }}> (Cell: {yourSession.p2CellId})</span>}
                      {yourSession.p2Country && <span style={{ color: '#666', fontSize: '10px' }}> (Country: {yourSession.p2Country})</span>}
                    </div>
                  )}
                  {yourSession.createdLedger && (
                    <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
                      Created at ledger: {yourSession.createdLedger}
                    </div>
                  )}
                </div>
                
                {walletAddress && (yourSession.player1 === walletAddress || yourSession.player2 === walletAddress) && (
                  <>
                    {(() => {
                      const isPlayer1 = yourSession.player1 === walletAddress;
                      const isPlayer2 = yourSession.player2 === walletAddress;
                      return (
                        <button
                          className="primary-button"
                  onClick={async () => {
                    await onEndSession(userCurrentSession, isPlayer1, isPlayer2, yourSession.state);
                  }}
                          style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#dc3545', color: '#fff', width: '100%', marginBottom: '8px' }}
                        >
                          {yourSession.state === 'Active' ? 'End Session (Resolve Match)' : 'End Session'}
                        </button>
                      );
                    })()}
                    <button
                      className="primary-button"
                      onClick={onViewSessionDetails}
                      style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#000', color: '#FFD700', width: '100%' }}
                    >
                      View Session Details
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'your' && userCurrentSession === null && (
            <div className="session-tab-content">
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                You are not currently in a session.
              </div>
            </div>
          )}

          {/* Other Sessions Tab */}
          {activeTab === 'other' && (
            <div className="session-tab-content">
              <div className="sessions-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {otherSessions.length > 0 ? (
                  otherSessions.map(session => (
                    <div key={session.sessionId} style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', marginBottom: '8px', fontSize: '12px' }}>
                      <div><strong>Session #{session.sessionId}</strong></div>
                      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div>
                          <strong>Player 1:</strong> {session.player1 ? (
                            <span>
                              {session.player1.slice(0, 6)}...{session.player1.slice(-4)}
                              {session.p1CellId && <span style={{ color: '#666', fontSize: '10px' }}> (Cell: {session.p1CellId})</span>}
                              {session.p1Country && <span style={{ color: '#666', fontSize: '10px' }}> (Country: {session.p1Country})</span>}
                            </span>
                          ) : 'Waiting...'}
                        </div>
                        <div>
                          <strong>Player 2:</strong> {session.player2 ? (
                            <span>
                              {session.player2.slice(0, 6)}...{session.player2.slice(-4)}
                              {session.p2CellId && <span style={{ color: '#666', fontSize: '10px' }}> (Cell: {session.p2CellId})</span>}
                              {session.p2Country && <span style={{ color: '#666', fontSize: '10px' }}> (Country: {session.p2Country})</span>}
                            </span>
                          ) : 'Waiting...'}
                        </div>
                        <div><strong>State:</strong> {session.state}</div>
                        {session.createdLedger && (
                          <div style={{ color: '#666', fontSize: '10px' }}>
                            Created at ledger: {session.createdLedger}
                          </div>
                        )}
                      </div>
                      {session.state === 'Waiting' && (
                        <button
                          className="primary-button"
                          onClick={() => onJoinSession(session.sessionId)}
                          style={{ marginTop: '8px', padding: '6px 12px', fontSize: '11px', width: '100%' }}
                          disabled={userCurrentSession !== null}
                        >
                          {userCurrentSession !== null ? 'Already in a Session' : 'Join Session'}
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                    No other active sessions.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </CollapsiblePanel>
  );
};
