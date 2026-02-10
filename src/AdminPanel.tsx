import React, { useState, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { ContractClient } from './contract';
import { iso2ToNumeric, iso3ToIso2 } from './countryCodes';

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
                // Try ISO_NUMERIC first, then convert from ISO2/ISO3
                let code = feature.properties?.ISO_NUMERIC;
                const name = feature.properties?.name || feature.properties?.NAME;
                // Check both properties.id and feature-level id (which is ISO3)
                const iso3 = feature.id || feature.properties?.id;
                const iso2 = feature.properties?.ISO2;
                
                // If no ISO_NUMERIC, try to convert from ISO2 or ISO3
                if (!code) {
                  if (iso2) {
                    code = iso2ToNumeric(iso2);
                  } else if (iso3) {
                    // Convert ISO3 to ISO2 first, then to numeric
                    const iso2FromIso3 = iso3ToIso2(iso3);
                    if (iso2FromIso3) {
                      code = iso2ToNumeric(iso2FromIso3);
                    }
                  }
                }
                
                if (code && name) {
                  return { code: Number(code), name: String(name), iso2: String(iso2 || iso3ToIso2(iso3) || '') };
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

  // Determine if a country is currently allowed based on the policy
  const isCountryAllowed = (countryCode: number): boolean => {
    if (defaultAllowAll) {
      // If default is allow all, allowedCountries acts as a denylist
      // Country is allowed if it's NOT in the denylist
      return !allowedCountries.has(countryCode);
    } else {
      // If default is deny all, allowedCountries acts as an allowlist
      // Country is allowed if it IS in the allowlist
      return allowedCountries.has(countryCode);
    }
  };

  const handleToggleCountry = async (countryCode: number) => {
    setIsLoading(true);
    try {
      const currentlyAllowed = isCountryAllowed(countryCode);
      // Toggle: if currently allowed, deny it; if currently denied, allow it
      await contractClient.setCountryAllowed(countryCode, !currentlyAllowed);
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
        let countryCode = features[0].properties?.ISO_NUMERIC;
        if (!countryCode) {
          // Check feature-level id (ISO3) and properties
          const iso3 = features[0].id;
          const iso2 = features[0].properties?.ISO2;
          
          if (iso2) {
            countryCode = iso2ToNumeric(iso2);
          } else if (iso3) {
            // Convert ISO3 to ISO2 first, then to numeric
            // Ensure iso3 is a string
            const iso3Str = typeof iso3 === 'string' ? iso3 : String(iso3);
            const iso2FromIso3 = iso3ToIso2(iso3Str);
            if (iso2FromIso3) {
              countryCode = iso2ToNumeric(iso2FromIso3);
            }
          }
        }
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
          const isAllowed = isCountryAllowed(country.code);
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
