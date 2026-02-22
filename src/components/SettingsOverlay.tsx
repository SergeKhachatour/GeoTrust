import React, { useEffect } from 'react';
import './SettingsOverlay.css';

interface SettingsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  map: mapboxgl.Map | null;
  mapFilters: {
    showUsers: boolean;
    showNFTs: boolean;
    showContracts: boolean;
  };
  onMapFiltersChange: (filters: { showUsers: boolean; showNFTs: boolean; showContracts: boolean }) => void;
  mapStyle: string;
  onMapStyleChange: (style: string) => void;
  enable3D: boolean;
  onEnable3DChange: (enabled: boolean) => void;
  show3DBuildings: boolean;
  onShow3DBuildingsChange: (enabled: boolean) => void;
  showTerrain: boolean;
  onShowTerrainChange: (enabled: boolean) => void;
}

export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  isOpen,
  onClose,
  map,
  mapFilters,
  onMapFiltersChange,
  mapStyle,
  onMapStyleChange,
  enable3D,
  onEnable3DChange,
  show3DBuildings,
  onShow3DBuildingsChange,
  showTerrain,
  onShowTerrainChange,
}) => {
  const handleMapStyleChange = (style: string) => {
    if (!map) return;
    
    const styleMap: { [key: string]: string } = {
      'streets': 'mapbox://styles/mapbox/streets-v12',
      'satellite': 'mapbox://styles/mapbox/satellite-streets-v12',
      'light': 'mapbox://styles/mapbox/light-v11',
      'dark': 'mapbox://styles/mapbox/dark-v11',
      'outdoors': 'mapbox://styles/mapbox/outdoors-v12',
      'navigation': 'mapbox://styles/mapbox/navigation-day-v1',
    };

    const styleUrl = styleMap[style] || styleMap['light'];
    map.setStyle(styleUrl);
    onMapStyleChange(styleUrl);
  };

  const handleFilterChange = (filter: 'showUsers' | 'showNFTs' | 'showContracts', value: boolean) => {
    onMapFiltersChange({
      ...mapFilters,
      [filter]: value,
    });
  };

  // Update 3D settings when they change
  useEffect(() => {
    if (!map || !isOpen) return;

    const update3DSettings = () => {
      // Enable/disable 3D view (pitch and rotation)
      if (enable3D) {
        // Allow pitch and rotation
        if (map.dragRotate) {
          map.dragRotate.enable();
        }
        // Touch rotation is enabled by default in Mapbox GL JS
      } else {
        // Disable pitch and rotation
        if (map.dragRotate) {
          map.dragRotate.disable();
        }
        // Reset pitch to 0
        map.easeTo({ pitch: 0, bearing: 0 });
      }

      // Show/hide 3D buildings
      if (map.getLayer('3d-buildings')) {
        map.setLayoutProperty('3d-buildings', 'visibility', show3DBuildings ? 'visible' : 'none');
      } else if (show3DBuildings && enable3D) {
        // Add 3D buildings layer if it doesn't exist
        map.once('style.load', () => {
          if (map.getSource('composite')) {
            map.addLayer({
              'id': '3d-buildings',
              'source': 'composite',
              'source-layer': 'building',
              'filter': ['==', 'extrude', 'true'],
              'type': 'fill-extrusion',
              'minzoom': 14,
              'paint': {
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  14,
                  0,
                  15,
                  ['get', 'height']
                ],
                'fill-extrusion-base': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  14,
                  0,
                  15,
                  ['get', 'min_height']
                ],
                'fill-extrusion-opacity': 0.6
              }
            });
          }
        });
      }

      // Show/hide terrain
      if (map.getSource('mapbox-dem')) {
        if (showTerrain && enable3D) {
          // Enable terrain
          map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
        } else {
          // Disable terrain
          map.setTerrain(null);
        }
      } else if (showTerrain && enable3D) {
        // Add terrain source if it doesn't exist
        map.once('style.load', () => {
          if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', {
              type: 'raster-dem',
              url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
              tileSize: 256,
              maxzoom: 14
            });
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          }
        });
      }
    };

    update3DSettings();
  }, [map, isOpen, enable3D, show3DBuildings, showTerrain]);

  if (!isOpen) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="settings-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>Map Settings</h2>
          <button className="overlay-close-button" onClick={onClose}>×</button>
        </div>
        <div className="overlay-content">
          <div className="settings-section">
            <h3>Map Style:</h3>
            <div className="settings-options">
              <button 
                className={`settings-option ${mapStyle.includes('light') ? 'active' : ''}`}
                onClick={() => handleMapStyleChange('light')}
              >
                Light
              </button>
              <button 
                className={`settings-option ${mapStyle.includes('streets') ? 'active' : ''}`}
                onClick={() => handleMapStyleChange('streets')}
              >
                Streets
              </button>
              <button 
                className={`settings-option ${mapStyle.includes('satellite') ? 'active' : ''}`}
                onClick={() => handleMapStyleChange('satellite')}
              >
                Satellite
              </button>
              <button 
                className={`settings-option ${mapStyle.includes('dark') ? 'active' : ''}`}
                onClick={() => handleMapStyleChange('dark')}
              >
                Dark
              </button>
              <button 
                className={`settings-option ${mapStyle.includes('outdoors') ? 'active' : ''}`}
                onClick={() => handleMapStyleChange('outdoors')}
              >
                Outdoors
              </button>
              <button 
                className={`settings-option ${mapStyle.includes('navigation') ? 'active' : ''}`}
                onClick={() => handleMapStyleChange('navigation')}
              >
                Navigation
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>Show Markers:</h3>
            <div className="settings-checkboxes">
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={mapFilters.showUsers}
                  onChange={(e) => handleFilterChange('showUsers', e.target.checked)}
                />
                <span>Users</span>
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={mapFilters.showNFTs}
                  onChange={(e) => handleFilterChange('showNFTs', e.target.checked)}
                />
                <span>NFTs</span>
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={mapFilters.showContracts}
                  onChange={(e) => handleFilterChange('showContracts', e.target.checked)}
                />
                <span>Smart Contracts</span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>3D Features:</h3>
            <div className="settings-checkboxes">
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={enable3D}
                  onChange={(e) => onEnable3DChange(e.target.checked)}
                />
                <span>Enable 3D View</span>
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={show3DBuildings}
                  onChange={(e) => onShow3DBuildingsChange(e.target.checked)}
                  disabled={!enable3D}
                />
                <span>Show 3D Buildings</span>
              </label>
              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={showTerrain}
                  onChange={(e) => onShowTerrainChange(e.target.checked)}
                  disabled={!enable3D}
                />
                <span>Show Terrain</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
