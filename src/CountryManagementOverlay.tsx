import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { ContractClient } from './contract';
import { ReadOnlyContractClient } from './contract-readonly';
import { iso2ToNumeric, iso3ToIso2 } from './countryCodes';
import { extractCountryInfo, validateCountryCode } from './utils/countryVaultUtils';

interface CountryManagementOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  countryCode: number;
  countryName: string;
  contractClient: ContractClient;
  walletAddress: string | null;
  mainAdminAddress: string | null;
  isMainAdmin: boolean;
  map: mapboxgl.Map | null;
}

export const CountryManagementOverlay: React.FC<CountryManagementOverlayProps> = ({
  isOpen,
  onClose,
  countryCode,
  countryName,
  contractClient,
  walletAddress,
  mainAdminAddress,
  isMainAdmin,
  map,
}) => {
  const [countryAdmin, setCountryAdmin] = useState<string | null>(null);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [isCountryAdmin, setIsCountryAdmin] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalGeoJson, setOriginalGeoJson] = useState<any>(null);
  const [currentGeoJson, setCurrentGeoJson] = useState<any>(null);
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [countryMap, setCountryMap] = useState<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const countryFeatureRef = useRef<any>(null);
  const mapRemovedRef = useRef<boolean>(false);
  
  // Country Vault state
  const [vaultInfo, setVaultInfo] = useState<any>(null);
  const [isLoadingVault, setIsLoadingVault] = useState(false);
  const [isRegisteringVault, setIsRegisteringVault] = useState(false);
  const [isTogglingVault, setIsTogglingVault] = useState(false);
  const [countryIso2, setCountryIso2] = useState<string | null>(null);

  // Check if current user is country admin
  useEffect(() => {
    const checkCountryAdmin = async () => {
      if (!contractClient || !walletAddress) {
        setIsCountryAdmin(false);
        setIsLoadingAdmin(false);
        return;
      }
      
      setIsLoadingAdmin(true);
      try {
        // Use read-only client to avoid Freighter prompts
        const readOnlyClient = new ReadOnlyContractClient();
        const admin = await readOnlyClient.getCountryAdmin(countryCode);
        setCountryAdmin(admin);
        setIsCountryAdmin(admin !== null && admin === walletAddress);
      } catch (error) {
        console.error('[CountryManagement] Failed to load country admin:', error);
        setIsCountryAdmin(false);
      } finally {
        setIsLoadingAdmin(false);
      }
    };

    if (isOpen) {
      checkCountryAdmin();
    }
  }, [isOpen, countryCode, contractClient, walletAddress]);

  // Load country policy
  useEffect(() => {
    const loadPolicy = async () => {
      setIsLoadingPolicy(true);
      try {
        // Use read-only client to avoid Freighter prompts
        const readOnlyClient = new ReadOnlyContractClient();
        const allowed = await readOnlyClient.getCountryAllowed(countryCode);
        setIsAllowed(allowed ?? false);
      } catch (error) {
        console.error('[CountryManagement] Failed to load policy:', error);
      } finally {
        setIsLoadingPolicy(false);
      }
    };

    if (isOpen) {
      loadPolicy();
    }
  }, [isOpen, countryCode, contractClient]);

  // Load country GeoJSON and extract ISO2 code
  useEffect(() => {
    const loadCountryGeoJson = async () => {
      console.log('[CountryManagement] Loading GeoJSON for country:', countryCode);
      try {
        const response = await fetch('/countries.geojson');
        if (!response.ok) throw new Error('Failed to load countries.geojson');
        
        const geojson = await response.json();
        console.log('[CountryManagement] Loaded GeoJSON, searching for country:', countryCode);
        const countryFeature = geojson.features.find((f: any) => {
          // Try ISO_NUMERIC first
          let code = f.properties?.ISO_NUMERIC;
          if (code) {
            return Number(code) === countryCode;
          }
          
          // If not found, try converting from ISO2 or ISO3 (like the main map does)
          const iso3 = f.id || f.properties?.id;
          const iso2 = f.properties?.ISO2;
          
          if (iso2) {
            code = iso2ToNumeric(iso2);
            if (code === countryCode) return true;
          }
          
          if (iso3) {
            const iso3Str = typeof iso3 === 'string' ? iso3 : String(iso3);
            const iso2FromIso3 = iso3ToIso2(iso3Str);
            if (iso2FromIso3) {
              code = iso2ToNumeric(iso2FromIso3);
              if (code === countryCode) return true;
            }
          }
          
          return false;
        });

        if (countryFeature) {
          console.log('[CountryManagement] Found country feature:', countryFeature.properties?.name);
          const featureCopy = JSON.parse(JSON.stringify(countryFeature)); // Deep copy
          setOriginalGeoJson(featureCopy);
          setCurrentGeoJson(featureCopy);
          countryFeatureRef.current = featureCopy;
          
          // Extract ISO2 code for vault operations
          const countryInfo = extractCountryInfo(countryFeature);
          if (countryInfo && countryInfo.iso2) {
            setCountryIso2(countryInfo.iso2);
          } else {
            // Fallback: try to get from properties
            const iso2 = countryFeature.properties?.ISO2 || countryFeature.properties?.iso_a2;
            if (iso2 && validateCountryCode(iso2)) {
              setCountryIso2(iso2.toUpperCase());
            } else {
              const iso3 = countryFeature.id || countryFeature.properties?.id;
              if (iso3) {
                const iso2FromIso3 = iso3ToIso2(String(iso3));
                if (iso2FromIso3 && validateCountryCode(iso2FromIso3)) {
                  setCountryIso2(iso2FromIso3.toUpperCase());
                }
              }
            }
          }
        } else {
          console.warn(`[CountryManagement] Country ${countryCode} not found in GeoJSON. Available codes:`, 
            geojson.features.slice(0, 5).map((f: any) => ({ 
              code: f.properties?.ISO_NUMERIC, 
              name: f.properties?.name || f.properties?.NAME 
            }))
          );
          // Set a flag that country wasn't found, but still allow map to initialize
          // The map will show without borders, but user can still draw new borders
          setOriginalGeoJson(null);
          setCurrentGeoJson(null);
          countryFeatureRef.current = null;
          setCountryIso2(null);
        }
      } catch (error) {
        console.error('[CountryManagement] Failed to load GeoJSON:', error);
        setCountryIso2(null);
      }
    };

    if (isOpen) {
      loadCountryGeoJson();
    } else {
      // Reset when closed
      countryFeatureRef.current = null;
      setOriginalGeoJson(undefined); // Reset to undefined to indicate not loaded
      setCurrentGeoJson(null);
      setCountryIso2(null);
      setVaultInfo(null);
      // Clean up map when overlay closes
      if (countryMap && !mapRemovedRef.current) {
        try {
          const container = countryMap.getContainer();
          if (container && container.parentNode) {
            countryMap.remove();
            mapRemovedRef.current = true;
          }
        } catch (error) {
          console.warn('[CountryManagement] Error removing map on close:', error);
        }
        setCountryMap(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, countryCode]);
  
  // Load vault info when ISO2 code is available
  useEffect(() => {
    const loadVaultInfo = async () => {
      if (!countryIso2 || !contractClient || !isOpen) {
        setVaultInfo(null);
        return;
      }
      
      setIsLoadingVault(true);
      try {
        const info = await contractClient.getCountryInfo(countryIso2);
        setVaultInfo(info);
      } catch (error) {
        console.error('[CountryManagement] Failed to load vault info:', error);
        setVaultInfo(null);
      } finally {
        setIsLoadingVault(false);
      }
    };
    
    loadVaultInfo();
  }, [countryIso2, contractClient, isOpen]);
  
  // Handle vault registration
  const handleRegisterVault = async () => {
    if (!countryIso2 || !walletAddress || !validateCountryCode(countryIso2)) {
      alert('Invalid country code or wallet address');
      return;
    }
    
    try {
      setIsRegisteringVault(true);
      await contractClient.registerCountry(countryIso2, countryName, walletAddress);
      alert(`Successfully registered ${countryIso2} (${countryName}) for country vault`);
      // Reload vault info
      const info = await contractClient.getCountryInfo(countryIso2);
      setVaultInfo(info);
    } catch (error: any) {
      console.error('[CountryManagement] Error registering vault:', error);
      if (error.message?.includes('already registered')) {
        alert(`Country ${countryIso2} is already registered`);
        // Reload to get current info
        const info = await contractClient.getCountryInfo(countryIso2);
        setVaultInfo(info);
      } else {
        alert(`Failed to register country vault: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsRegisteringVault(false);
    }
  };
  
  // Handle vault enable/disable
  const handleToggleVault = async () => {
    if (!countryIso2 || !walletAddress || !vaultInfo) {
      return;
    }
    
    try {
      setIsTogglingVault(true);
      await contractClient.setCountryEnabled(countryIso2, !vaultInfo.enabled, walletAddress);
      alert(`Successfully ${!vaultInfo.enabled ? 'enabled' : 'disabled'} country vault for ${countryIso2}`);
      // Reload vault info
      const info = await contractClient.getCountryInfo(countryIso2);
      setVaultInfo(info);
    } catch (error: any) {
      console.error('[CountryManagement] Error toggling vault:', error);
      alert(`Failed to toggle country vault: ${error.message || 'Unknown error'}`);
    } finally {
      setIsTogglingVault(false);
    }
  };

  // Initialize map for country editing
  useEffect(() => {
    console.log('[CountryManagement] Map init effect:', { 
      mapContainer: !!mapContainer, 
      isOpen, 
      hasFeature: !!countryFeatureRef.current,
      hasOriginalGeoJson: !!originalGeoJson 
    });
    
    if (!mapContainer || !isOpen) {
      console.log('[CountryManagement] Map init skipped: no container or not open');
      return;
    }
    
    // Wait for GeoJSON to load (originalGeoJson will be set to null if not found)
    if (originalGeoJson === undefined) {
      // Still loading - wait
      console.log('[CountryManagement] Waiting for country GeoJSON to load...');
      return;
    }
    
    // If we get here, either we have a feature (originalGeoJson is an object) 
    // or we've confirmed it doesn't exist (originalGeoJson is null)
    // Initialize the map either way

    // Clean up existing map if it exists
    if (countryMap && !mapRemovedRef.current) {
      console.log('[CountryManagement] Cleaning up existing map');
      try {
        // Check if map is still valid before removing
        const container = countryMap.getContainer();
        if (container && container.parentNode) {
          countryMap.remove();
          mapRemovedRef.current = true;
        }
      } catch (error) {
        console.warn('[CountryManagement] Error removing existing map:', error);
      }
      setCountryMap(null);
    }

    console.log('[CountryManagement] Initializing map with container:', mapContainer);
    const countryMapInstance = new mapboxgl.Map({
      container: mapContainer,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [0, 0],
      zoom: 2,
    });

    countryMapInstance.on('load', () => {
      console.log('[CountryManagement] Map loaded, adding country feature');
      // Add country feature to map
      const featureToUse = countryFeatureRef.current || originalGeoJson;
      if (featureToUse) {
        countryMapInstance.addSource('country', {
          type: 'geojson',
          data: featureToUse,
        });

        countryMapInstance.addLayer({
          id: 'country-fill',
          type: 'fill',
          source: 'country',
          paint: {
            'fill-color': '#088',
            'fill-opacity': 0.3,
          },
        });

        countryMapInstance.addLayer({
          id: 'country-outline',
          type: 'line',
          source: 'country',
          paint: {
            'line-color': '#088',
            'line-width': 2,
          },
        });

        // Fit map to country bounds
        const bounds = new mapboxgl.LngLatBounds();
        const coordinates = featureToUse.geometry.coordinates;
        
        const processCoordinates = (coords: any) => {
          if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            coords.forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });
          } else {
            coords.forEach((subCoords: any) => {
              processCoordinates(subCoords);
            });
          }
        };

        if (featureToUse.geometry.type === 'Polygon') {
          processCoordinates(coordinates);
        } else if (featureToUse.geometry.type === 'MultiPolygon') {
          coordinates.forEach((polygon: any) => {
            processCoordinates(polygon);
          });
        }

        countryMapInstance.fitBounds(bounds, { padding: 50 });
      } else {
        // Country not found in GeoJSON - center on a default location
        console.log('[CountryManagement] Country not found, using default center');
        countryMapInstance.setCenter([0, 0]);
        countryMapInstance.setZoom(2);
      }

      // Initialize Mapbox Draw for editing
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: 'simple_select',
      });

      countryMapInstance.addControl(draw);
      drawRef.current = draw;

      // Load existing country geometry into draw (if it exists)
      // Reuse featureToUse from above (already declared in this scope)
      if (featureToUse) {
        // Create a feature for draw (draw expects features with id)
        const drawFeature = {
          ...featureToUse,
          id: 'country-feature',
        };
        draw.add(drawFeature);
      }
      // If no feature exists, user can draw a new border from scratch

      // Track changes
      countryMapInstance.on('draw.update', () => {
        setHasChanges(true);
        const features = draw.getAll();
        if (features.features.length > 0) {
          setCurrentGeoJson(features.features[0]);
        }
      });

      countryMapInstance.on('draw.delete', () => {
        setHasChanges(true);
        setCurrentGeoJson(null);
      });

      countryMapInstance.on('draw.create', () => {
        setHasChanges(true);
        const features = draw.getAll();
        if (features.features.length > 0) {
          setCurrentGeoJson(features.features[0]);
        }
      });
    });

    setCountryMap(countryMapInstance);
    mapRemovedRef.current = false; // Reset flag when creating new map

    return () => {
      // Only clean up if the map hasn't been removed yet
      if (countryMapInstance && !mapRemovedRef.current) {
        try {
          // Check if map is still valid before removing
          const container = countryMapInstance.getContainer();
          if (container && container.parentNode) {
            // Only remove if map is loaded, otherwise just clear the container
            if (countryMapInstance.loaded()) {
              countryMapInstance.remove();
            } else {
              // Map not loaded yet, just clear the container
              container.innerHTML = '';
            }
            mapRemovedRef.current = true;
          }
        } catch (error) {
          console.warn('[CountryManagement] Error removing map in cleanup:', error);
          mapRemovedRef.current = true; // Mark as removed even on error to prevent retry
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContainer, isOpen, originalGeoJson]);

  // Check permissions
  const canEdit = isMainAdmin || isCountryAdmin;
  const canEditBorders = isMainAdmin; // Only main admin can edit borders

  const handleTogglePolicy = async () => {
    if (!contractClient || !canEdit) return;
    
    setIsLoadingPolicy(true);
    try {
      await contractClient.setCountryAllowed(countryCode, !isAllowed);
      setIsAllowed(!isAllowed);
      alert('Policy updated successfully');
    } catch (error) {
      console.error('[CountryManagement] Failed to update policy:', error);
      alert('Failed to update policy');
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  const handleSaveBorders = async () => {
    if (!canEditBorders || !currentGeoJson || !hasChanges) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      // Read current file with ETag for conflict detection
      // Use API endpoint to get ETag from backend
      const response = await fetch('/api/countries', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (!response.ok) throw new Error('Failed to read countries.geojson');
      
      // Get ETag from response (backend provides this)
      const etag = response.headers.get('ETag');
      const geojson = await response.json();

      // Find and update the country feature (using same lookup logic as loading)
      const featureIndex = geojson.features.findIndex((f: any) => {
        // Try ISO_NUMERIC first
        let code = f.properties?.ISO_NUMERIC;
        if (code) {
          return Number(code) === countryCode;
        }
        
        // If not found, try converting from ISO2 or ISO3
        const iso3 = f.id || f.properties?.id;
        const iso2 = f.properties?.ISO2;
        
        if (iso2) {
          code = iso2ToNumeric(iso2);
          if (code === countryCode) return true;
        }
        
        if (iso3) {
          const iso3Str = typeof iso3 === 'string' ? iso3 : String(iso3);
          const iso2FromIso3 = iso3ToIso2(iso3Str);
          if (iso2FromIso3) {
            code = iso2ToNumeric(iso2FromIso3);
            if (code === countryCode) return true;
          }
        }
        
        return false;
      });

      if (featureIndex === -1) {
        throw new Error('Country not found in GeoJSON');
      }

      // Check if the specific country feature has changed
      const currentFeature = geojson.features[featureIndex];
      const originalFeatureStr = JSON.stringify(originalGeoJson);
      const currentFeatureStr = JSON.stringify(currentFeature);
      
      if (currentFeatureStr !== originalFeatureStr && originalGeoJson) {
        // Country feature has been modified by another user
        const proceed = window.confirm(
          `The borders for ${countryName} have been modified by another user since you opened this overlay.\n\n` +
          'Do you want to overwrite their changes?\n\n' +
          'Click OK to overwrite, or Cancel to keep their changes.'
        );
        
        if (!proceed) {
          setIsSaving(false);
          // Reload the original to show their changes
          setCurrentGeoJson(JSON.parse(JSON.stringify(currentFeature)));
          setOriginalGeoJson(JSON.parse(JSON.stringify(currentFeature)));
          setHasChanges(false);
          return;
        }
      }

      // Update the feature
      geojson.features[featureIndex] = {
        ...geojson.features[featureIndex],
        geometry: currentGeoJson.geometry,
      };

      // Save via API endpoint
      const saveResponse = await fetch('/api/countries/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(etag && { 'If-Match': etag }),
        },
        body: JSON.stringify({
          countryCode,
          geometry: currentGeoJson.geometry,
          fullGeoJson: geojson,
        }),
      });

      if (!saveResponse.ok) {
        if (saveResponse.status === 412) {
          // Precondition failed - file was modified
          const errorData = await saveResponse.json().catch(() => ({ error: 'File was modified by another user' }));
          throw new Error(errorData.error || 'File was modified by another user. Please refresh and try again.');
        } else {
          // Other error
          const errorData = await saveResponse.json().catch(() => ({ error: 'Failed to save borders' }));
          throw new Error(errorData.error || errorData.message || `Failed to save: ${saveResponse.status} ${saveResponse.statusText}`);
        }
      }

      // Successfully saved via API
      await saveResponse.json(); // Read response but don't need to store it
      setOriginalGeoJson(JSON.parse(JSON.stringify(currentGeoJson)));
      setHasChanges(false);
      alert('Country borders saved successfully!');
    } catch (error: any) {
      console.error('[CountryManagement] Failed to save borders:', error);
      const errorMessage = error.message || 'Failed to save borders';
      setSaveError(errorMessage);
      
      // Show alert for network errors or API failures
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        alert(`Failed to connect to backend server.\n\nPlease make sure the backend server is running on port 8080.\n\nError: ${errorMessage}`);
      } else {
        alert(`Failed to save borders: ${errorMessage}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          width: '1200px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>
            Manage {countryName} (Code: {countryCode})
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '0 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Admin Status */}
        <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          {isLoadingAdmin ? (
            <div>Loading admin status...</div>
          ) : (
            <div>
              <div>
                <strong>Your Role:</strong>{' '}
                {isMainAdmin ? 'Main Admin' : isCountryAdmin ? 'Country Admin' : 'No Admin Rights'}
              </div>
              {countryAdmin && (
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Country Admin: {countryAdmin.substring(0, 8)}...{countryAdmin.substring(48)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Policy Settings */}
        <div style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '12px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Policy Settings</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Country Status:</span>
            <button
              className={`country-toggle ${isAllowed ? 'allowed' : 'denied'}`}
              onClick={handleTogglePolicy}
              disabled={!canEdit || isLoadingPolicy}
            >
              {isAllowed ? 'Allowed' : 'Denied'}
            </button>
            {!canEdit && (
              <span style={{ fontSize: '12px', color: '#666' }}>
                (Only admins can change this)
              </span>
            )}
          </div>
        </div>

        {/* Country Vault Settings */}
        {(isMainAdmin || isCountryAdmin) && (
          <div style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '12px', backgroundColor: '#f9f9f9' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Country Vault</h3>
            {!countryIso2 ? (
              <div style={{ fontSize: '12px', color: '#666' }}>
                ISO2 code not available for this country
              </div>
            ) : (
              <>
                {isLoadingVault ? (
                  <div style={{ fontSize: '12px', color: '#666' }}>Loading vault status...</div>
                ) : vaultInfo ? (
                  <div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>Vault Status:</strong>{' '}
                      <span style={{
                        color: vaultInfo.enabled ? '#28a745' : '#dc3545',
                        fontWeight: 'bold'
                      }}>
                        {vaultInfo.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                      <div>ISO Code: <strong>{vaultInfo.code}</strong></div>
                      <div>Registered: {new Date(vaultInfo.created_at * 1000).toLocaleString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="primary-button"
                        onClick={handleToggleVault}
                        disabled={isTogglingVault}
                        style={{
                          fontSize: '12px',
                          padding: '6px 12px',
                          backgroundColor: vaultInfo.enabled ? '#dc3545' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {isTogglingVault ? 'Processing...' : (vaultInfo.enabled ? 'Disable Vault' : 'Enable Vault')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                      Country vault not registered for <strong>{countryIso2}</strong>
                    </div>
                    <button
                      className="primary-button"
                      onClick={handleRegisterVault}
                      disabled={isRegisteringVault}
                      style={{
                        fontSize: '12px',
                        padding: '6px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {isRegisteringVault ? 'Registering...' : 'Register Country Vault'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Map Editor */}
        {canEditBorders && (
          <div style={{ flex: 1, minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Edit Country Borders</h3>
            <div style={{ position: 'relative', flex: 1, minHeight: '400px' }}>
              {(originalGeoJson === undefined || !mapContainer || !countryMap) && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f0f0f0',
                  borderRadius: '4px',
                  zIndex: 1,
                }}>
                  <div>
                    {originalGeoJson === undefined && <div>Loading country data...</div>}
                    {originalGeoJson !== undefined && !mapContainer && <div>Initializing map container...</div>}
                    {originalGeoJson !== undefined && mapContainer && !countryMap && <div>Loading map...</div>}
                  </div>
                </div>
              )}
              <div
                ref={(el) => {
                  if (el) {
                    console.log('[CountryManagement] Map container ref set:', el);
                    setMapContainer(el);
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '400px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid #ddd',
                  backgroundColor: '#f0f0f0',
                }}
              />
              {originalGeoJson === null && countryMap && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  right: '10px',
                  padding: '12px',
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  zIndex: 2,
                  fontSize: '14px',
                }}>
                  <strong>Note:</strong> Country borders not found in GeoJSON file. You can draw new borders using the polygon tool.
                </div>
              )}
            </div>
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="primary-button"
                onClick={handleSaveBorders}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Borders'}
              </button>
              {hasChanges && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  You have unsaved changes
                </span>
              )}
              {saveError && (
                <span style={{ fontSize: '12px', color: '#d32f2f' }}>{saveError}</span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Use the draw tools to edit the country borders. Changes will be saved to countries.geojson.
            </div>
          </div>
        )}

        {!canEditBorders && (
          <div style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
            Only the main admin can edit country borders.
          </div>
        )}
      </div>
    </div>
  );
};
