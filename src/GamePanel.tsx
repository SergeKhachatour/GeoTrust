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
}) => {
  const copyLink = () => {
    navigator.clipboard.writeText(sessionLink);
    alert('Session link copied to clipboard!');
  };

  return (
    <div className="game-panel">
      <h3>GeoTrust Match</h3>
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
    </div>
  );
};
