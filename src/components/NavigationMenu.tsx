import React, { useState } from 'react';
import './NavigationMenu.css';
import { SearchPanel } from './SearchPanel';

interface NavigationMenuProps {
  onNavigate: (section: string) => void;
  activeSection: string | null;
  walletAddress: string | null;
  isAdmin: boolean;
  onSettingsClick?: () => void;
  map: mapboxgl.Map | null;
  markerUpdateTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  onNavigate,
  activeSection,
  walletAddress,
  isAdmin,
  onSettingsClick,
  map,
  markerUpdateTimeoutRef,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const menuItems = [
    { id: 'smart-contracts', label: 'Smart Contracts', icon: '📜', requiresWallet: false },
    { id: 'sessions', label: 'Sessions', icon: '🎮', requiresWallet: false },
    { id: 'pending-deposits', label: 'Pending Deposits', icon: '💰', requiresWallet: true },
    { id: 'admin', label: 'Admin', icon: '⚙️', requiresWallet: true, requiresAdmin: true },
  ].filter(item => {
    if (item.requiresWallet && !walletAddress) return false;
    if (item.requiresAdmin && !isAdmin) return false;
    return true;
  });

  const handleItemClick = (itemId: string) => {
    onNavigate(itemId);
    setIsOpen(false);
  };

  const handleSearchClick = () => {
    setShowSearchPanel(!showSearchPanel);
  };

  const handleSettingsClick = () => {
    if (onSettingsClick) {
      onSettingsClick();
    }
  };

  return (
    <div className="navigation-menu">
      {/* Search and Settings buttons to the left of hamburger */}
      <div className="navigation-menu-actions">
        <button
          className="navigation-action-button"
          onClick={handleSearchClick}
          title="Search"
          aria-label="Search"
        >
          🔍
        </button>
        <button
          className="navigation-action-button"
          onClick={handleSettingsClick}
          title="Settings"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>

      <button
        className="navigation-menu-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Menu"
        aria-label="Toggle menu"
      >
        <span className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>
      
      {isOpen && (
        <nav className="navigation-menu-items">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`navigation-menu-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => handleItemClick(item.id)}
              title={item.label}
            >
              <span className="navigation-menu-icon">{item.icon}</span>
              <span className="navigation-menu-label">{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Search Panel - opens to the left of search button */}
      <SearchPanel
        isOpen={showSearchPanel}
        onClose={() => setShowSearchPanel(false)}
        map={map}
        markerUpdateTimeoutRef={markerUpdateTimeoutRef}
      />
    </div>
  );
};
