import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import './SearchPanel.css';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  map: mapboxgl.Map | null;
  markerUpdateTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  isOpen,
  onClose,
  map,
  markerUpdateTimeoutRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // Debounce search
    if (markerUpdateTimeoutRef.current) {
      clearTimeout(markerUpdateTimeoutRef.current);
    }
    markerUpdateTimeoutRef.current = setTimeout(async () => {
      if (e.target.value.length > 2) {
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(e.target.value)}.json?access_token=${mapboxgl.accessToken}&limit=5`
          );
          const data = await response.json();
          setSearchResults(data.features || []);
        } catch (error) {
          console.error('Search error:', error);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
  };

  const handleResultClick = (result: any) => {
    if (!map) return;
    
    const [lng, lat] = result.center;
    map.flyTo({
      center: [lng, lat],
      zoom: 12,
      duration: 1000
    });
    
    // Close search panel
    onClose();
    setSearchQuery('');
    setSearchResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search for a location..."
          className="search-panel-input"
          autoFocus
        />
        <button
          onClick={() => {
            onClose();
            setSearchQuery('');
            setSearchResults([]);
          }}
          className="search-panel-close"
          title="Close"
        >
          ×
        </button>
      </div>
      
      {searchResults.length > 0 && (
        <div className="search-panel-results">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="search-panel-result-item"
              onClick={() => handleResultClick(result)}
            >
              <div className="search-panel-result-name">{result.place_name}</div>
              {result.context && result.context.length > 0 && (
                <div className="search-panel-result-context">
                  {result.context.map((ctx: any, i: number) => ctx.text).join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
