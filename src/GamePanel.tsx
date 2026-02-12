import React from 'react';

interface GamePanelProps {
  onShareLocation: () => void;
  sessionLink: string;
  playerLocation: [number, number] | null;
  showOtherUsers: boolean;
  onToggleShowUsers: (show: boolean) => void;
  maxDistance: number;
  onDistanceChange: (distance: number) => void;
  otherUsersCount: number;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

export const GamePanel: React.FC<GamePanelProps> = ({
  onShareLocation,
  sessionLink,
  playerLocation,
  showOtherUsers,
  onToggleShowUsers,
  maxDistance,
  onDistanceChange,
  otherUsersCount,
  minimized = false,
  onToggleMinimize,
}) => {
  const copyLink = () => {
    navigator.clipboard.writeText(sessionLink);
    alert('Session link copied to clipboard!');
  };

  return (
    <div className="game-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: minimized ? '0' : '16px', gap: '8px' }}>
        <h3 style={{ margin: 0, flex: 1, whiteSpace: 'nowrap' }}>GeoTrust Match</h3>
        {onToggleMinimize && (
          <button 
            className="icon-button" 
            onClick={onToggleMinimize} 
            title={minimized ? 'Expand' : 'Minimize'}
            style={{ fontSize: '10px', padding: '1px 3px', width: '18px', height: '18px', flexShrink: 0 }}
          >
            {minimized ? '▼' : '▲'}
          </button>
        )}
      </div>
      {!minimized && (
        <>
      <button className="primary-button" onClick={onShareLocation}>
        {playerLocation ? 'Update Location' : 'Share Location / Join Game'}
      </button>
      {sessionLink && (
        <div>
          <p>Session Link:</p>
          <div className="session-link" onClick={copyLink} style={{ cursor: 'pointer' }}>
            {sessionLink}
          </div>
          <small>Click to copy</small>
        </div>
      )}
      {playerLocation && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
          Location: {playerLocation[1].toFixed(4)}, {playerLocation[0].toFixed(4)}
        </div>
      )}
      <div className="filter-section">
        <label>
          <input
            type="checkbox"
            checked={showOtherUsers}
            onChange={(e) => onToggleShowUsers(e.target.checked)}
          />
          Show Other Players ({otherUsersCount})
        </label>
        {showOtherUsers && (
          <>
            <label style={{ marginTop: '12px', display: 'block' }}>
              Max Distance: {maxDistance} km
            </label>
            <input
              type="range"
              min="100"
              max="20000"
              step="100"
              value={maxDistance}
              onChange={(e) => onDistanceChange(Number(e.target.value))}
            />
            <div className="range-label">
              <span>100 km</span>
              <span>20,000 km</span>
            </div>
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
};
