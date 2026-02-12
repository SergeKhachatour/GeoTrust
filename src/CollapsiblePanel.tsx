import React from 'react';

interface CollapsiblePanelProps {
  title: string;
  minimized: boolean;
  onToggleMinimize: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  minimized,
  onToggleMinimize,
  children,
  className = '',
  style = {},
}) => {
  return (
    <div className={`game-panel ${className}`} style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: minimized ? '0' : '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>{title}</h3>
        <button 
          className="icon-button" 
          onClick={onToggleMinimize} 
          title={minimized ? 'Expand' : 'Minimize'}
          style={{ fontSize: '18px', padding: '4px 8px' }}
        >
          {minimized ? '▼' : '▲'}
        </button>
      </div>
      {!minimized && (
        <div>
          {children}
        </div>
      )}
    </div>
  );
};
