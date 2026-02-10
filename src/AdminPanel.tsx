import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { ContractClient } from './contract';

interface AdminPanelProps {
  contractClient: ContractClient;
  allowedCountries: Set<number>;
  defaultAllowAll: boolean;
  onCountryToggle: () => void;
  map: mapboxgl.Map | null;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  contractClient,
  allowedCountries,
  defaultAllowAll,
  onCountryToggle,
  map,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [countryList, setCountryList] = useState<Array<{ code: number; name: string; iso2: string }>>([]);

  // Load countries from GeoJSON file
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch('/countries.geojson');
        if (response.ok) {
          const geojson = await response.json();
          if (geojson.features) {
            const countries = geojson.features
              .map((feature: any) => {
                const code = feature.properties?.ISO_NUMERIC;
                const name = feature.properties?.NAME;
                const iso2 = feature.properties?.ISO2;
                if (code && name) {
                  return { code: Number(code), name: String(name), iso2: String(iso2 || '') };
                }
                return null;
              })
              .filter((c: any) => c !== null)
              .sort((a: any, b: any) => a.name.localeCompare(b.name));
            setCountryList(countries);
            console.log('[AdminPanel] Loaded', countries.length, 'countries from GeoJSON');
          }
        } else {
          console.warn('[AdminPanel] Failed to load countries.geojson');
        }
      } catch (error) {
        console.error('[AdminPanel] Error loading countries:', error);
      }
    };
    loadCountries();
  }, []);

  const filteredCountries = countryList.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleCountry = async (countryCode: number) => {
    setIsLoading(true);
    try {
      const isAllowed = allowedCountries.has(countryCode);
      await contractClient.setCountryAllowed(countryCode, !isAllowed);
      onCountryToggle();
    } catch (error) {
      console.error('Failed to toggle country:', error);
      alert('Failed to update country policy');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDefaultPolicy = async () => {
    setIsLoading(true);
    try {
      await contractClient.setDefaultAllowAll(!defaultAllowAll);
      onCountryToggle();
    } catch (error) {
      console.error('Failed to update default policy:', error);
      alert('Failed to update default policy');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!map) return;

    const handleCountryClick = (e: mapboxgl.MapMouseEvent) => {
      // Get country code from clicked feature
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['countries-fill'],
      });

      if (features.length > 0) {
        const countryCode = features[0].properties?.ISO_NUMERIC;
        if (countryCode) {
          handleToggleCountry(countryCode);
        }
      }
    };

    map.on('click', 'countries-fill', handleCountryClick);
    map.getCanvas().style.cursor = 'pointer';

    return () => {
      map.off('click', 'countries-fill', handleCountryClick);
      map.getCanvas().style.cursor = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, allowedCountries]);

  return (
    <div className="admin-panel">
      <h3>Admin Panel</h3>
      <div style={{ marginBottom: '12px' }}>
        <label>
          <input
            type="checkbox"
            checked={defaultAllowAll}
            onChange={handleToggleDefaultPolicy}
            disabled={isLoading}
          />
          Default: Allow All Countries
        </label>
      </div>
      <input
        type="text"
        placeholder="Search country..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        disabled={isLoading}
      />
      <div className="country-list">
        {filteredCountries.map((country) => {
          const isAllowed = allowedCountries.has(country.code);
          return (
            <div key={country.code} className="country-item">
              <span>{country.name}</span>
              <button
                className={`country-toggle ${isAllowed ? 'allowed' : 'denied'}`}
                onClick={() => handleToggleCountry(country.code)}
                disabled={isLoading}
              >
                {isAllowed ? 'Allowed' : 'Denied'}
              </button>
            </div>
          );
        })}
      </div>
      <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
        Click on map to toggle countries
      </p>
    </div>
  );
};
