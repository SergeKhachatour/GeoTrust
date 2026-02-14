import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';
import { Wallet } from './wallet';
import { ContractClient } from './contract';
import { ReadOnlyContractClient } from './contract-readonly';
import { AdminPanel } from './AdminPanel';
import { GamePanel } from './GamePanel';
import { CollapsiblePanel } from './CollapsiblePanel';
import { iso2ToNumeric, iso3ToIso2 } from './countryCodes';
import { Horizon } from '@stellar/stellar-sdk';

// Set Mapbox access token
const mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN;
if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken;
  console.log('[App] Mapbox token loaded');
} else {
  console.error('[App] Mapbox token not found! Please set REACT_APP_MAPBOX_TOKEN in .env.local');
}

// Trustline Comparison Component
const TrustlineComparison: React.FC<{ myPublicKey: string; theirPublicKey: string }> = ({ myPublicKey, theirPublicKey }) => {
  const [loading, setLoading] = useState(true);
  const [myTrustlines, setMyTrustlines] = useState<Array<{ asset: string; balance: string }>>([]);
  const [theirTrustlines, setTheirTrustlines] = useState<Array<{ asset: string; balance: string }>>([]);
  const [commonAssets, setCommonAssets] = useState<Array<{ asset: string; myBalance: string; theirBalance: string }>>([]);
  const [onlyMyAssets, setOnlyMyAssets] = useState<Array<{ asset: string; balance: string }>>([]);
  const [onlyTheirAssets, setOnlyTheirAssets] = useState<Array<{ asset: string; balance: string }>>([]);

  useEffect(() => {
    const fetchTrustlines = async () => {
      setLoading(true);
      try {
        const server = new Horizon.Server('https://horizon-testnet.stellar.org');
        
        // Fetch both accounts' trustlines
        const [myAccount, theirAccount] = await Promise.all([
          server.loadAccount(myPublicKey),
          server.loadAccount(theirPublicKey)
        ]);

        // Extract trustlines (non-native balances)
        const myTls = myAccount.balances
          .filter((b: any) => b.asset_type !== 'native')
          .map((b: any) => ({
            asset: `${b.asset_code}:${b.asset_issuer}`,
            balance: b.balance
          }));
        
        const theirTls = theirAccount.balances
          .filter((b: any) => b.asset_type !== 'native')
          .map((b: any) => ({
            asset: `${b.asset_code}:${b.asset_issuer}`,
            balance: b.balance
          }));

        setMyTrustlines(myTls);
        setTheirTrustlines(theirTls);

        // Find common assets
        const myAssetMap = new Map(myTls.map(tl => [tl.asset, tl.balance]));
        const theirAssetMap = new Map(theirTls.map(tl => [tl.asset, tl.balance]));
        
        const common: Array<{ asset: string; myBalance: string; theirBalance: string }> = [];
        const onlyMine: Array<{ asset: string; balance: string }> = [];
        const onlyTheirs: Array<{ asset: string; balance: string }> = [];

        myTls.forEach(tl => {
          if (theirAssetMap.has(tl.asset)) {
            common.push({
              asset: tl.asset,
              myBalance: tl.balance,
              theirBalance: theirAssetMap.get(tl.asset)!
            });
          } else {
            onlyMine.push(tl);
          }
        });

        theirTls.forEach(tl => {
          if (!myAssetMap.has(tl.asset)) {
            onlyTheirs.push(tl);
          }
        });

        setCommonAssets(common);
        setOnlyMyAssets(onlyMine);
        setOnlyTheirAssets(onlyTheirs);
      } catch (error) {
        console.error('[TrustlineComparison] Failed to fetch trustlines:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrustlines();
  }, [myPublicKey, theirPublicKey]);

  if (loading) {
    return (
      <div className="marker-popup-field" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
        <label>Loading Trustlines...</label>
      </div>
    );
  }

  return (
    <div className="marker-popup-field" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
      <label style={{ fontWeight: 700, marginBottom: '8px' }}>Trustline Comparison</label>
      
      {commonAssets.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
            Common Assets ({commonAssets.length}):
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '11px' }}>
            {commonAssets.map((asset, idx) => (
              <div key={idx} style={{ padding: '4px', backgroundColor: '#f9f9f9', borderRadius: '4px', marginBottom: '4px' }}>
                <div style={{ fontWeight: 600 }}>{asset.asset.split(':')[0]}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666' }}>
                  <span>You: {parseFloat(asset.myBalance).toFixed(2)}</span>
                  <span>Them: {parseFloat(asset.theirBalance).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onlyMyAssets.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
            Only You Have ({onlyMyAssets.length}):
          </div>
          <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '11px' }}>
            {onlyMyAssets.map((asset, idx) => (
              <div key={idx} style={{ padding: '4px', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '2px' }}>
                {asset.asset.split(':')[0]} ({parseFloat(asset.balance).toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      )}

      {onlyTheirAssets.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '4px' }}>
            Only They Have ({onlyTheirAssets.length}):
          </div>
          <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '11px' }}>
            {onlyTheirAssets.map((asset, idx) => (
              <div key={idx} style={{ padding: '4px', backgroundColor: '#d1ecf1', borderRadius: '4px', marginBottom: '2px' }}>
                {asset.asset.split(':')[0]} ({parseFloat(asset.balance).toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      )}

      {commonAssets.length === 0 && onlyMyAssets.length === 0 && onlyTheirAssets.length === 0 && (
        <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
          No trustlines found for comparison
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [contractClient, setContractClient] = useState<ContractClient | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  const [allowedCountries, setAllowedCountries] = useState<Set<number>>(new Set()); // u32 country codes
  const [defaultAllowAll, setDefaultAllowAll] = useState(false);
  const [playerLocation, setPlayerLocation] = useState<[number, number] | null>(null);
  const [sessionLink, setSessionLink] = useState<string>('');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showOtherUsers, setShowOtherUsers] = useState(true);
  const [maxDistance, setMaxDistance] = useState(10000); // km
  const [otherUsers, setOtherUsers] = useState<Array<{ id: string; location: [number, number]; distance: number }>>([]);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const hasCheckedInRef = useRef(false);
  const [readOnlyClient, setReadOnlyClient] = useState<ReadOnlyContractClient | null>(null);
  const [activeSessions, setActiveSessions] = useState<Array<{ 
    sessionId: number; 
    player1: string | null; 
    player2: string | null; 
    state: string;
    p1CellId?: number;
    p2CellId?: number;
    p1Country?: number;
    p2Country?: number;
    createdLedger?: number;
  }>>([]);
  const [accountBalance, setAccountBalance] = useState<string | null>(null);
  const [userCurrentSession, setUserCurrentSession] = useState<number | null>(null);
  const [pendingSessionJoin, setPendingSessionJoin] = useState<number | null>(null);
  const [gamePanelMinimized, setGamePanelMinimized] = useState(false);
  const [yourSessionMinimized, setYourSessionMinimized] = useState(false);
  const [otherSessionsMinimized, setOtherSessionsMinimized] = useState(false);
  const [adminPanelMinimized, setAdminPanelMinimized] = useState(false);

  // Define updateCountryOverlay first (used by loadCountryOverlay)
  const updateCountryOverlay = useCallback(() => {
    if (!map.current || !map.current.getSource('countries')) {
      console.log('[App] updateCountryOverlay: Map or countries source not ready');
      return;
    }

    const source = map.current.getSource('countries') as mapboxgl.GeoJSONSource;
    const data = source._data as GeoJSON.FeatureCollection;

    if (!data || !data.features) {
      console.log('[App] updateCountryOverlay: No data or features');
      return;
    }

    console.log('[App] updateCountryOverlay: Updating', data.features.length, 'features', {
      allowedCount: allowedCountries.size,
      defaultAllowAll
    });

    let updatedCount = 0;
    data.features.forEach((feature) => {
      // Ensure properties object exists
      if (!feature.properties) {
        feature.properties = {};
      }
      
      // Try ISO_NUMERIC first, then convert from ISO2/ISO3
      let countryCode = feature.properties.ISO_NUMERIC;
      if (!countryCode) {
        // Check feature-level id (ISO3) and properties
        const iso3 = feature.id;
        const iso2 = feature.properties?.ISO2;
        
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
        
        // Store it for future use
        if (countryCode) {
          feature.properties.ISO_NUMERIC = countryCode;
        }
      }
      
      let allowed: boolean;
      
      if (countryCode) {
        // Convert to number if it's a string
        const code = typeof countryCode === 'string' ? parseInt(countryCode, 10) : countryCode;
        
        // Logic: 
        // - If defaultAllowAll is true: country is allowed UNLESS it's in the denied list (allowedCountries acts as denylist)
        // - If defaultAllowAll is false: country is allowed ONLY if it's in the allowed list
        if (defaultAllowAll) {
          // Default allow all: allowedCountries is actually a denylist
          allowed = !allowedCountries.has(code);
        } else {
          // Default deny all: allowedCountries is an allowlist
          allowed = allowedCountries.has(code);
        }
      } else {
        // Set default for features without country code
        allowed = defaultAllowAll;
      }
      
      // Always set allowed as a boolean
      const wasAllowed = feature.properties.allowed;
      feature.properties.allowed = Boolean(allowed);
      
      // Count updates for debugging
      if (wasAllowed !== feature.properties.allowed) {
        updatedCount++;
      }
    });

    console.log('[App] updateCountryOverlay: Updated', updatedCount, 'features');
    
    // Update the source with modified data
    source.setData(data);
  }, [defaultAllowAll, allowedCountries]);

  // Define loadCountryOverlay (uses updateCountryOverlay)
  const loadCountryOverlay = useCallback(async () => {
    // Load countries GeoJSON
    // For MVP, we'll use a simplified approach
    // In production, load from a bundled GeoJSON file
    if (!map.current) {
      console.warn('[App] Map not available for country overlay');
      return;
    }

    try {
      // Try to load countries GeoJSON - if it doesn't exist, skip overlay
      let geojson;
      try {
        const response = await fetch('/countries.geojson');
        if (response.ok) {
          geojson = await response.json();
        } else {
          console.warn('[App] countries.geojson not found, skipping country overlay');
          return;
        }
      } catch (error) {
        console.warn('[App] Failed to load countries.geojson, skipping overlay:', error);
        return;
      }

      // Initialize allowed property for all features
      if (geojson.features) {
        geojson.features.forEach((feature: any) => {
          if (!feature.properties) {
            feature.properties = {};
          }
          // Set default allowed value (will be updated by updateCountryOverlay)
          // Try ISO_NUMERIC first, then convert from ISO2/ISO3
          let countryCode = feature.properties.ISO_NUMERIC;
          if (!countryCode) {
            // Check feature-level id (ISO3) and properties
            const iso3 = feature.id;
            const iso2 = feature.properties?.ISO2;
            
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
            
            // Store it for future use
            if (countryCode) {
              feature.properties.ISO_NUMERIC = countryCode;
            }
          }
          
          let allowed: boolean;
          
          if (countryCode) {
            const code = typeof countryCode === 'string' ? parseInt(countryCode, 10) : countryCode;
            if (defaultAllowAll) {
              allowed = !allowedCountries.has(code);
            } else {
              allowed = allowedCountries.has(code);
            }
          } else {
            allowed = defaultAllowAll;
          }
          
          feature.properties.allowed = Boolean(allowed);
        });
      }

      if (map.current.getSource('countries')) {
        (map.current.getSource('countries') as mapboxgl.GeoJSONSource).setData(geojson);
      } else {
        map.current.addSource('countries', {
          type: 'geojson',
          data: geojson,
        });

        // Add fill layer with very light opacity (mostly transparent)
        map.current.addLayer({
          id: 'countries-fill',
          type: 'fill',
          source: 'countries',
          paint: {
            'fill-color': [
              'case',
              ['==', ['typeof', ['get', 'allowed']], 'boolean'],
              [
                'case',
                ['get', 'allowed'],
                'rgba(0, 255, 0, 0.1)', // Very light green for allowed
                'rgba(255, 0, 0, 0.05)', // Very light red for denied
              ],
              'rgba(128, 128, 128, 0.05)', // Default gray for null/undefined
            ],
            'fill-opacity': 0.3,
          },
        });

        // Add outline layer with colored borders based on allowed status
        map.current.addLayer({
          id: 'countries-outline',
          type: 'line',
          source: 'countries',
          paint: {
            'line-color': [
              'case',
              ['==', ['typeof', ['get', 'allowed']], 'boolean'],
              [
                'case',
                ['get', 'allowed'],
                '#00FF00', // Green border for allowed
                '#FF0000', // Red border for denied
              ],
              '#888888', // Gray border for unknown
            ],
            'line-width': [
              'case',
              ['==', ['typeof', ['get', 'allowed']], 'boolean'],
              [
                'case',
                ['get', 'allowed'],
                3, // Thicker green border for allowed
                2, // Thinner red border for denied
              ],
              1, // Thin gray border for unknown
            ],
            'line-opacity': 0.8,
          },
        });
      }
      
      // Update overlay after loading to ensure all properties are set
      updateCountryOverlay();
    } catch (error) {
      console.error('Failed to load countries GeoJSON:', error);
    }
  }, [defaultAllowAll, allowedCountries, updateCountryOverlay]);

  // Define initializeMap before the useEffect that uses it
  const initializeMap = useCallback((container: HTMLDivElement) => {
    console.log('[App] initializeMap called with container:', container);

    // Check if Mapbox token is available
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (!token) {
      console.error('[App] Mapbox token not found! Check .env.local file');
      return;
    }
    
    console.log('[App] Mapbox token found, proceeding with map initialization');

    // Ensure map container is visible and properly sized
    // Double-check container exists and has style before accessing
    if (!container || !container.style) {
      console.warn('[App] Container or style not available when setting styles');
      return;
    }
    
    container.style.display = 'block';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    console.log('[App] Map container ready:', {
      width: container.offsetWidth,
      height: container.offsetHeight,
      display: window.getComputedStyle(container).display
    });

    try {
      if (!container) {
        console.error('[App] Cannot create map: container is null');
        return;
      }
      
      map.current = new mapboxgl.Map({
        container: container,
        style: 'mapbox://styles/mapbox/light-v11',
        projection: 'globe',
        center: [0, 0],
        zoom: 2,
      });

      const handleMapLoad = () => {
        console.log('[App] Map loaded successfully');
        if (map.current) {
          loadCountryOverlay().then(() => {
            // After overlay is loaded, update it with current country policy
            // This ensures countries show correctly even if policy was loaded before map
            console.log('[App] Country overlay loaded, updating with policy');
            setTimeout(() => {
              updateCountryOverlay();
            }, 200);
          });
          // Admin check will happen automatically via useEffect when wallet and client are ready
        }
      };
      map.current.on('load', handleMapLoad);

      map.current.on('error', (e) => {
        console.error('[App] Map error:', e);
      });

      map.current.on('style.load', () => {
        console.log('[App] Map style loaded');
      });
    } catch (error) {
      console.error('[App] Failed to initialize map:', error);
    }
  }, [loadCountryOverlay, updateCountryOverlay]); // Include loadCountryOverlay and updateCountryOverlay as dependencies

  useEffect(() => {
    // Only initialize map once - if map already exists, don't re-initialize
    if (map.current) {
      console.log('[App] Map already exists, skipping initialization');
      return;
    }
    
    console.log('[App] Map initialization useEffect running');
    
    // Wait for the ref to be attached to the DOM
    // Use a small delay to ensure the ref is attached
    const timer = setTimeout(() => {
      console.log('[App] Map initialization timer fired');
      console.log('[App] mapContainer.current:', mapContainer.current);
      console.log('[App] map.current:', map.current);
      
      // Double-check map doesn't exist (might have been created in the meantime)
      if (map.current) {
        console.log('[App] Map already exists, skipping initialization');
        return;
      }
      
      if (!mapContainer.current) {
        console.warn('[App] mapContainer.current is null');
        return;
      }
      
      // Get the container and verify it has a style property
      const container = mapContainer.current;
      if (!container) {
        console.warn('[App] Container is null');
        return;
      }
      
      // Check if container is actually a DOM element with style property
      if (!container.style || typeof container.style === 'undefined') {
        console.warn('[App] Container style property is undefined or not available');
        return;
      }
      
      console.log('[App] Calling initializeMap');
      initializeMap(container);
    }, 100); // Increased delay to 100ms to ensure DOM is ready
    
    return () => {
      clearTimeout(timer);
      // Don't cleanup map here - let it persist across re-renders
      // Only cleanup on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount (initializeMap changes when country policy changes, but we don't want to re-initialize the map)

  // Update country overlay when country policy or map changes
  useEffect(() => {
    const updateOverlayIfReady = () => {
      if (map.current && map.current.loaded()) {
        // Check if countries source exists
        const source = map.current.getSource('countries');
        if (source) {
          // Map is ready and countries source exists, update overlay
          console.log('[App] Updating country overlay with current policy', { 
            allowedCount: allowedCountries.size, 
            defaultAllowAll 
          });
          updateCountryOverlay();
          return true;
        }
      }
      return false;
    };
    
    // Try to update immediately
    if (!updateOverlayIfReady()) {
      // Countries source doesn't exist yet, wait a bit and try again
      console.log('[App] Countries source not ready yet, will retry');
      // Retry after a delay
      const retryTimer = setTimeout(() => {
        updateOverlayIfReady();
      }, 500);
      return () => clearTimeout(retryTimer);
    }
  }, [allowedCountries, defaultAllowAll, updateCountryOverlay]);

  // Show markers from active sessions to entice users
  const updateSessionMarkers = useCallback((sessions: Array<{ 
    sessionId: number; 
    player1: string | null; 
    player2: string | null; 
    state: string;
    p1CellId?: number;
    p2CellId?: number;
    p1Country?: number;
    p2Country?: number;
  }>) => {
    if (!map.current) return;
    
    // Remove existing session markers
    document.querySelectorAll('.session-user-marker').forEach(m => m.remove());
    
    console.log('[App] updateSessionMarkers: Processing', sessions.length, 'sessions');
    
    // Add markers for players in active sessions
    // For demo purposes, we'll place markers at approximate locations based on cell_id
    // In production, you'd store actual lat/lon or fetch from a location service
    sessions.forEach(session => {
      if (session.player1 && session.p1CellId) {
        // Convert cell_id to approximate lat/lon (simplified - in production use actual location)
        const lat = (session.p1CellId % 360) * 0.5 - 90;
        const lng = Math.floor(session.p1CellId / 360) * 0.5 - 180;
        
        const el = document.createElement('div');
        el.className = 'marker marker-opponent session-user-marker';
        const publicKeyShort = `${session.player1.slice(0, 4)}...${session.player1.slice(-4)}`;
        el.innerHTML = `<div class="marker-label">👤<div class="marker-public-key">${publicKeyShort}</div></div>`;
        el.style.cursor = 'pointer';
        el.title = `${session.player1} - Session #${session.sessionId}`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedMarker({
            type: 'opponent',
            location: [lng, lat],
            publicKey: session.player1!,
            sessionId: session.sessionId,
            cellId: session.p1CellId,
            country: session.p1Country,
          });
        });
        
        try {
          new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          console.log('[App] Added session marker for Player 1:', {
            sessionId: session.sessionId,
            publicKey: session.player1,
            publicKeyShort,
            location: [lng, lat]
          });
        } catch (error) {
          console.error('[App] Failed to add session marker:', error);
        }
      }
      
      if (session.player2 && session.p2CellId) {
        const lat = (session.p2CellId % 360) * 0.5 - 90;
        const lng = Math.floor(session.p2CellId / 360) * 0.5 - 180;
        
        const el = document.createElement('div');
        el.className = 'marker marker-opponent session-user-marker';
        const publicKeyShort = `${session.player2.slice(0, 4)}...${session.player2.slice(-4)}`;
        el.innerHTML = `<div class="marker-label">👤<div class="marker-public-key">${publicKeyShort}</div></div>`;
        el.style.cursor = 'pointer';
        el.title = `${session.player2} - Session #${session.sessionId}`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedMarker({
            type: 'opponent',
            location: [lng, lat],
            publicKey: session.player2!,
            sessionId: session.sessionId,
            cellId: session.p2CellId,
            country: session.p2Country,
          });
        });
        
        try {
          new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          console.log('[App] Added session marker for Player 2:', {
            sessionId: session.sessionId,
            publicKey: session.player2,
            publicKeyShort,
            location: [lng, lat]
          });
        } catch (error) {
          console.error('[App] Failed to add session marker:', error);
        }
      }
    });
  }, []);
  
  // Fetch active sessions (poll recent session IDs)
  const fetchActiveSessions = useCallback(async () => {
    if (!readOnlyClient) return;

    try {
      const sessions: Array<{ 
        sessionId: number; 
        player1: string | null; 
        player2: string | null; 
        state: string;
        p1CellId?: number;
        p2CellId?: number;
        p1Country?: number;
        p2Country?: number;
        createdLedger?: number;
      }> = [];
      
      // Poll sessions 1-200 to find active ones
      // In production, you'd want a better way to track sessions
      for (let sessionId = 1; sessionId <= 200; sessionId++) {
        try {
          const session = await readOnlyClient.getSession(sessionId);
          if (session && (session.state === 'Waiting' || session.state === 'Active')) {
            sessions.push({
              sessionId,
              player1: session.player1 || null,
              player2: session.player2 || null,
              state: session.state || 'Unknown',
              p1CellId: session.p1CellId || session.p1_cell_id,
              p2CellId: session.p2CellId || session.p2_cell_id,
              p1Country: session.p1Country || session.p1_country,
              p2Country: session.p2Country || session.p2_country,
              createdLedger: session.createdLedger || session.created_ledger,
            });
          }
        } catch (error) {
          // Session doesn't exist or error - skip it
          continue;
        }
      }
      
      setActiveSessions(sessions);
      console.log('[App] Active sessions:', sessions);
      
      // Update markers on map from active sessions (even without wallet)
      if (map.current && map.current.loaded()) {
        updateSessionMarkers(sessions);
      }
    } catch (error) {
      console.error('[App] Failed to fetch active sessions:', error);
    }
  }, [readOnlyClient, updateSessionMarkers]);

  // Initialize read-only client on mount (for fetching public data without wallet)
  useEffect(() => {
    const client = new ReadOnlyContractClient();
    setReadOnlyClient(client);
    
    // Fetch country policy immediately (doesn't require wallet)
    const loadData = async () => {
      try {
        const [defaultAllowAll, allowedCount, deniedCount] = await client.getCountryPolicy();
        setDefaultAllowAll(defaultAllowAll);
        
        // Fetch allowed countries list
        const allowedList = await client.listAllowedCountries(0, 1000);
        setAllowedCountries(new Set(allowedList));
        
        console.log('[App] Country policy loaded:', { defaultAllowAll, allowedCount, deniedCount, allowedList });
        
        // The overlay will be updated automatically by the useEffect that watches allowedCountries/defaultAllowAll
        // No need to manually call updateCountryOverlay here - it will be triggered by state changes
        
        // Fetch active sessions (will be called after readOnlyClient is set)
      } catch (error) {
        console.error('[App] Failed to load data:', error);
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount. updateCountryOverlay will be called by the useEffect that watches state changes

  // Fetch active sessions when readOnlyClient is ready
  useEffect(() => {
    if (readOnlyClient) {
      fetchActiveSessions();
      
      // Poll for active sessions every 5 seconds for better real-time updates
      const sessionInterval = setInterval(() => {
        fetchActiveSessions();
      }, 5000);
      
      return () => clearInterval(sessionInterval);
    }
  }, [readOnlyClient, fetchActiveSessions]);
  
  // Fetch account balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!wallet || !walletAddress) {
        setAccountBalance(null);
        return;
      }

      try {
        const server = new Horizon.Server('https://horizon-testnet.stellar.org');
        const account = await server.loadAccount(walletAddress);
        const xlmBalance = account.balances.find((b: any) => b.asset_type === 'native');
        if (xlmBalance) {
          const balance = parseFloat(xlmBalance.balance).toFixed(2);
          setAccountBalance(balance);
        } else {
          setAccountBalance('0.00');
        }
      } catch (error) {
        console.error('[App] Failed to fetch balance:', error);
        setAccountBalance(null);
      }
    };

    if (wallet && walletAddress) {
      fetchBalance();
      // Refresh balance every 30 seconds
      const balanceInterval = setInterval(fetchBalance, 30000);
      return () => clearInterval(balanceInterval);
    }
  }, [wallet, walletAddress]);

  // Check user's current session when wallet is connected
  useEffect(() => {
    const checkUserSession = async () => {
      if (!wallet || !contractClient) {
        setUserCurrentSession(null);
        return;
      }
      
      try {
        const publicKey = await wallet.getPublicKey(true);
        // Check if user is in any active session
        for (const session of activeSessions) {
          if ((session.player1 === publicKey || session.player2 === publicKey) && 
              (session.state === 'Waiting' || session.state === 'Active')) {
            setUserCurrentSession(session.sessionId);
            // Set session link if found
            if (session.sessionId) {
              setSessionLink(`${window.location.origin}?session=${session.sessionId}`);
            }
            console.log('[App] User is already in session:', session.sessionId);
            return;
          }
        }
        setUserCurrentSession(null);
      } catch (error) {
        console.error('[App] Failed to check user session:', error);
        setUserCurrentSession(null);
      }
    };
    
    if (wallet && activeSessions.length >= 0) { // Check even if no active sessions (to clear state)
      checkUserSession();
    } else if (!wallet) {
      setUserCurrentSession(null);
    }
  }, [wallet, contractClient, activeSessions]);

  // Restore wallet connection on page load and handle session URL parameter
  useEffect(() => {
    const restoreWallet = async () => {
      if (Wallet.wasConnected() && !wallet) {
        try {
          const w = new Wallet();
          // Try to get public key - this will reconnect if needed
          // First try silently, if that fails, the wallet will need to reconnect
          try {
            const address = await w.getPublicKey(true); // Try silently first
            setWallet(w);
            setWalletAddress(address);
            const client = new ContractClient(w);
            setContractClient(client);
            console.log('[App] Wallet restored successfully:', address);
          } catch (error: any) {
            // If silent restore fails, user will need to reconnect manually
            console.log('[App] Silent wallet restore failed, user will need to reconnect:', error);
            // Clear invalid connection state
            if (typeof window !== 'undefined') {
              localStorage.removeItem('geotrust_wallet_connected');
              localStorage.removeItem('geotrust_wallet_address');
            }
          }
          setWallet(w);
          setWalletAddress(address);
          const client = new ContractClient(w);
          setContractClient(client);
          console.log('[App] Wallet restored successfully:', address);
          // Admin check will happen automatically via useEffect when wallet and client are set
        } catch (error: any) {
          console.log('Failed to restore wallet connection:', error);
          // Clear invalid connection state - restoration failed, so connection is invalid
          if (typeof window !== 'undefined') {
            localStorage.removeItem('geotrust_wallet_connected');
            localStorage.removeItem('geotrust_wallet_address');
          }
        }
      }
    };
    
    // Check for session ID in URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get('session');
    if (sessionIdParam) {
      const sessionId = parseInt(sessionIdParam, 10);
      if (!isNaN(sessionId) && sessionId > 0) {
        console.log('[App] Session ID found in URL:', sessionId);
        // Store session ID to join after wallet is connected
        setPendingSessionJoin(sessionId);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    
    restoreWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check admin status when wallet and contract client are ready
  useEffect(() => {
    if (wallet && contractClient) {
      console.log('[App] Wallet and contractClient ready, checking admin status...');
      checkAdminStatus();
      fetchCountryPolicy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, contractClient]);

  // Auto-checkin when wallet and contract client are ready
  const hasCheckedIn = useRef(false);
  useEffect(() => {
    if (wallet && contractClient && !playerLocation && !isCheckingIn && !hasCheckedIn.current) {
      hasCheckedIn.current = true;
      autoCheckIn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, contractClient]);

  // Handle pending session join from URL parameter
  useEffect(() => {
    if (pendingSessionJoin && wallet && contractClient && !isCheckingIn) {
      const joinPendingSession = async () => {
        try {
          console.log('[App] Auto-joining session from URL:', pendingSessionJoin);
          await handleJoinSession(pendingSessionJoin);
          setPendingSessionJoin(null);
        } catch (error: any) {
          console.error('[App] Failed to auto-join session:', error);
          alert(`Failed to join session ${pendingSessionJoin}: ${error.message || error}`);
          setPendingSessionJoin(null);
        }
      };
      joinPendingSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSessionJoin, wallet, contractClient]);


  const connectWallet = async () => {
    try {
      setWalletError(null);
      setIsCheckingIn(false);
      hasCheckedInRef.current = false; // Reset check-in flag
      const w = new Wallet();
      await w.connect();
      const address = await w.getPublicKey();
      setWallet(w);
      setWalletAddress(address);
      const client = new ContractClient(w);
      setContractClient(client);
      // Explicitly call checkAdminStatus after connection
      // Small delay to ensure client is fully initialized
      setTimeout(() => {
        checkAdminStatus();
        fetchCountryPolicy();
      }, 500);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      setWalletError(error.message || 'Failed to connect wallet. Please try again or select a different wallet.');
    }
  };

  const disconnectWallet = async () => {
    try {
      if (wallet) {
        await wallet.disconnect();
      }
      setWallet(null);
      setWalletAddress(null);
      setContractClient(null);
      setIsAdmin(false);
      setPlayerLocation(null);
      setSessionLink('');
      setWalletError(null);
      hasCheckedInRef.current = false;
      // Ensure overlay is expanded on mobile after disconnect
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        setOverlayMinimized(false);
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const autoCheckIn = async () => {
    if (!navigator.geolocation || !contractClient) return;
    
    // Check if user is already in a session - if so, don't create a new one
    if (userCurrentSession !== null) {
      console.log('[App] User is already in session:', userCurrentSession, '- skipping auto-checkin');
      return;
    }
    
    setIsCheckingIn(true);
    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // Double-check session state before creating
          if (userCurrentSession !== null) {
            console.log('[App] User joined a session while getting location - skipping session creation');
            setIsCheckingIn(false);
            return;
          }

          const { latitude, longitude } = position.coords;
          setPlayerLocation([longitude, latitude]);

          // Add player marker - ensure map container is ready
          if (map.current) {
            const addPlayerMarker = () => {
              if (!map.current) return;
              
              // Check if map container exists and is in DOM
              const container = map.current.getContainer();
              if (!container || !container.parentElement) {
                console.warn('Map container not ready, retrying...');
                setTimeout(addPlayerMarker, 100);
                return;
              }

              if (!map.current.loaded()) {
                map.current.once('load', addPlayerMarker);
                return;
              }

              const existingMarker = document.getElementById('player-marker');
              if (existingMarker) existingMarker.remove();

              try {
                const marker = new mapboxgl.Marker({ 
                  element: createMarkerElement('player', () => {
                    setSelectedMarker({
                      type: 'player',
                      location: [longitude, latitude],
                      publicKey: walletAddress || undefined
                    });
                  })
                })
                  .setLngLat([longitude, latitude])
                  .addTo(map.current);
                marker.getElement().id = 'player-marker';
              } catch (error) {
                console.error('Failed to add player marker:', error);
              }
            };

            addPlayerMarker();
          }

          // Get country code and create session
          const countryCode = await getCountryCode(longitude, latitude);
          if (countryCode && contractClient) {
            try {
              // Final check before creating session
              if (userCurrentSession !== null) {
                console.log('[App] User joined a session while processing - skipping session creation');
                setIsCheckingIn(false);
                return;
              }

              const cellId = calculateCellId(latitude, longitude);
              const assetTag = await getAssetTag();
              console.log('[App] Creating session with:', { cellId, countryCode });
              
              const sessionId = await contractClient.createSession();
              console.log('[App] Session created, ID:', sessionId);
              
              // Additional delay to ensure session is fully persisted and account sequence is refreshed
              // Wait for transaction to be included and then wait a bit more for ledger state to settle
              await new Promise(resolve => setTimeout(resolve, 5000));
              
              console.log('[App] Joining session:', { sessionId, cellId, countryCode });

              // For MVP, temporarily skip proof to test basic flow
              // TODO: Re-enable proof once struct deserialization is fixed
              // const { generateLocationProof } = await import('./zk-proof');
              // const locationProof = await generateLocationProof(latitude, longitude);
              
              await contractClient.joinSession(
                sessionId, 
                cellId, 
                assetTag, 
                countryCode
                // Temporarily disabled proof
                // {
                //   proof: locationProof.proof,
                //   publicInputs: [locationProof.publicInputs.cellId, locationProof.publicInputs.gridSize]
                // }
              );
              setSessionLink(`${window.location.origin}?session=${sessionId}`);
              
              // Refresh active sessions to update UI
              await fetchActiveSessions();
              
              // Fetch other users after checkin
              fetchOtherUsers([longitude, latitude]);
            } catch (error: any) {
              if (error.message?.includes('rejected') || error.message?.includes('denied')) {
                // User rejected transaction - this is expected, don't show error
                console.log('Transaction rejected by user');
              } else if (!error.message?.includes('Country not allowed')) {
                console.error('Auto-checkin failed:', error);
              }
            }
          }
          setIsCheckingIn(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsCheckingIn(false);
        }
      );
    } catch (error) {
      setIsCheckingIn(false);
    }
  };

  const fetchOtherUsers = async (playerLoc: [number, number]) => {
    // Mock data for now - in production, fetch from contract
    // For MVP, we'll simulate other users
    const mockUsers = [
      { id: 'user1', location: [playerLoc[0] + 0.5, playerLoc[1] + 0.3] as [number, number] },
      { id: 'user2', location: [playerLoc[0] - 0.8, playerLoc[1] + 0.2] as [number, number] },
      { id: 'user3', location: [playerLoc[0] + 1.2, playerLoc[1] - 0.5] as [number, number] },
    ];

    const usersWithDistance = mockUsers.map(user => ({
      ...user,
      distance: calculateDistance(playerLoc, user.location),
    })).filter(user => user.distance <= maxDistance);

    setOtherUsers(usersWithDistance);
    updateOtherUserMarkers(usersWithDistance);
  };

  const calculateDistance = (loc1: [number, number], loc2: [number, number]): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (loc2[1] - loc1[1]) * Math.PI / 180;
    const dLon = (loc2[0] - loc1[0]) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(loc1[1] * Math.PI / 180) * Math.cos(loc2[1] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const updateOtherUserMarkers = (users: Array<{ id: string; location: [number, number]; distance: number }>) => {
    if (!map.current) return;

    // Remove existing markers
    document.querySelectorAll('.other-user-marker').forEach(m => m.remove());

    if (!showOtherUsers) return;

    // Ensure map is loaded and container is ready before adding markers
    const addMarkers = () => {
      if (!map.current) return;
      
      // Check if map container exists and is in DOM
      const container = map.current.getContainer();
      if (!container || !container.parentElement) {
        console.warn('Map container not ready, retrying...');
        setTimeout(addMarkers, 100);
        return;
      }

      if (!map.current.loaded()) {
        map.current.once('load', addMarkers);
        return;
      }

      users.forEach(user => {
        const el = document.createElement('div');
        el.className = 'marker marker-opponent other-user-marker';
        el.innerHTML = `<div class="marker-distance">${user.distance.toFixed(1)} km</div>`;
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedMarker({
            type: 'opponent',
            location: user.location,
            userId: user.id,
            distance: user.distance
          });
        });
        
        try {
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(user.location)
            .addTo(map.current!);
          
          marker.getElement().setAttribute('data-user-id', user.id);
          console.log('[App] Added other-user marker (NO PUBLIC KEY):', {
            userId: user.id,
            location: user.location,
            distance: user.distance,
            note: 'This marker has no public key - it is from the distance-based "other users"" feature'
          });
        } catch (error) {
          console.error('[App] Failed to add other-user marker:', error);
        }
      });
    };

    addMarkers();
  };

  useEffect(() => {
    if (playerLocation && showOtherUsers) {
      fetchOtherUsers(playerLocation);
    } else if (!showOtherUsers) {
      document.querySelectorAll('.other-user-marker').forEach(m => m.remove());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOtherUsers, maxDistance]);

  const checkAdminStatus = async () => {
    if (!contractClient || !wallet) {
      console.log('[App] checkAdminStatus skipped - no contractClient or wallet');
      return;
    }

    try {
      console.log('[App] Checking admin status...');
      const admin = await contractClient.getAdmin();
      const publicKey = await wallet.getPublicKey();
      console.log('[App] Admin from contract:', admin, typeof admin);
      console.log('[App] Current wallet public key:', publicKey);
      
      // Normalize admin to string for comparison
      const adminStr = admin ? String(admin) : null;
      
      // If contract is not initialized (admin is null), prompt to initialize
      if (adminStr === null) {
        console.warn('[App] Contract not initialized. Please initialize the contract first.');
        const shouldInit = window.confirm(
          'Contract is not initialized. Would you like to initialize it now?\n\n' +
          'This will set you as the admin and configure the default country policy.'
        );
        if (shouldInit) {
          try {
            await contractClient.init(publicKey, false); // default_allow_all = false
            console.log('[App] Γ£à Contract initialized successfully');
            // Retry admin check after initialization (wait longer for transaction to settle)
            setTimeout(() => {
              console.log('[App] Re-checking admin status after initialization...');
              checkAdminStatus();
            }, 3000);
          } catch (error: any) {
            console.error('[App] Failed to initialize contract:', error);
            alert(`Failed to initialize contract: ${error.message || error}`);
          }
        }
        return;
      }
      
      if (adminStr === publicKey) {
        setIsAdmin(true);
        console.log('[App] Γ£à Admin status confirmed, setting up contracts...');
        
        // Automatically set verifier contract ID if available in env
        const verifierId = process.env.REACT_APP_VERIFIER_ID;
        console.log('[App] REACT_APP_VERIFIER_ID from env:', verifierId);
        let verifierRejected = false;
        if (verifierId) {
          try {
            console.log('[App] Setting verifier contract:', verifierId);
            await contractClient.setVerifier(verifierId);
            console.log('[App] Verifier contract ID set successfully:', verifierId);
            // Wait a bit to ensure transaction is processed before next call
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error: any) {
            console.error('[App] Failed to set verifier:', error);
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            // Don't show alert for user rejections or sequence errors
            if (errorMsg.includes('rejected by user') || errorMsg.includes('Transaction was rejected')) {
              console.warn('[App] Verifier setup was cancelled by user - skipping Game Hub to avoid sequence issues');
              verifierRejected = true; // Mark as rejected to skip Game Hub
            } else if (errorMsg.includes('txBadSeq') || errorMsg.includes('already') || errorMsg.includes('set')) {
              console.warn('[App] Verifier may already be set or sequence issue - will retry later');
            } else {
              console.warn('[App] Failed to set verifier (non-critical):', errorMsg);
            }
          }
        } else {
          console.warn('[App] REACT_APP_VERIFIER_ID not set in environment');
        }
        
        // Only set Game Hub if verifier wasn't rejected (to avoid sequence number issues)
        if (!verifierRejected) {
          // Add delay to ensure sequence number is fresh after previous transaction
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Automatically set Game Hub contract ID if available in env
          const gameHubId = process.env.REACT_APP_GAME_HUB_ID;
          console.log('[App] REACT_APP_GAME_HUB_ID from env:', gameHubId);
          
          // First check if Game Hub is already set
          try {
            const currentGameHub = await contractClient.getGameHub();
            if (currentGameHub) {
              console.log('[App] ✅ Game Hub already set in contract:', currentGameHub);
              if (gameHubId && currentGameHub !== gameHubId) {
                console.warn('[App] ⚠️ Game Hub mismatch! Contract has:', currentGameHub, 'but env has:', gameHubId);
              }
            } else {
              console.log('[App] Game Hub not set in contract, will set it now');
            }
          } catch (error) {
            console.warn('[App] Could not check Game Hub status (get_game_hub may not be implemented yet):', error);
          }
          
          if (gameHubId) {
            try {
              console.log('[App] Setting Game Hub contract:', gameHubId);
              await contractClient.setGameHub(gameHubId);
              console.log('[App] ✅ Game Hub contract ID set successfully:', gameHubId);
              
              // Verify it was set
              try {
                const verifyGameHub = await contractClient.getGameHub();
                if (verifyGameHub === gameHubId) {
                  console.log('[App] ✅ Verified Game Hub is set correctly in contract');
                  console.log('[App] ✅ start_game and end_game will be called when sessions become Active and are resolved');
                } else {
                  console.warn('[App] ⚠️ Game Hub verification failed. Expected:', gameHubId, 'Got:', verifyGameHub);
                  console.warn('[App] ⚠️ This means start_game and end_game will NOT be called!');
                  console.warn('[App] ⚠️ Please manually set Game Hub using: set_game_hub');
                }
              } catch (verifyError) {
                console.warn('[App] Could not verify Game Hub (get_game_hub may not be available):', verifyError);
              }
            } catch (error: any) {
              console.error('[App] Failed to set Game Hub:', error);
              const errorMsg = error?.message || error?.toString() || 'Unknown error';
              // Don't show alert for user rejections or sequence errors
              if (errorMsg.includes('rejected by user') || errorMsg.includes('Transaction was rejected')) {
                console.warn('[App] Game Hub setup was cancelled by user');
              } else if (errorMsg.includes('txBadSeq')) {
                console.warn('[App] Sequence number issue - Game Hub will need to be set manually later');
              } else if (errorMsg.includes('already') || errorMsg.includes('set')) {
                console.warn('[App] Game Hub may already be set');
              } else {
                console.warn('[App] Failed to set Game Hub (non-critical):', errorMsg);
              }
            }
          } else {
            console.warn('[App] ⚠️ REACT_APP_GAME_HUB_ID not set in environment');
            console.warn('[App] ⚠️ Game Hub calls (start_game/end_game) will NOT work!');
          }
        } else {
          console.warn('[App] Skipping Game Hub setup because verifier transaction was rejected');
        }
      } else {
        setIsAdmin(false);
        console.log('[App] Γ¥î User is not admin. Admin:', admin, 'User:', publicKey);
      }
    } catch (error) {
      console.error('Failed to check admin status:', error);
    }
  };

  const fetchCountryPolicy = async () => {
    // Use read-only client if available, otherwise use contractClient
    const client = readOnlyClient || contractClient;
    if (!client) return;

    try {
      const [defaultAllow, allowedCount] = await (client as any).getCountryPolicy();
      setDefaultAllowAll(defaultAllow);

      // Fetch allowed countries with pagination
      const pageSize = 100;
      const pages = Math.ceil(allowedCount / pageSize);
      const allAllowed = new Set<number>();

      for (let page = 0; page < pages; page++) {
        const countries = await (client as any).listAllowedCountries(page, pageSize);
        countries.forEach((code: number) => allAllowed.add(code));
      }

      setAllowedCountries(allAllowed);
    } catch (error) {
      console.error('Failed to fetch country policy:', error);
    }
  };

  // Handle joining a session
  const handleJoinSession = async (sessionId: number) => {
    if (!wallet || !contractClient) {
      alert('Please connect your wallet first to join a session');
      await connectWallet();
      return;
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    try {
      setIsCheckingIn(true);
      
      // Get user's location
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setPlayerLocation([longitude, latitude]);

          // Get country code
          const countryCode = await getCountryCode(longitude, latitude);
          if (!countryCode) {
            alert('Failed to determine country');
            setIsCheckingIn(false);
            return;
          }

          try {
            const cellId = calculateCellId(latitude, longitude);
            const assetTag = await getAssetTag();
            
            // Join the session
            await contractClient.joinSession(
              sessionId,
              cellId,
              assetTag,
              countryCode,
              undefined // No proof for now
            );

            setSessionLink(`${window.location.origin}?session=${sessionId}`);
            alert(`Successfully joined session ${sessionId}!`);
            
            // Refresh active sessions
            await fetchActiveSessions();
            console.log('[App] ✅ Session joined successfully');
            console.log('[App] If this was the second player, start_game should have been called on Game Hub');
            console.log('[App] Check Stellar Expert Game Hub contract to verify start_game transaction');
          } catch (error: any) {
            console.error('Failed to join session:', error);
            alert(`Failed to join session: ${error.message || error}`);
          } finally {
            setIsCheckingIn(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Failed to get your location. Please allow location access.');
          setIsCheckingIn(false);
        }
      );
    } catch (error: any) {
      console.error('Error joining session:', error);
      alert(`Error: ${error.message || error}`);
      setIsCheckingIn(false);
    }
  };

  const handleShareLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setPlayerLocation([longitude, latitude]);

        // Add player marker - ensure map container is ready
        if (map.current) {
          const addPlayerMarker = () => {
            if (!map.current) return;
            
            // Check if map container exists and is in DOM
            const container = map.current.getContainer();
            if (!container || !container.parentElement) {
              console.warn('Map container not ready, retrying...');
              setTimeout(addPlayerMarker, 100);
              return;
            }

            if (!map.current.loaded()) {
              map.current.once('load', addPlayerMarker);
              return;
            }

            const existingMarker = document.getElementById('player-marker');
            if (existingMarker) existingMarker.remove();

            try {
              const marker = new mapboxgl.Marker({ 
                element: createMarkerElement('player', () => {
                  setSelectedMarker({
                    type: 'player',
                    location: [longitude, latitude]
                  });
                })
              })
                .setLngLat([longitude, latitude])
                .addTo(map.current);
              marker.getElement().id = 'player-marker';
            } catch (error) {
              console.error('Failed to add player marker:', error);
            }
          };

          addPlayerMarker();
        }

        // Get country code
        const countryCode = await getCountryCode(longitude, latitude);
        if (!countryCode) {
          alert('Failed to determine country');
          return;
        }

        // Create session
        if (contractClient) {
          try {
            const cellId = calculateCellId(latitude, longitude);
            const assetTag = await getAssetTag();
            const sessionId = await contractClient.createSession();

            // Generate ZK proof for location privacy
              // For MVP, temporarily skip proof to test basic flow
              // TODO: Re-enable proof once struct deserialization is fixed
              // const { generateLocationProof } = await import('./zk-proof');
              // const locationProof = await generateLocationProof(latitude, longitude);
              
              await contractClient.joinSession(
                sessionId, 
                cellId, 
                assetTag, 
                countryCode
                // Temporarily disabled proof
                // {
                //   proof: locationProof.proof,
                //   publicInputs: [locationProof.publicInputs.cellId, locationProof.publicInputs.gridSize]
                // }
              );
            setSessionLink(`${window.location.origin}?session=${sessionId}`);
            
            // Fetch other users after joining
            fetchOtherUsers([longitude, latitude]);
          } catch (error: any) {
            if (error.message?.includes('rejected') || error.message?.includes('denied')) {
              // User rejected transaction - this is expected, don't show error
              console.log('Transaction rejected by user');
            } else if (error.message?.includes('Country not allowed')) {
              alert('Your country is not allowed to join sessions');
            } else if (error.message?.includes('txTooLate')) {
              alert('Transaction expired. Please try again.');
            } else {
              alert(`Failed to create session: ${error.message}`);
            }
          }
        }
      },
      (error) => {
        alert(`Geolocation error: ${error.message}`);
      }
    );
  };

  const getCountryCode = async (lng: number, lat: number): Promise<number | null> => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxgl.accessToken}&types=country`
      );
      const data = await response.json();
      const country = data.features[0]?.properties?.short_code?.toUpperCase();
      if (!country) return null;

      // Convert ISO2 to ISO numeric
      const isoNumeric = iso2ToNumeric(country);
      return isoNumeric;
    } catch (error) {
      console.error('Failed to geocode:', error);
      return null;
    }
  };


  const calculateCellId = (lat: number, lng: number): number => {
    // Simple grid-based cell calculation
    const gridSize = 1.0; // degrees
    const cellX = Math.floor((lng + 180) / gridSize);
    const cellY = Math.floor((lat + 90) / gridSize);
    return cellY * 360 + cellX;
  };

  const getAssetTag = async (): Promise<Uint8Array> => {
    // Get trustlines and hash asset
    // Simplified for MVP
    if (!wallet) throw new Error('Wallet not connected');
    // In production, fetch trustlines and hash selected asset
    return new Uint8Array(32); // Placeholder
  };

  const [selectedMarker, setSelectedMarker] = useState<{
    type: 'player' | 'opponent';
    location: [number, number];
    userId?: string;
    publicKey?: string;
    distance?: number;
    sessionId?: number;
    cellId?: number;
    country?: number;
  } | null>(null);

  const createMarkerElement = (type: 'player' | 'opponent', onClick?: () => void): HTMLElement => {
    const el = document.createElement('div');
    el.className = `marker marker-${type}`;
    if (onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
    }
    return el;
  };

  useEffect(() => {
    if (otherUsers.length > 0 && showOtherUsers) {
      updateOtherUserMarkers(otherUsers.filter(u => u.distance <= maxDistance));
    } else if (!showOtherUsers) {
      document.querySelectorAll('.other-user-marker').forEach(m => m.remove());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDistance, showOtherUsers]);

  // Ensure overlay is expanded on mobile when no wallet is connected
  useEffect(() => {
    if (!wallet) {
      // On mobile, always expand overlay when no wallet is connected
      const isMobile = window.innerWidth <= 768;
      if (isMobile && overlayMinimized) {
        setOverlayMinimized(false);
      }
    }
  }, [wallet, overlayMinimized]);

  // Ensure overlay stays visible on mobile - check on window resize
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile && !wallet && overlayMinimized) {
        setOverlayMinimized(false);
      }
    };
    window.addEventListener('resize', handleResize);
    // Also check immediately
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [wallet, overlayMinimized]);

  return (
    <div className="App">
      <div ref={mapContainer} className="map-container" />
      
      <div className={`overlay ${overlayMinimized && wallet ? 'minimized' : ''} ${!wallet ? 'no-wallet' : ''}`}>
        <div className="overlay-header">
          {wallet && walletAddress && (
            <div className="wallet-status" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="wallet-address" style={{ fontFamily: 'Courier New', fontSize: '12px' }}>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                {isAdmin && <span className="admin-badge">ADMIN</span>}
              </div>
              {accountBalance !== null && (
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Balance: {accountBalance} XLM
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button 
                  className="icon-button" 
                  onClick={() => {
                    navigator.clipboard.writeText(walletAddress);
                    alert('Address copied to clipboard!');
                  }}
                  title="Copy Address"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                >
                  📋
                </button>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="icon-button"
                  title="View on Stellar Explorer"
                  style={{ fontSize: '10px', padding: '2px 6px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  🔗
                </a>
              </div>
            </div>
          )}
          <div className="overlay-controls">
            {wallet && (
              <button className="icon-button" onClick={disconnectWallet} title="Disconnect Wallet">
                ✕
              </button>
            )}
            {/* Hide minimize button on mobile when no wallet is connected */}
            {wallet && (
              <button 
                className="icon-button" 
                onClick={() => setOverlayMinimized(!overlayMinimized)} 
                title={overlayMinimized ? "Restore" : "Minimize"}
              >
                {overlayMinimized ? '□' : '−'}
              </button>
            )}
          </div>
        </div>
        {!overlayMinimized && (
          <>
            {walletError ? (
              <div className="wallet-error">
                <h3>Wallet Connection Required</h3>
                <p>{walletError}</p>
                {walletError.includes('No wallets available') && (
                  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '13px' }}>
                    <strong>Mobile Users:</strong> Install a mobile wallet:
                    <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                      <li><strong>xBull</strong> - Install as PWA from <a href="https://xbull.app" target="_blank" rel="noopener noreferrer">xbull.app</a></li>
                      <li><strong>Albedo</strong> - Works in browser, no install needed</li>
                      <li><strong>Lobstr</strong> - Mobile app available</li>
                      <li><strong>WalletConnect</strong> - Connect to mobile wallets</li>
                    </ul>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
                      <strong>Note:</strong> Freighter is a browser extension and only works on desktop.
                    </p>
                  </div>
                )}
                <p style={{ marginTop: '12px', fontSize: '12px' }}>
                  <a href="https://stellarwalletskit.dev/" target="_blank" rel="noopener noreferrer">
                    Learn about supported wallets →
                  </a>
                </p>
                <button className="primary-button" onClick={() => { setWalletError(null); connectWallet(); }} style={{ marginTop: '12px' }}>
                  Try Again
                </button>
              </div>
            ) : !wallet ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="primary-button" onClick={connectWallet} style={{ width: '100%' }}>
                  {isCheckingIn ? (
                    <>
                      <span className="loading-spinner"></span>
                      Connecting...
                    </>
                  ) : (
                    'Connect Wallet'
                  )}
                </button>
                {navigator.userAgent.match(/Mobile|Android|iPhone|iPad/) && (
                  <div style={{ fontSize: '12px', color: '#666', textAlign: 'center', margin: 0, padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    <strong>Mobile wallets:</strong> xBull (PWA), Albedo, WalletConnect, Lobstr
                    <br />
                    <span style={{ fontSize: '11px', color: '#999' }}>Freighter is desktop-only</span>
                  </div>
                )}
                
                {/* Show user's current session if connected */}
                {wallet && userCurrentSession !== null && (
                  <div className="game-panel" style={{ marginTop: '8px', backgroundColor: '#FFD700', color: '#000', padding: '12px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Your Session</h3>
                    <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                      <div><strong>Session #{userCurrentSession}</strong></div>
                      <div>Status: {activeSessions.find(s => s.sessionId === userCurrentSession)?.state || 'Active'}</div>
                    </div>
                    <button 
                      className="primary-button" 
                      onClick={() => {
                        // Note: Contract doesn't have leave_session, but we can show info
                        alert('To leave this session, wait for it to end or create a new session. The session will automatically end when resolved.');
                      }}
                      style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#000', color: '#FFD700' }}
                    >
                      View Session Details
                    </button>
                  </div>
                )}
                
                {/* Show active sessions even without wallet */}
                {activeSessions.length > 0 && (
                  <div className="game-panel" style={{ marginTop: '8px' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                      {wallet ? 'Other Sessions' : 'Active Sessions'}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {activeSessions
                        .filter(s => wallet ? s.sessionId !== userCurrentSession : true)
                        .map(session => (
                        <div key={session.sessionId} style={{ padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '6px', fontSize: '12px' }}>
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
                              onClick={() => handleJoinSession(session.sessionId)}
                              style={{ marginTop: '8px', padding: '6px 12px', fontSize: '11px', width: '100%' }}
                              disabled={userCurrentSession !== null}
                            >
                              {userCurrentSession !== null ? 'Already in a Session' : 'Join Session'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <GamePanel
                  onShareLocation={handleShareLocation}
                  sessionLink={sessionLink}
                  playerLocation={playerLocation}
                  showOtherUsers={showOtherUsers}
                  onToggleShowUsers={setShowOtherUsers}
                  maxDistance={maxDistance}
                  onDistanceChange={setMaxDistance}
                  otherUsersCount={otherUsers.length}
                  minimized={gamePanelMinimized}
                  onToggleMinimize={() => setGamePanelMinimized(!gamePanelMinimized)}
                />
                
                {/* Show user's current session if connected */}
                {userCurrentSession !== null && (
                  <CollapsiblePanel
                    title="Your Session"
                    minimized={yourSessionMinimized}
                    onToggleMinimize={() => setYourSessionMinimized(!yourSessionMinimized)}
                    className=""
                    style={{ marginTop: '8px', backgroundColor: '#FFD700', color: '#000', padding: '12px', borderRadius: '8px' }}
                  >
                    <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                      <div><strong>Session #{userCurrentSession}</strong></div>
                      {(() => {
                        const session = activeSessions.find(s => s.sessionId === userCurrentSession);
                        return (
                          <>
                            <div style={{ marginTop: '4px' }}><strong>Status:</strong> {session?.state || 'Active'}</div>
                            {session?.player1 && (
                              <div style={{ marginTop: '4px' }}>
                                <strong>Player 1:</strong> {session.player1.slice(0, 6)}...{session.player1.slice(-4)}
                                {session.p1CellId && <span style={{ color: '#666', fontSize: '10px' }}> (Cell: {session.p1CellId})</span>}
                                {session.p1Country && <span style={{ color: '#666', fontSize: '10px' }}> (Country: {session.p1Country})</span>}
                              </div>
                            )}
                            {session?.player2 && (
                              <div style={{ marginTop: '4px' }}>
                                <strong>Player 2:</strong> {session.player2.slice(0, 6)}...{session.player2.slice(-4)}
                                {session.p2CellId && <span style={{ color: '#666', fontSize: '10px' }}> (Cell: {session.p2CellId})</span>}
                                {session.p2Country && <span style={{ color: '#666', fontSize: '10px' }}> (Country: {session.p2Country})</span>}
                              </div>
                            )}
                            {session?.createdLedger && (
                              <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
                                Created at ledger: {session.createdLedger}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {(() => {
                      const session = activeSessions.find(s => s.sessionId === userCurrentSession);
                      if (session?.state === 'Active' && contractClient) {
                        return (
                          <button 
                            className="primary-button" 
                            onClick={async () => {
                              if (!contractClient) return;
                              try {
                                const result = await contractClient.resolveMatch(userCurrentSession);
                                alert(`Match resolved! ${result.matched ? 'Matched!' : 'No match.'} Winner: ${result.winner ? `${result.winner.slice(0, 6)}...${result.winner.slice(-4)}` : 'None'}`);
                                // Refresh sessions after resolution
                                setTimeout(() => {
                                  if (readOnlyClient) {
                                    fetchActiveSessions();
                                  }
                                }, 2000);
                              } catch (error: any) {
                                console.error('Failed to resolve match:', error);
                                alert(`Failed to resolve match: ${error.message || error}`);
                              }
                            }}
                            style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#000', color: '#FFD700', width: '100%', marginBottom: '8px' }}
                          >
                            Resolve Match
                          </button>
                        );
                      }
                      return null;
                    })()}
                    <button 
                      className="primary-button" 
                      onClick={() => {
                        // Note: Contract doesn't have leave_session, but we can show info
                        alert('To leave this session, wait for it to end or create a new session. The session will automatically end when resolved.');
                      }}
                      style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#000', color: '#FFD700', width: '100%' }}
                    >
                      View Session Details
                    </button>
                  </CollapsiblePanel>
                )}
                
                {/* Show other active sessions - always show all sessions except user's current one */}
                <CollapsiblePanel
                  title={userCurrentSession !== null ? 'Other Sessions' : 'Active Sessions'}
                  minimized={otherSessionsMinimized}
                  onToggleMinimize={() => setOtherSessionsMinimized(!otherSessionsMinimized)}
                  className=""
                  style={{ marginTop: '8px' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {activeSessions.filter(s => s.sessionId !== userCurrentSession).length > 0 ? (
                      activeSessions
                        .filter(s => s.sessionId !== userCurrentSession)
                        .map(session => (
                        <div key={session.sessionId} style={{ padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '6px', fontSize: '12px' }}>
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
                              onClick={() => handleJoinSession(session.sessionId)}
                              style={{ marginTop: '8px', padding: '6px 12px', fontSize: '11px', width: '100%' }}
                              disabled={userCurrentSession !== null}
                            >
                              {userCurrentSession !== null ? 'Already in a Session' : 'Join Session'}
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '12px', textAlign: 'center', color: '#666', fontSize: '12px' }}>
                        No other active sessions found. Sessions will appear here when other players create or join sessions.
                      </div>
                    )}
                  </div>
                </CollapsiblePanel>
                
                {isAdmin && (
                  <AdminPanel
                    contractClient={contractClient!}
                    allowedCountries={allowedCountries}
                    defaultAllowAll={defaultAllowAll}
                    onCountryToggle={fetchCountryPolicy}
                    map={map.current}
                    minimized={adminPanelMinimized}
                    onToggleMinimize={() => setAdminPanelMinimized(!adminPanelMinimized)}
                    onAdminChanged={async () => {
                      // Re-check admin status after admin change
                      // This will remove admin privileges if the current user is no longer admin
                      setTimeout(async () => {
                        await checkAdminStatus();
                      }, 2000); // Wait 2 seconds for transaction to settle
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
      
      {/* Marker Profile Popup */}
      {selectedMarker && (
        <div className="marker-popup-overlay" onClick={() => setSelectedMarker(null)}>
          <div className="marker-popup" onClick={(e) => e.stopPropagation()}>
            <button className="marker-popup-close" onClick={() => setSelectedMarker(null)}>×</button>
            <h3>{selectedMarker.type === 'player' ? 'Your Profile' : 'Player Profile'}</h3>
            <div className="marker-popup-content">
              {selectedMarker.publicKey && (
                <div className="marker-popup-field">
                  <label>Public Key:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="marker-popup-id" style={{ fontFamily: 'Courier New', fontSize: '12px', wordBreak: 'break-all' }}>
                      {selectedMarker.publicKey}
                    </span>
                    <button
                      className="icon-button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedMarker.publicKey!);
                        alert('Public key copied to clipboard!');
                      }}
                      title="Copy Public Key"
                      style={{ fontSize: '12px', padding: '4px 8px', flexShrink: 0 }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              )}
              <div className="marker-popup-field">
                <label>Location:</label>
                <span>{selectedMarker.location[1].toFixed(4)}, {selectedMarker.location[0].toFixed(4)}</span>
              </div>
              {selectedMarker.distance !== undefined && (
                <div className="marker-popup-field">
                  <label>Distance:</label>
                  <span>{selectedMarker.distance.toFixed(1)} km</span>
                </div>
              )}
              {selectedMarker.sessionId && (
                <div className="marker-popup-field">
                  <label>Session ID:</label>
                  <span>#{selectedMarker.sessionId}</span>
                </div>
              )}
              {selectedMarker.cellId && (
                <div className="marker-popup-field">
                  <label>Cell ID:</label>
                  <span>{selectedMarker.cellId}</span>
                </div>
              )}
              {selectedMarker.country && (
                <div className="marker-popup-field">
                  <label>Country Code:</label>
                  <span>{selectedMarker.country}</span>
                </div>
              )}
              {selectedMarker.userId && (
                <div className="marker-popup-field">
                  <label>User ID:</label>
                  <span className="marker-popup-id">{selectedMarker.userId}</span>
                </div>
              )}
              {selectedMarker.type === 'player' && (
                <div className="marker-popup-field">
                  <label>Status:</label>
                  <span className="marker-popup-status">Active</span>
                </div>
              )}
              {selectedMarker.publicKey && selectedMarker.type === 'opponent' && walletAddress && (
                <TrustlineComparison 
                  myPublicKey={walletAddress}
                  theirPublicKey={selectedMarker.publicKey}
                />
              )}
              {selectedMarker.publicKey && (
                <div className="marker-popup-field" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                  <a
                    href={`https://stellar.expert/explorer/testnet/account/${selectedMarker.publicKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#FFD700', textDecoration: 'none', fontWeight: 600 }}
                  >
                    View on Stellar Explorer →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
