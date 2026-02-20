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
import { ConfirmationOverlay } from './ConfirmationOverlay';
import { NotificationOverlay } from './NotificationOverlay';
import { SessionDetailsOverlay } from './SessionDetailsOverlay';
import { CountryManagementOverlay } from './CountryManagementOverlay';
import { CountryProfileOverlay } from './CountryProfileOverlay';
import { iso2ToNumeric, iso3ToIso2 } from './countryCodes';
import { Horizon } from '@stellar/stellar-sdk';
import { geolinkApi, NearbyNFT, NearbyContract } from './services/geolinkApi';

// Helper function to construct NFT image URL (matching xyz-wallet exactly)
function cleanServerUrl(serverUrl: string | null | undefined): string | null {
  if (!serverUrl) return null;
  
  let baseUrl = serverUrl.trim();
  
  // Remove any existing /ipfs/ path and everything after it
  baseUrl = baseUrl.replace(/\/ipfs\/.*$/i, '');
  
  // Remove trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, '');
  
  // Remove protocol if present (we'll add https://)
  baseUrl = baseUrl.replace(/^https?:\/\//i, '');
  
  // Add https:// protocol
  if (baseUrl) {
    return `https://${baseUrl}`;
  }
  
  return null;
}

function constructImageUrl(serverUrl: string | null | undefined, ipfsHash: string | null | undefined): string {
  if (!ipfsHash) {
    return 'https://via.placeholder.com/200x200?text=NFT';
  }
  
  const baseUrl = cleanServerUrl(serverUrl);
  if (!baseUrl) {
    // Fallback to public IPFS gateway
    return `https://ipfs.io/ipfs/${ipfsHash}`;
  }
  
  return `${baseUrl}/ipfs/${ipfsHash}`;
}

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

        // Process trustlines to find differences

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
  const [mapZoom, setMapZoom] = useState<number>(2); // Track map zoom level
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [contractClient, setContractClient] = useState<ContractClient | null>(null);
  // Initialize isAdmin from localStorage if available (for XDR error cases)
  const [isAdmin, setIsAdmin] = useState(() => {
    const stored = localStorage.getItem('geotrust_isAdmin');
    const storedAddress = localStorage.getItem('geotrust_adminAddress');
    const currentAddress = localStorage.getItem('wallet_address');
    // Only restore if the stored address matches current address
    if (stored === 'true' && storedAddress === currentAddress) {
      console.log('[App] Restoring admin status from localStorage for', currentAddress);
      return true;
    }
    return false;
  });
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mainAdminAddress, setMainAdminAddress] = useState<string | null>(null);
  const [overlayMinimized, setOverlayMinimized] = useState(false);
  const [allowedCountries, setAllowedCountries] = useState<Set<number>>(new Set()); // u32 country codes
  const [defaultAllowAll, setDefaultAllowAll] = useState(false);
  const [countryDataLoaded, setCountryDataLoaded] = useState(false); // Track when country policy data has been loaded
  const [playerLocation, setPlayerLocation] = useState<[number, number] | null>(null);
  const [sessionLink, setSessionLink] = useState<string>('');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showOtherUsers, setShowOtherUsers] = useState(true);
  const [maxDistance, setMaxDistance] = useState(50000); // km - default to maximum
  const [otherUsers, setOtherUsers] = useState<Array<{ id: string; location: [number, number]; distance: number }>>([]);
  // Note: nearbyNFTs and nearbyContracts are fetched but not yet displayed in UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [nearbyNFTs, setNearbyNFTs] = useState<NearbyNFT[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [nearbyContracts, setNearbyContracts] = useState<NearbyContract[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // Note: Sessions are managed entirely on-chain, not in GeoLink
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
  // Track sessions that the user has explicitly ended (so we don't re-add them)
  const endedSessionsRef = useRef<Set<number>>(new Set());
  const [gamePanelMinimized, setGamePanelMinimized] = useState(false);
  const [yourSessionMinimized, setYourSessionMinimized] = useState(false);
  const [otherSessionsMinimized, setOtherSessionsMinimized] = useState(false);
  const [adminPanelMinimized, setAdminPanelMinimized] = useState(false);
  
  // Confirmation and notification overlay states
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);
  
  const [notificationState, setNotificationState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    autoClose?: number;
  } | null>(null);
  
  // Country overlay state
  const [showCountryManagementOverlay, setShowCountryManagementOverlay] = useState(false);
  const [showCountryProfileOverlay, setShowCountryProfileOverlay] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<{ code: number; name: string } | null>(null);
  
  // Session details overlay state
  const [showSessionDetailsOverlay, setShowSessionDetailsOverlay] = useState(false);
  const [countryNameCache, setCountryNameCache] = useState<Map<number, string>>(new Map());
  
  // Refs for NFT and contract markers (matching xyz-wallet pattern)
  const nftMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const nftCirclesRef = useRef<string[]>([]);
  const contractMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const contractCirclesRef = useRef<string[]>([]);
  const userCirclesRef = useRef<string[]>([]);
  
  // Debounce refs for marker updates
  const markerUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMarkerUpdateRef = useRef<number>(0);
  
  // Track previous marker data to prevent unnecessary updates
  const previousUserMarkersRef = useRef<string>('');
  const previousContractMarkersRef = useRef<string>('');
  
  // Map settings state
  const [mapStyle, setMapStyle] = useState<string>('mapbox://styles/mapbox/light-v11');
  const [showMapSettings, setShowMapSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mapFilters, setMapFilters] = useState({
    showUsers: true,
    showNFTs: true,
    showContracts: true,
  });
  
  // 3D controls state
  const [enable3D, setEnable3D] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [showBuildings, setShowBuildings] = useState(false);
  const [showTerrain, setShowTerrain] = useState(false);
  
  // Apply filters to marker visibility
  useEffect(() => {
    if (!map.current) return;
    
    // Update user markers visibility
    document.querySelectorAll('.other-user-marker, .session-user-marker').forEach((marker) => {
      (marker as HTMLElement).style.display = mapFilters.showUsers ? 'flex' : 'none';
    });
    
    // Update NFT markers visibility
    nftMarkersRef.current.forEach((marker) => {
      const el = marker.getElement();
      if (el) {
        el.style.display = mapFilters.showNFTs ? 'flex' : 'none';
      }
    });
    
    // Update contract markers visibility
    contractMarkersRef.current.forEach((marker) => {
      const el = marker.getElement();
      if (el) {
        el.style.display = mapFilters.showContracts ? 'flex' : 'none';
      }
    });
  }, [mapFilters, nftMarkersRef, contractMarkersRef]);

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
      defaultAllowAll,
      allowedCountriesArray: Array.from(allowedCountries).slice(0, 10) // First 10 for debugging
    });

    let updatedCount = 0;
    let allowedCount = 0;
    let deniedCount = 0;
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
      // Handle undefined (initial state) - treat as not allowed for comparison
      const wasAllowedBool = wasAllowed === undefined ? false : Boolean(wasAllowed);
      feature.properties.allowed = Boolean(allowed);
      
      // Count updates for debugging (treat undefined as false for comparison)
      if (wasAllowedBool !== feature.properties.allowed) {
        updatedCount++;
      }
      
      // Count allowed vs denied
      if (feature.properties.allowed) {
        allowedCount++;
      } else {
        deniedCount++;
      }
    });

    console.log('[App] updateCountryOverlay: Updated', updatedCount, 'features', {
      allowed: allowedCount,
      denied: deniedCount,
      total: data.features.length
    });
    
    // Update the source with modified data
    source.setData(data);
  }, [defaultAllowAll, allowedCountries]);

  // Call updateCountryOverlay when defaultAllowAll or allowedCountries changes
  // Only update if country data has been loaded AND overlay source exists to prevent race conditions
  useEffect(() => {
    // Don't update if data hasn't been loaded yet OR if overlay source doesn't exist
    if (!countryDataLoaded) {
      console.log('[App] Country data not loaded yet, skipping overlay update');
      return;
    }
    
    // Don't update if overlay source doesn't exist yet
    if (!map.current || !map.current.getSource('countries')) {
      console.log('[App] Countries source not ready yet, skipping overlay update');
      return;
    }
    
    // Use a delay to ensure state has fully updated and propagated
    const timer = setTimeout(() => {
      if (map.current && map.current.loaded() && map.current.isStyleLoaded()) {
        const source = map.current.getSource('countries');
        if (source) {
          // Get the latest state values directly (not from closure) to ensure we have the updated values
          console.log('[App] defaultAllowAll or allowedCountries changed, updating overlay', { 
            defaultAllowAll, 
            allowedCount: allowedCountries.size,
            allowedCountriesArray: Array.from(allowedCountries).slice(0, 10), // First 10 for debugging
            countryDataLoaded,
            note: 'Using latest state values from closure'
          });
          // updateCountryOverlay is a useCallback, so it will use the latest defaultAllowAll and allowedCountries
          updateCountryOverlay();
        } else {
          console.warn('[App] Countries source not ready yet for overlay update');
        }
      } else {
        console.warn('[App] Map not ready yet for overlay update', {
          loaded: map.current?.loaded(),
          styleLoaded: map.current?.isStyleLoaded()
        });
      }
    }, 800); // Longer delay to ensure React state has fully updated and propagated
    return () => clearTimeout(timer);
  }, [defaultAllowAll, allowedCountries, updateCountryOverlay, countryDataLoaded]);

  // Also update overlay when countryDataLoaded becomes true (for initial load)
  // But only if defaultAllowAll and allowedCountries have been set (not at initial values)
  useEffect(() => {
    if (countryDataLoaded && map.current && map.current.getSource('countries')) {
      // Check if we have actual data (not just initial values)
      // If defaultAllowAll is false and allowedCountries is empty, we might still be loading
      // Wait a bit more to ensure state has propagated
      const timer = setTimeout(() => {
        if (map.current && map.current.getSource('countries')) {
          console.log('[App] Country data just loaded, updating overlay', {
            defaultAllowAll,
            allowedCount: allowedCountries.size,
            countryDataLoaded
          });
          updateCountryOverlay();
        }
      }, 1000); // Longer delay to ensure state has fully propagated
      return () => clearTimeout(timer);
    }
  }, [countryDataLoaded, updateCountryOverlay, defaultAllowAll, allowedCountries]);

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
          
          // Don't set allowed here - it will be set by updateCountryOverlay after data is loaded
          // This prevents race conditions where overlay is initialized before policy data is loaded
          // Set to undefined initially, updateCountryOverlay will set it properly
          feature.properties.allowed = undefined;
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
      
      // Don't call updateCountryOverlay here - it will be called by the useEffect
      // that watches defaultAllowAll and allowedCountries after state updates
      // This ensures we use the correct state values, not stale closure values
    } catch (error) {
      console.error('Failed to load countries GeoJSON:', error);
    }
  }, []); // No dependencies - this function only loads the GeoJSON, doesn't use state

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
      
      // Ensure mapStyle has the full URL format
      const initialStyle = mapStyle && mapStyle.startsWith('mapbox://') 
        ? mapStyle 
        : `mapbox://styles/mapbox/${mapStyle || 'light-v11'}`;
      
      map.current = new mapboxgl.Map({
        container: container,
        style: initialStyle,
        center: [0, 0],
        zoom: 2,
        pitch: pitch,
        bearing: bearing,
        // Set initial zoom for logo visibility
        // Logo will be visible at zoom <= 4
      });
      
      // Update state to ensure it has the full URL format
      if (!mapStyle.startsWith('mapbox://')) {
        setMapStyle(initialStyle);
      }

      const handleMapLoad = () => {
        console.log('[App] Map loaded successfully');
        if (map.current) {
          // Set initial zoom state for logo visibility
          setMapZoom(map.current.getZoom());
          
          loadCountryOverlay().then(() => {
            console.log('[App] Country overlay loaded - will be updated when country data is loaded');
            // Don't update overlay here - let the useEffect that watches countryDataLoaded handle it
            // This ensures we don't update with stale/empty data
            // The useEffect at line 427 will call updateCountryOverlay when countryDataLoaded becomes true
          });
          // NFT markers will be rendered automatically via useEffect when nearbyNFTs changes
          // Admin check will happen automatically via useEffect when wallet and client are ready
        }
      };
      map.current.on('load', handleMapLoad);

      map.current.on('error', (e: any) => {
        console.error('[App] Map error:', e);
        if (e.error && e.error.message) {
          console.error('[App] Map error details:', e.error.message);
        }
        // If style loading fails, try to fallback to a working style
        if (e.error && e.error.message && e.error.message.includes('style')) {
          console.warn('[App] Map style error detected, attempting fallback to streets-v12');
          if (map.current) {
            try {
              map.current.setStyle('mapbox://styles/mapbox/streets-v12');
              setMapStyle('mapbox://styles/mapbox/streets-v12');
            } catch (fallbackError) {
              console.error('[App] Fallback style also failed:', fallbackError);
            }
          }
        }
      });

      // Track zoom level for logo visibility
      map.current.on('zoom', () => {
        if (map.current) {
          setMapZoom(map.current.getZoom());
        }
      });

      map.current.on('zoomend', () => {
        if (map.current) {
          setMapZoom(map.current.getZoom());
        }
      });

      map.current.on('style.load', () => {
        console.log('[App] Map style loaded');
        // Reload country policy data and overlay after style change
        // Create a new ReadOnlyContractClient to fetch fresh data
        const reloadCountryData = async () => {
          try {
            // Create a new client instance to fetch fresh data
            const client = new ReadOnlyContractClient();
            let defaultAllowAll = false;
            let allowedCount = 0;
            
            // Get country policy
            try {
              const policyResult = await client.getCountryPolicy();
              if (Array.isArray(policyResult) && policyResult.length >= 3) {
                [defaultAllowAll, allowedCount] = policyResult;
                setDefaultAllowAll(defaultAllowAll);
                console.log('[App] Country policy reloaded after style change:', { defaultAllowAll, allowedCount });
              }
            } catch (error: any) {
              console.warn('[App] Failed to reload country policy after style change:', error);
            }
            
            // Get allowed countries list
            try {
              const pageSize = allowedCount > 0 ? Math.min(allowedCount, 1000) : 1000;
              const listResult = await client.listAllowedCountries(0, pageSize);
              if (Array.isArray(listResult)) {
                setAllowedCountries(new Set(listResult));
                console.log('[App] Allowed countries list reloaded after style change:', listResult.length, 'countries');
              }
            } catch (error: any) {
              console.warn('[App] Failed to reload allowed countries list after style change:', error);
            }
            
            // Then reload the overlay
            loadCountryOverlay().then(() => {
              console.log('[App] Country overlay reloaded after style change');
              // Update overlay with current policy
              setTimeout(() => {
                updateCountryOverlay();
              }, 300);
            });
          } catch (error) {
            console.error('[App] Error reloading country data after style change:', error);
            // Fallback: just reload overlay
            loadCountryOverlay().then(() => {
              setTimeout(() => {
                updateCountryOverlay();
              }, 200);
            });
          }
        };
        
        reloadCountryData();
      });
      
      // Add Navigation Control (zoom in/out) - position below search/settings
      const navControl = new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
        visualizePitch: true
      });
      map.current.addControl(navControl, 'bottom-right');
      
      // Add Geolocate Control (my location) - position below navigation control
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      });
      map.current.addControl(geolocateControl, 'bottom-right');
      
      // Add country click handler
      const handleCountryClick = async (e: mapboxgl.MapMouseEvent) => {
        const features = map.current!.queryRenderedFeatures(e.point, {
          layers: ['countries-fill'],
        });

        if (features.length > 0) {
          let countryCode = features[0].properties?.ISO_NUMERIC;
          if (!countryCode) {
            const iso3 = features[0].id;
            const iso2 = features[0].properties?.ISO2;
            
            if (iso2) {
              countryCode = iso2ToNumeric(iso2);
            } else if (iso3) {
              const iso3Str = typeof iso3 === 'string' ? iso3 : String(iso3);
              const iso2FromIso3 = iso3ToIso2(iso3Str);
              if (iso2FromIso3) {
                countryCode = iso2ToNumeric(iso2FromIso3);
              }
            }
          }
          
          if (countryCode) {
            const code = Number(countryCode);
            
            // Get country name from cache or GeoJSON
            let countryName: string = countryNameCache.get(code) || '';
            if (!countryName) {
              const name = features[0].properties?.name || features[0].properties?.NAME;
              if (name) {
                countryName = String(name);
                const newCache = new Map(countryNameCache);
                newCache.set(code, countryName);
                setCountryNameCache(newCache);
              } else {
                // Fallback: try to load from GeoJSON
                try {
                  const response = await fetch('/countries.geojson');
                  if (response.ok) {
                    const geojson = await response.json();
                    const feature = geojson.features.find((f: any) => {
                      const fCode = f.properties?.ISO_NUMERIC;
                      return fCode && Number(fCode) === code;
                    });
                    if (feature) {
                      countryName = feature.properties?.name || feature.properties?.NAME || `Country ${code}`;
                      const newCache = new Map(countryNameCache);
                      newCache.set(code, countryName);
                      setCountryNameCache(newCache);
                    } else {
                      countryName = `Country ${code}`;
                    }
                  } else {
                    countryName = `Country ${code}`;
                  }
                } catch (error) {
                  console.error('[App] Failed to load country name:', error);
                  countryName = `Country ${code}`;
                }
              }
            }
            
            // Ensure countryName is not empty
            if (!countryName) {
              countryName = `Country ${code}`;
            }
            
            // Check if user is admin (main admin or country admin)
            const isMainAdmin = !!(walletAddress && mainAdminAddress && walletAddress === mainAdminAddress);
            let isCountryAdmin = false;
            
            if (walletAddress && !isMainAdmin) {
              try {
                // Use read-only client to avoid Freighter prompts
                const readOnlyClient = new ReadOnlyContractClient();
                const admin = await readOnlyClient.getCountryAdmin(code);
                isCountryAdmin = admin === walletAddress;
              } catch (error) {
                // Ignore errors - user is not country admin
              }
            }
            
            // Open appropriate overlay
            if (isMainAdmin || isCountryAdmin) {
              setSelectedCountry({ code, name: countryName });
              setShowCountryManagementOverlay(true);
            } else {
              setSelectedCountry({ code, name: countryName });
              setShowCountryProfileOverlay(true);
            }
          }
        }
      };

      map.current.on('click', 'countries-fill', handleCountryClick);
      map.current.getCanvas().style.cursor = 'pointer';
      
      return () => {
        map.current?.off('click', 'countries-fill', handleCountryClick);
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      };
    } catch (error) {
      console.error('[App] Failed to initialize map:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCountryOverlay, mapStyle, pitch, bearing, updateCountryOverlay]);

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

  // Ref to store connectWallet function so it can be accessed in updateSessionMarkers
  const connectWalletRef = useRef<(() => Promise<void>) | null>(null);
  // Ref to store current walletAddress so event listeners always have the latest value
  const walletAddressRef = useRef<string | null>(null);

  // Update walletAddressRef whenever walletAddress changes
  useEffect(() => {
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  // Convert cellId back to approximate coordinates (center of cell)
  const cellIdToCoordinates = (cellId: number, addRandomization: boolean = false): [number, number] => {
    const cellX = cellId % 360;
    const cellY = Math.floor(cellId / 360);
    // Center of the cell (1 degree grid)
    let lng = cellX * 1.0 - 180 + 0.5;
    let lat = cellY * 1.0 - 90 + 0.5;
    
    // Add randomization within the cell for privacy when not logged in
    if (addRandomization) {
      // Random offset within ±0.4 degrees (stays within cell boundaries)
      lng += (Math.random() - 0.5) * 0.8;
      lat += (Math.random() - 0.5) * 0.8;
    }
    
    return [lng, lat];
  };

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
    
    // When not logged in, use randomized positions to protect privacy
    const useRandomizedPositions = !walletAddress;
    
    // Add markers for players in active sessions
    sessions.forEach(session => {
      if (session.player1 && session.p1CellId) {
        // Convert cell_id to approximate lat/lon
        const [lng, lat] = cellIdToCoordinates(session.p1CellId, useRandomizedPositions);
        
        const el = document.createElement('div');
        el.className = 'marker marker-opponent session-user-marker';
        const publicKeyShort = `${session.player1.slice(0, 4)}...${session.player1.slice(-4)}`;
        el.innerHTML = `<div class="marker-label">👤<div class="marker-public-key">${publicKeyShort}</div></div>`;
        // Match other marker CSS (NFT, contract, other-user markers)
        el.style.cssText = `
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          width: 24px;
          height: 24px;
          transform: translate(-50%, -50%);
          pointer-events: auto;
        `;
        el.title = `${session.player1} - Session #${session.sessionId}`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // Check current walletAddress from ref (always has latest value)
          // When not logged in, prompt to connect wallet instead of showing profile
          if (!walletAddressRef.current) {
            if (window.confirm('Connect your wallet to view player details and join sessions!')) {
              // Trigger wallet connection
              if (connectWalletRef.current) {
                connectWalletRef.current().catch((error) => {
                  console.error('[App] Failed to connect wallet:', error);
                });
              }
            }
            return;
          }
          
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
        // Convert cell_id to approximate lat/lon
        const [lng, lat] = cellIdToCoordinates(session.p2CellId, useRandomizedPositions);
        
        const el = document.createElement('div');
        el.className = 'marker marker-opponent session-user-marker';
        const publicKeyShort = `${session.player2.slice(0, 4)}...${session.player2.slice(-4)}`;
        el.innerHTML = `<div class="marker-label">👤<div class="marker-public-key">${publicKeyShort}</div></div>`;
        // Match other marker CSS (NFT, contract, other-user markers)
        el.style.cssText = `
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          width: 24px;
          height: 24px;
          transform: translate(-50%, -50%);
          pointer-events: auto;
        `;
        el.title = `${session.player2} - Session #${session.sessionId}`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // Check current walletAddress from ref (always has latest value)
          // When not logged in, prompt to connect wallet instead of showing profile
          if (!walletAddressRef.current) {
            if (window.confirm('Connect your wallet to view player details and join sessions!')) {
              // Trigger wallet connection
              if (connectWalletRef.current) {
                connectWalletRef.current().catch((error) => {
                  console.error('[App] Failed to connect wallet:', error);
                });
              }
            }
            return;
          }
          
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
  }, [walletAddress]);
  
  // Track if fetchActiveSessions is currently running to prevent concurrent executions
  const isFetchingSessionsRef = useRef(false);
  
  // Fetch active sessions (poll recent session IDs)
  // Track known active session IDs to optimize polling
  const knownActiveSessionIdsRef = useRef<Set<number>>(new Set());
  const maxSessionIdSeenRef = useRef<number>(0);

  const fetchActiveSessions = useCallback(async () => {
    if (!readOnlyClient) return;
    
    // Prevent concurrent executions
    if (isFetchingSessionsRef.current) {
      console.log('[App] fetchActiveSessions already running, skipping...');
      return;
    }
    
    isFetchingSessionsRef.current = true;

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
      
      // Smart session ID range: check known active sessions + a small range around max seen
      const sessionIdsToCheck = new Set<number>();
      
      // Add all known active session IDs
      knownActiveSessionIdsRef.current.forEach(id => sessionIdsToCheck.add(id));
      
      // Check a small range around the max session ID we've seen (for new sessions)
      const checkRange = 20; // Check 20 sessions ahead of max seen
      let rangeInfo: string;
      
      // If we haven't seen any sessions yet, check a wider initial range (1-100)
      // to discover existing sessions
      if (maxSessionIdSeenRef.current === 0) {
        // Initial discovery: check a wider range
        for (let id = 1; id <= 100; id++) {
          sessionIdsToCheck.add(id);
        }
        rangeInfo = 'initial discovery (1-100)';
      } else {
        // Normal operation: check around max seen
        const startRange = Math.max(1, maxSessionIdSeenRef.current);
        const endRange = Math.min(200, maxSessionIdSeenRef.current + checkRange);
        for (let id = startRange; id <= endRange; id++) {
          sessionIdsToCheck.add(id);
        }
        
        // Also check a small range at the beginning (sessions 1-10) in case we missed early ones
        for (let id = 1; id <= 10; id++) {
          sessionIdsToCheck.add(id);
        }
        rangeInfo = `${startRange}-${endRange}`;
      }
      
      const sessionIdsArray = Array.from(sessionIdsToCheck).sort((a, b) => a - b);
      console.log(`[App] Checking ${sessionIdsArray.length} session IDs (known: ${knownActiveSessionIdsRef.current.size}, range: ${rangeInfo})`);
      
      // Process in batches to avoid overwhelming the backend
      const batchSize = 10;
      for (let i = 0; i < sessionIdsArray.length; i += batchSize) {
        // Process batch in parallel
        const batchPromises = [];
        for (let j = 0; j < batchSize && (i + j) < sessionIdsArray.length; j++) {
          const checkId = sessionIdsArray[i + j];
          batchPromises.push(
            readOnlyClient.getSession(checkId)
              .then(session => {
                if (session && (session.state === 'Waiting' || session.state === 'Active')) {
                  // Track this as an active session
                  knownActiveSessionIdsRef.current.add(checkId);
                  maxSessionIdSeenRef.current = Math.max(maxSessionIdSeenRef.current, checkId);
                  
                  return {
                    sessionId: checkId,
                    player1: session.player1 || null,
                    player2: session.player2 || null,
                    state: session.state || 'Unknown',
                    p1CellId: session.p1CellId || session.p1_cell_id,
                    p2CellId: session.p2CellId || session.p2_cell_id,
                    p1Country: session.p1Country || session.p1_country,
                    p2Country: session.p2Country || session.p2_country,
                    createdLedger: session.createdLedger || session.created_ledger,
                  };
                } else {
                  // Session is no longer active, remove from known set
                  knownActiveSessionIdsRef.current.delete(checkId);
                  return null;
                }
              })
              .catch(() => {
                // Session doesn't exist or error - remove from known set
                knownActiveSessionIdsRef.current.delete(checkId);
                return null;
              })
          );
        }
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          if (result) sessions.push(result);
        });
        
        // Small delay between batches to avoid overwhelming the backend
        if (i + batchSize < sessionIdsArray.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      setActiveSessions(sessions);
      console.log(`[App] Active sessions: ${sessions.length} (checked ${sessionIdsArray.length} IDs)`);
      
      // If user's current session is no longer in active list, check if it's ended
      if (userCurrentSession) {
        const currentSessionInList = sessions.find(s => s.sessionId === userCurrentSession);
        if (!currentSessionInList) {
          // Session is no longer in active list (ended or doesn't exist)
          // Double-check by querying contract
          try {
            if (readOnlyClient) {
              const contractSession = await readOnlyClient.getSession(userCurrentSession);
              if (!contractSession || contractSession.state === 'Ended') {
                console.log('[App] User session', userCurrentSession, 'is ended, clearing');
                setUserCurrentSession(null);
                setSessionLink('');
                // Mark as ended so we don't re-add it
                endedSessionsRef.current.add(userCurrentSession);
              }
            }
          } catch (error) {
            // Session doesn't exist, clear it
            console.log('[App] User session', userCurrentSession, 'not found, clearing');
            setUserCurrentSession(null);
            setSessionLink('');
            // Mark as ended so we don't re-add it
            endedSessionsRef.current.add(userCurrentSession);
          }
        } else if (endedSessionsRef.current.has(userCurrentSession)) {
          // User explicitly ended this session, don't keep it as current
          console.log('[App] User session', userCurrentSession, 'was explicitly ended, clearing');
          setUserCurrentSession(null);
          setSessionLink('');
        }
      }
      
      // Update markers on map from active sessions (even without wallet)
      if (map.current && map.current.loaded()) {
        updateSessionMarkers(sessions);
      }
    } catch (error) {
      console.error('[App] Failed to fetch active sessions:', error);
    } finally {
      isFetchingSessionsRef.current = false;
    }
  }, [readOnlyClient, updateSessionMarkers, userCurrentSession]);

  // Initialize read-only client on mount (for fetching public data without wallet)
  useEffect(() => {
    const client = new ReadOnlyContractClient();
    setReadOnlyClient(client);
    
    // Fetch country policy immediately (doesn't require wallet)
    const loadData = async () => {
      let defaultAllowAll = false;
      let allowedCount = 0;
      let policyLoaded = false;
      
      // Try to get country policy
      try {
        const policyResult = await client.getCountryPolicy();
        // Check if result is valid array
        if (Array.isArray(policyResult) && policyResult.length >= 3) {
          [defaultAllowAll, allowedCount] = policyResult;
          setDefaultAllowAll(defaultAllowAll);
          policyLoaded = true;
          console.log('[App] Country policy loaded:', { defaultAllowAll, allowedCount });
        } else if (policyResult === null) {
          // XDR parsing error - contract client now returns null gracefully
          console.warn('[App] XDR parsing error when loading country policy - will try to load countries list directly');
        }
      } catch (error: any) {
        // If getCountryPolicy fails with XDR error, try to still load countries list
        if (error.message?.includes('XDR_PARSING_ERROR')) {
          console.warn('[App] XDR parsing error when loading country policy - will try to load countries list directly');
        } else {
          console.error('[App] Failed to get country policy:', error);
        }
      }
      
      // Always try to fetch allowed countries list (even if getCountryPolicy failed)
      // This might work even when getCountryPolicy fails due to XDR issues
      let countriesLoaded = false;
      try {
        // Try to get a reasonable page size - if allowedCount is 0, try a large number
        const pageSize = allowedCount > 0 ? Math.min(allowedCount, 1000) : 1000;
        const listResult = await client.listAllowedCountries(0, pageSize);
        if (Array.isArray(listResult)) {
          if (listResult.length > 0) {
            console.log('[App] Successfully loaded', listResult.length, 'allowed countries');
            setAllowedCountries(new Set(listResult));
            countriesLoaded = true;
            // Don't set countryDataLoaded here - wait until after state updates
          } else {
            console.log('[App] No allowed countries in list (empty array)');
            setAllowedCountries(new Set());
            countriesLoaded = true; // Still mark as loaded, just empty
            // Don't set countryDataLoaded here - wait until after state updates
          }
        } else if (listResult === null) {
          // XDR parsing error - contract client now returns null gracefully
          console.warn('[App] XDR parsing error when listing countries - SDK may be incompatible');
          if (!policyLoaded) {
            // If we can't load policy or countries, default to showing all countries
            console.log('[App] Could not load country policy or list - defaulting to show all countries');
            setDefaultAllowAll(true);
            setAllowedCountries(new Set());
            // Mark data as loaded after state update
            setTimeout(() => {
              setCountryDataLoaded(true);
            }, 300);
          }
        } else {
          console.warn('[App] listAllowedCountries returned non-array result:', listResult);
          if (!policyLoaded) {
            // If we can't load policy or countries, default to showing all countries
            // This allows the map to be usable even when contract calls fail
            console.log('[App] Could not load country policy or list - defaulting to show all countries');
            setDefaultAllowAll(true);
            setAllowedCountries(new Set());
            // Mark data as loaded after state update
            setTimeout(() => {
              setCountryDataLoaded(true);
            }, 300);
          }
        }
      } catch (listError: any) {
        // If listing countries also fails, check if it's XDR error
        if (listError.message?.includes('XDR_PARSING_ERROR')) {
          console.warn('[App] XDR parsing error when listing countries - SDK may be incompatible');
        } else {
          console.warn('[App] Failed to list allowed countries:', listError);
        }
        // Only set empty set if we also don't have defaultAllowAll info
        // If defaultAllowAll is true, we want to show all countries
        if (!policyLoaded) {
          // If we can't load policy or countries, default to showing all countries
          // This allows the map to be usable even when contract calls fail
            console.log('[App] Could not load country policy or list - defaulting to show all countries');
            setDefaultAllowAll(true);
            setAllowedCountries(new Set());
            // Mark data as loaded after state update
            setTimeout(() => {
              setCountryDataLoaded(true);
            }, 200);
        }
      }
      
      // Get the current state value for logging (state updates are async)
      const finalDefaultAllowAll = policyLoaded ? defaultAllowAll : true; // If policy not loaded, we default to true
      console.log('[App] Country data loading complete:', { 
        policyLoaded, 
        countriesLoaded, 
        defaultAllowAll: finalDefaultAllowAll, 
        allowedCount,
        note: 'State will update asynchronously - will trigger updateCountryOverlay when ready'
      });
      
      // Mark data as loaded AFTER a delay to ensure state has propagated
      // The useEffect that watches defaultAllowAll and allowedCountries will call updateCountryOverlay
      // when those values change, so we don't need to call it explicitly here
      setTimeout(() => {
        setCountryDataLoaded(true);
        console.log('[App] Country data marked as loaded - useEffect will trigger overlay update', {
          defaultAllowAll,
          allowedCount: allowedCountries.size
        });
      }, 800); // Longer delay to ensure state updates are fully processed
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount. updateCountryOverlay will be called by the useEffect that watches state changes

  // Fetch active sessions when readOnlyClient is ready
  useEffect(() => {
    if (readOnlyClient) {
      fetchActiveSessions();
      
      // Poll every 60 seconds (reduced from 30 to minimize backend load)
      const sessionInterval = setInterval(() => {
        fetchActiveSessions();
      }, 60000);
      
      return () => clearInterval(sessionInterval);
    }
  }, [readOnlyClient, fetchActiveSessions]);

  // Note: GeoLink doesn't have a sessions endpoint, so we handle sessions entirely on-chain

  // Periodic location update to GeoLink when location is available
  useEffect(() => {
    if (!playerLocation || !walletAddress) return;
    
    const updateLocationToGeoLink = async () => {
      try {
        await geolinkApi.updateLocation({
          public_key: walletAddress,
          blockchain: 'stellar',
          latitude: playerLocation[1],
          longitude: playerLocation[0],
          description: 'GeoTrust Match Player',
        });
        console.log('[App] Periodic location update to GeoLink');
      } catch (error) {
        console.warn('[App] Failed periodic location update:', error);
      }
    };
    
    // Update immediately, then every 60 seconds
    updateLocationToGeoLink();
    const interval = setInterval(updateLocationToGeoLink, 60000);
    
    return () => clearInterval(interval);
  }, [playerLocation, walletAddress]);

  // calculateDistance removed - distance is already calculated by GeoLink API

  const updateOtherUserMarkers = useCallback((users: Array<{ id: string; location: [number, number]; distance: number }>) => {
    if (!map.current) return;

    // Create a hash of user data to detect actual changes
    const usersHash = JSON.stringify(users.map(u => ({ id: u.id, location: u.location })).sort((a, b) => a.id.localeCompare(b.id)));
    
    // Skip if data hasn't changed
    if (previousUserMarkersRef.current === usersHash && showOtherUsers) {
      return;
    }
    previousUserMarkersRef.current = usersHash;

    if (!showOtherUsers) {
      // Only clear if we're hiding users
      document.querySelectorAll('.other-user-marker').forEach(m => m.remove());
      if (map.current && map.current.isStyleLoaded()) {
        userCirclesRef.current.forEach((sourceId) => {
          const layerId = `${sourceId}-layer`;
          if (map.current!.getLayer(layerId)) {
            map.current!.removeLayer(layerId);
          }
          if (map.current!.getSource(sourceId)) {
            map.current!.removeSource(sourceId);
          }
        });
      }
      userCirclesRef.current = [];
      return;
    }

    // Batch marker updates to prevent flickering - clear and re-add in one operation
    // Remove existing markers
    document.querySelectorAll('.other-user-marker').forEach(m => m.remove());
    
    // Clear existing user radius circles
    if (map.current && map.current.isStyleLoaded()) {
      userCirclesRef.current.forEach((sourceId) => {
        const layerId = `${sourceId}-layer`;
        if (map.current!.getLayer(layerId)) {
          map.current!.removeLayer(layerId);
        }
        if (map.current!.getSource(sourceId)) {
          map.current!.removeSource(sourceId);
        }
      });
    }
    userCirclesRef.current = [];

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
        if (!mapFilters.showUsers) return; // Skip if users filter is off
        
        const el = document.createElement('div');
        el.className = 'marker marker-opponent other-user-marker';
        el.innerHTML = `<div class="marker-distance">${user.distance.toFixed(1)} km</div>`;
        // Match contract marker CSS to prevent movement on zoom
        // Override position: relative from .marker class with flex properties
        // Important: Keep position: relative for marker-distance positioning, but add flex for centering
        // Fix marker positioning - Mapbox markers need proper centering
        el.style.cssText = `
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          width: 24px;
          height: 24px;
          transform: translate(-50%, -50%);
          pointer-events: auto;
        `;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedMarker({
            type: 'opponent',
            location: user.location,
            userId: user.id,
            distance: user.distance,
            publicKey: (user as any).publicKey,
          });
        });
        
        try {
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(user.location)
            .addTo(map.current!);
          
          marker.getElement().setAttribute('data-user-id', user.id);
          
          // Add radius circle for user (use fixed visible radius - 2000m for better visibility)
          // Note: user.distance is the distance from current user, not the user's radius
          // Using a fixed radius makes circles visible on the map
          const radiusMeters = 2000; // 2km radius for visibility
          const sourceId = `user-radius-${user.id || Math.random()}`;
          const layerId = `${sourceId}-layer`;
          
          // Convert radius from meters to degrees (approximate)
          const radiusInDegrees = radiusMeters / 111000;
          const circlePoints: [number, number][] = Array.from({ length: 32 }, (_, i) => {
            const angle = (i / 32) * 2 * Math.PI;
            const x = user.location[0] + radiusInDegrees * Math.cos(angle);
            const y = user.location[1] + radiusInDegrees * Math.sin(angle);
            return [x, y] as [number, number];
          });
          
          const circle: GeoJSON.Feature<GeoJSON.Polygon> = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [circlePoints]
            },
            properties: {}
          };
          
          // Add circle to map
          const addUserCircle = () => {
            if (!map.current) return;
            try {
              if (map.current.getSource(sourceId)) return;
              map.current.addSource(sourceId, { type: 'geojson', data: circle });
              map.current.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                paint: {
                  'line-color': '#4CAF50',
                  'line-width': 2,
                  'line-opacity': 0.5,
                  'line-dasharray': [2, 2] // Dotted line
                }
              });
              userCirclesRef.current.push(sourceId);
            } catch (error) {
              console.error(`[App] Error adding user radius circle:`, error);
            }
          };
          
          if (!map.current) return; // Safety check
          if (!map.current.isStyleLoaded()) {
            map.current.once('style.load', addUserCircle);
          } else {
            addUserCircle();
          }
        } catch (error) {
          console.error('[App] Failed to add other-user marker:', error);
        }
      });
    };

    addMarkers();
  }, [showOtherUsers, mapFilters.showUsers]);

  // Render NFT markers on the map (matching xyz-wallet pattern)
  const renderNFTMarkers = useCallback(() => {
    if (!map.current) return;
    
    console.log('[App] renderNFTMarkers called with', nearbyNFTs.length, 'NFTs');
    
    // Ensure map is fully loaded and style is loaded before adding markers
    if (!map.current.loaded() || !map.current.isStyleLoaded()) {
      console.log('[App] renderNFTMarkers: Map not fully ready, waiting...', {
        loaded: map.current.loaded(),
        styleLoaded: map.current.isStyleLoaded()
      });
      if (!map.current.loaded()) {
        map.current.once('load', renderNFTMarkers);
      } else {
        map.current.once('style.load', renderNFTMarkers);
      }
      return;
    }
    
    // Clear existing NFT markers
    nftMarkersRef.current.forEach(marker => marker.remove());
    nftMarkersRef.current = [];
    
    // Clear existing NFT radius circles
    if (map.current.isStyleLoaded()) {
      nftCirclesRef.current.forEach((sourceId) => {
        const layerId = `${sourceId}-layer`;
        if (map.current!.getLayer(layerId)) {
          map.current!.removeLayer(layerId);
        }
        if (map.current!.getSource(sourceId)) {
          map.current!.removeSource(sourceId);
        }
      });
    }
    nftCirclesRef.current = [];
    
    console.log('[App] Adding', nearbyNFTs.length, 'NFT markers to map');
    
    // Add markers for nearby NFTs
    nearbyNFTs.forEach((nft) => {
      if (!mapFilters.showNFTs) return; // Skip if NFTs filter is off
      if (nft.latitude && nft.longitude) {
        // Construct image URL using the helper function (matching xyz-wallet)
        const imageUrl = constructImageUrl(nft.server_url, nft.ipfs_hash) || nft.image_url || 'https://via.placeholder.com/64x64?text=NFT';
        
        const el = document.createElement('div');
        el.className = 'nft-marker';
        // Use background-image like xyz-wallet for better styling control
        // Match contract marker CSS to prevent movement on zoom
        el.style.cssText = `
          width: 64px;
          height: 64px;
          background-image: url('${imageUrl}');
          background-size: cover;
          background-repeat: no-repeat;
          background-position: center;
          border-radius: 8px;
          border: 3px solid #FFD700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          transform: translate(-50%, -50%);
          pointer-events: auto;
        `;
        // Add fallback if image fails to load
        const img = new Image();
        img.onerror = () => {
          el.style.backgroundImage = 'url(https://via.placeholder.com/64x64?text=NFT)';
        };
        img.src = imageUrl;
        el.title = nft.collection_name || nft.name || 'NFT';
        
        try {
          const nftMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([nft.longitude, nft.latitude])
            .addTo(map.current!);
          
          // Add click event to show NFT info
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[App] NFT marker clicked:', nft);
            setSelectedMarker({
              type: 'nft',
              location: [nft.longitude, nft.latitude],
              nft: nft,
            });
          });
          
          nftMarkersRef.current.push(nftMarker);
          console.log('[App] Added NFT marker at', [nft.longitude, nft.latitude]);
        } catch (error) {
          console.error('[App] Failed to add NFT marker:', error, nft);
        }
        
        // Add radius circle for NFT (use fixed visible radius - 1000m for better visibility)
        // Note: nft.distance is the distance from user, not the NFT's radius
        // Using a fixed radius makes circles visible on the map
        const radiusMeters = 1000; // 1km radius for visibility
        const sourceId = `nft-radius-${nft.id || Math.random()}`;
        const layerId = `${sourceId}-layer`;
        
        // Convert radius from meters to degrees (approximate)
        const radiusInDegrees = radiusMeters / 111000;
        const circlePoints: [number, number][] = Array.from({ length: 32 }, (_, i) => {
          const angle = (i / 32) * 2 * Math.PI;
          const x = nft.longitude + radiusInDegrees * Math.cos(angle);
          const y = nft.latitude + radiusInDegrees * Math.sin(angle);
          return [x, y] as [number, number];
        });
        
        const circle: GeoJSON.Feature<GeoJSON.Polygon> = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [circlePoints]
          },
          properties: {}
        };
        
        // Add circle to map
        if (!map.current) return;
        
        const addNFTCircle = () => {
          if (!map.current) return;
          try {
            if (map.current.getSource(sourceId)) return;
            map.current.addSource(sourceId, { type: 'geojson', data: circle });
            map.current.addLayer({
              id: layerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': '#FFD700',
                'line-width': 2,
                'line-opacity': 0.5,
                'line-dasharray': [2, 2] // Dotted line
              }
            });
            nftCirclesRef.current.push(sourceId);
          } catch (error) {
            console.error(`[App] Error adding NFT radius circle:`, error);
          }
        };
        
        if (!map.current.isStyleLoaded()) {
          map.current.once('style.load', addNFTCircle);
        } else {
          addNFTCircle();
        }
      }
    });
  }, [nearbyNFTs, mapFilters.showNFTs]);

  // Update NFT markers when nearbyNFTs changes
  useEffect(() => {
    // Use a small timeout to batch updates and prevent flickering
    const timeoutId = setTimeout(() => {
      if (!map.current) {
        console.log('[App] Map not ready for NFT markers yet');
        return;
      }
      
      if (nearbyNFTs.length > 0) {
        console.log('[App] Rendering', nearbyNFTs.length, 'NFT markers');
        renderNFTMarkers();
      } else {
        // Clear markers when no NFTs
        nftMarkersRef.current.forEach(marker => marker.remove());
        nftMarkersRef.current = [];
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [nearbyNFTs, renderNFTMarkers]);

  // Render contract markers on the map (matching xyz-wallet pattern)
  const renderContractMarkers = useCallback(() => {
    if (!map.current) {
      console.log('[App] renderContractMarkers: map.current is null');
      return;
    }
    
    console.log('[App] renderContractMarkers called with', nearbyContracts.length, 'contracts', {
      mapLoaded: map.current.loaded(),
      mapStyleLoaded: map.current.isStyleLoaded()
    });
    
    // Clear existing contract markers (batch with re-adding to prevent flickering)
    contractMarkersRef.current.forEach(marker => marker.remove());
    contractMarkersRef.current = [];
    
    // Clear existing contract radius circles
    if (map.current.isStyleLoaded()) {
      contractCirclesRef.current.forEach((sourceId) => {
        const layerId = `${sourceId}-layer`;
        if (map.current!.getLayer(layerId)) {
          map.current!.removeLayer(layerId);
        }
        if (map.current!.getSource(sourceId)) {
          map.current!.removeSource(sourceId);
        }
      });
    }
    contractCirclesRef.current = [];
    
    // Ensure map is fully loaded and style is loaded before adding markers
    if (!map.current.loaded() || !map.current.isStyleLoaded()) {
      console.log('[App] renderContractMarkers: Map not fully ready, waiting...', {
        loaded: map.current.loaded(),
        styleLoaded: map.current.isStyleLoaded()
      });
      if (!map.current.loaded()) {
        map.current.once('load', renderContractMarkers);
      } else {
        map.current.once('style.load', renderContractMarkers);
      }
      return;
    }
    
    // Add markers for nearby contracts
    let markersAdded = 0;
    let invalidCoords = 0;
    console.log('[App] Processing', nearbyContracts.length, 'contracts for markers');
    
    nearbyContracts.forEach((contract, index) => {
      if (!mapFilters.showContracts) return; // Skip if contracts filter is off
      
      // Validate coordinates
      const lat = typeof contract.latitude === 'number' ? contract.latitude : parseFloat(String(contract.latitude || ''));
      const lng = typeof contract.longitude === 'number' ? contract.longitude : parseFloat(String(contract.longitude || ''));
      
      console.log(`[App] Contract ${index}:`, {
        name: contract.name,
        rawLat: contract.latitude,
        rawLng: contract.longitude,
        parsedLat: lat,
        parsedLng: lng,
        isValid: !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
      });
      
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        try {
          // Create contract marker element with different styling (blue/purple) - square shape (matching xyz-wallet)
          const el = document.createElement('div');
          el.className = 'contract-marker';
          el.style.cssText = `
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            border-radius: 8px;
            border: 3px solid #a78bfa;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            color: white;
            position: absolute;
            transform: translate(-50%, -50%);
            pointer-events: auto;
          `;
          el.innerHTML = '🧮';
          el.title = contract.name || 'Smart Contract';
          
          const contractMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          
          // Add click event to show contract info
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[App] Contract marker clicked:', contract);
            setSelectedMarker({
              type: 'contract',
              location: [lng, lat],
              contract: contract,
            });
          });
          
          contractMarkersRef.current.push(contractMarker);
          markersAdded++;
          
          // Add radius circle for contract (use fixed visible radius if radius_meters not available)
          // Use contract's radius_meters if available, otherwise use default 2000m for visibility
          const contractRadiusMeters = (contract as any).radius_meters || 2000;
          if (contractRadiusMeters) {
            const sourceId = `contract-radius-${index}`;
            const layerId = `${sourceId}-layer`;
            
            // Convert radius from meters to degrees (approximate)
            const radiusInDegrees = contractRadiusMeters / 111000;
            const circlePoints: [number, number][] = Array.from({ length: 32 }, (_, i) => {
              const angle = (i / 32) * 2 * Math.PI;
              const x = lng + radiusInDegrees * Math.cos(angle);
              const y = lat + radiusInDegrees * Math.sin(angle);
              return [x, y] as [number, number];
            });
            
            const circle: GeoJSON.Feature<GeoJSON.Polygon> = {
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [circlePoints]
              },
              properties: {}
            };
            
            // Check if style is loaded before adding source
            if (!map.current) return; // Safety check
            
            if (!map.current.isStyleLoaded()) {
              map.current.once('style.load', () => {
                if (!map.current) return; // Safety check
                try {
                  if (map.current.getSource(sourceId)) return;
                  map.current.addSource(sourceId, { type: 'geojson', data: circle });
                  map.current.addLayer({
                    id: layerId,
                    type: 'line',
                    source: sourceId,
                    paint: {
                      'line-color': '#8b5cf6',
                      'line-width': 2,
                      'line-opacity': 0.6,
                      'line-dasharray': [2, 2] // Dotted line
                    }
                  });
                  contractCirclesRef.current.push(sourceId);
                } catch (error) {
                  console.error(`[App] Error adding contract radius circle:`, error);
                }
              });
            } else {
              try {
                if (!map.current) return; // Safety check
                if (map.current.getSource(sourceId)) return;
                map.current.addSource(sourceId, { type: 'geojson', data: circle });
                map.current.addLayer({
                  id: layerId,
                  type: 'line',
                  source: sourceId,
                  paint: {
                    'line-color': '#8b5cf6',
                    'line-width': 2,
                    'line-opacity': 0.6,
                    'line-dasharray': [2, 2] // Dotted line
                  }
                });
                contractCirclesRef.current.push(sourceId);
              } catch (error) {
                console.error(`[App] Error adding contract radius circle:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`[App] Error adding contract marker ${index}:`, error, contract);
        }
      } else {
        invalidCoords++;
        console.warn(`[App] Invalid coordinates for contract ${index}:`, { lat, lng, contract });
      }
    });
    
    console.log(`[App] Contract markers summary:`, {
      total: nearbyContracts.length,
      added: markersAdded,
      invalidCoords: invalidCoords,
      mapLoaded: map.current ? map.current.loaded() : false,
      mapStyleLoaded: map.current ? map.current.isStyleLoaded() : false
    });
  }, [nearbyContracts, mapFilters.showContracts]);

  // Update contract markers when nearbyContracts changes - use same batching pattern as NFTs
  useEffect(() => {
    // Use a small timeout to batch updates and prevent flickering
    const timeoutId = setTimeout(() => {
      if (!map.current) {
        console.log('[App] Map not ready for contract markers yet');
        return;
      }
      
      // Create a hash of contract data to detect actual changes
      const contractsHash = JSON.stringify(nearbyContracts.map(c => ({ 
        name: c.name, 
        latitude: c.latitude, 
        longitude: c.longitude 
      })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      
      // Skip if data hasn't changed
      if (previousContractMarkersRef.current === contractsHash) {
        return;
      }
      previousContractMarkersRef.current = contractsHash;
      
      if (nearbyContracts.length > 0) {
        console.log('[App] Rendering', nearbyContracts.length, 'contract markers');
        // Ensure map is ready before rendering
        if (map.current && map.current.loaded() && map.current.isStyleLoaded()) {
          renderContractMarkers();
        } else {
          console.log('[App] Map not ready for contract markers, will retry when ready');
          // Wait for map to be ready
          const waitForMap = () => {
            if (map.current && map.current.loaded() && map.current.isStyleLoaded()) {
              renderContractMarkers();
            } else if (map.current) {
              setTimeout(waitForMap, 100);
            }
          };
          waitForMap();
        }
      } else {
        // Clear markers when no contracts
        contractMarkersRef.current.forEach(marker => marker.remove());
        contractMarkersRef.current = [];
        // Clear circles
        if (map.current && map.current.isStyleLoaded()) {
          contractCirclesRef.current.forEach((sourceId) => {
            const layerId = `${sourceId}-layer`;
            if (map.current!.getLayer(layerId)) {
              map.current!.removeLayer(layerId);
            }
            if (map.current!.getSource(sourceId)) {
              map.current!.removeSource(sourceId);
            }
          });
        }
        contractCirclesRef.current = [];
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [nearbyContracts, renderContractMarkers, mapFilters.showContracts]);

  const fetchOtherUsers = useCallback(async (playerLoc: [number, number]) => {
    if (!showOtherUsers || !playerLoc) return;
    
    try {
      // Get users from active sessions (like xyz-wallet gets from their backend)
      // This shows other players who are in active sessions
      const sessionUsers: Array<{
        id: string;
        location: [number, number];
        distance: number;
        publicKey: string;
        sessionId: number;
        sessionState: string;
      }> = [];
      
      // Get users from active sessions
      for (const session of activeSessions) {
        if (session.player1 && session.player1 !== walletAddress) {
          // Get location from session cell_id if available, or use approximate location
          // For now, we'll use the player's current location as approximation
          // In future, we could store actual locations in session or fetch from GeoLink
          const distance = 0; // Will be calculated if we have actual locations
          sessionUsers.push({
            id: session.player1,
            location: playerLoc, // Placeholder - would need actual location from GeoLink or session
            distance,
            publicKey: session.player1,
            sessionId: session.sessionId,
            sessionState: session.state,
          });
        }
        if (session.player2 && session.player2 !== walletAddress) {
          const distance = 0;
          sessionUsers.push({
            id: session.player2,
            location: playerLoc, // Placeholder
            distance,
            publicKey: session.player2,
            sessionId: session.sessionId,
            sessionState: session.state,
          });
        }
      }
      
      // Note: GeoLink API does not have a nearby users endpoint
      // We handle nearby users ourselves based on active sessions
      // Location updates are sent to GeoLink, but we discover users via sessions
      
      // Use session-based users (already calculated above)
      setOtherUsers(sessionUsers);
      
      // Update markers on map - debounced to prevent flickering
      // Use setTimeout to batch the update (similar to NFT markers)
      setTimeout(() => {
        updateOtherUserMarkers(sessionUsers);
      }, 0);
      
      // Also fetch nearby NFTs and contracts
      const [nfts, contracts] = await Promise.all([
        geolinkApi.getNearbyNFTs(playerLoc[1], playerLoc[0], maxDistance * 1000).catch((err) => {
          console.warn('[App] Failed to fetch nearby NFTs:', err);
          return [];
        }),
        geolinkApi.getNearbyContracts(playerLoc[1], playerLoc[0], maxDistance * 1000).catch((err) => {
          console.warn('[App] Failed to fetch nearby contracts:', err);
          return [];
        }),
      ]);
      
      console.log('[App] Fetched nearby entities:', { nfts: nfts.length, contracts: contracts.length });
      if (contracts.length > 0) {
        console.log('[App] Nearby contracts:', contracts);
        // Log first contract structure for debugging
        console.log('[App] First contract structure:', {
          name: contracts[0].name,
          latitude: contracts[0].latitude,
          longitude: contracts[0].longitude,
          latType: typeof contracts[0].latitude,
          lngType: typeof contracts[0].longitude,
          fullContract: contracts[0]
        });
      } else {
        console.log('[App] No contracts fetched from GeoLink API');
      }
      
      setNearbyNFTs(nfts);
      setNearbyContracts(contracts);
      
      console.log('[App] Fetched nearby users:', { 
        fromSessions: sessionUsers.length,
        total: sessionUsers.length,
        nfts: nfts.length, 
        contracts: contracts.length 
      });
      
      // Markers are already updated above with setTimeout debouncing
    } catch (error) {
      console.error('[App] Failed to fetch nearby users:', error);
      // Fallback to empty array on error
      setOtherUsers([]);
    }
  }, [showOtherUsers, maxDistance, updateOtherUserMarkers, activeSessions, walletAddress]);

  // Fetch nearby users, NFTs, and contracts when location changes or active sessions update
  // Debounce to prevent flickering
  useEffect(() => {
    if (playerLocation && showOtherUsers) {
      // Clear existing timeout
      if (markerUpdateTimeoutRef.current) {
        clearTimeout(markerUpdateTimeoutRef.current);
      }
      
      // Debounce marker updates (500ms delay)
      const now = Date.now();
      const timeSinceLastUpdate = now - lastMarkerUpdateRef.current;
      const delay = timeSinceLastUpdate < 500 ? 500 - timeSinceLastUpdate : 0;
      
      markerUpdateTimeoutRef.current = setTimeout(() => {
        lastMarkerUpdateRef.current = Date.now();
        fetchOtherUsers(playerLocation);
      }, delay);
      
      return () => {
        if (markerUpdateTimeoutRef.current) {
          clearTimeout(markerUpdateTimeoutRef.current);
        }
      };
    }
  }, [playerLocation, showOtherUsers, fetchOtherUsers, activeSessions]);
  
  // Monitor session state changes to detect when sessions end (end_game was called)
  useEffect(() => {
    if (!readOnlyClient || !userCurrentSession) return;
    
    const checkSessionState = async () => {
      try {
        const session = await readOnlyClient.getSession(userCurrentSession);
        if (!session || session.state === 'Ended') {
          console.log('[App] Session ended or not found - end_game was called on Game Hub:', userCurrentSession);
          // Session has ended, clear user session state
          setUserCurrentSession(null);
          setSessionLink('');
          // Refresh sessions to update UI
          await fetchActiveSessions();
        }
      } catch (error) {
        // Session might not exist anymore
        console.log('[App] Could not check session state:', error);
      }
    };
    
    // Check session state periodically
    const interval = setInterval(checkSessionState, 10000); // Check every 10 seconds
    
    return () => clearInterval(interval);
  }, [readOnlyClient, userCurrentSession, fetchActiveSessions]);
  
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
        // Check if user is in any active session (exclude Ended sessions and sessions user explicitly ended)
        for (const session of activeSessions) {
          if ((session.player1 === publicKey || session.player2 === publicKey) && 
              (session.state === 'Waiting' || session.state === 'Active')) {
            // Skip if user explicitly ended this session
            if (endedSessionsRef.current.has(session.sessionId)) {
              console.log('[App] Skipping session', session.sessionId, '- user explicitly ended it');
              continue;
            }
            
            // Double-check session state from contract to ensure it's not ended
            try {
              const contractSession = await readOnlyClient?.getSession(session.sessionId);
              if (contractSession && contractSession.state === 'Ended') {
                console.log('[App] Session', session.sessionId, 'is ended, clearing user session');
                setUserCurrentSession(null);
                endedSessionsRef.current.add(session.sessionId);
                continue;
              }
            } catch (error) {
              console.warn('[App] Could not verify session state from contract:', error);
            }
            
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
  }, [wallet, contractClient, activeSessions, readOnlyClient]);

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
            if (address) {
              setWallet(w);
              setWalletAddress(address);
              const client = new ContractClient(w);
              setContractClient(client);
              console.log('[App] Wallet restored successfully:', address);
            }
          } catch (error: any) {
            // If silent restore fails, user will need to reconnect manually
            console.log('[App] Silent wallet restore failed, user will need to reconnect:', error);
            // Clear invalid connection state
            if (typeof window !== 'undefined') {
              localStorage.removeItem('geotrust_wallet_connected');
              localStorage.removeItem('geotrust_wallet_address');
            }
          }
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
  // But only if user is not already in a session and there's no pending session join
  const hasCheckedIn = useRef(false);
  useEffect(() => {
    if (wallet && contractClient && !playerLocation && !isCheckingIn && !hasCheckedIn.current && 
        userCurrentSession === null && pendingSessionJoin === null) {
      // Wait a bit for active sessions to load before auto-checkin
      const timer = setTimeout(() => {
        if (userCurrentSession === null && pendingSessionJoin === null) {
          hasCheckedIn.current = true;
          autoCheckIn();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, contractClient, userCurrentSession, pendingSessionJoin]);

  // Handle pending session join from URL parameter
  // Wait for wallet to be fully connected before attempting to join
  useEffect(() => {
    if (pendingSessionJoin && wallet && contractClient && walletAddress && !isCheckingIn) {
      const joinPendingSession = async () => {
        try {
          console.log('[App] Auto-joining session from URL:', pendingSessionJoin);
          // Small delay to ensure everything is ready
          await new Promise(resolve => setTimeout(resolve, 500));
          await handleJoinSession(pendingSessionJoin);
          setPendingSessionJoin(null);
        } catch (error: any) {
          console.error('[App] Failed to auto-join session:', error);
          // Don't show alert if user rejected - that's expected
          if (!error.message?.includes('rejected') && !error.message?.includes('denied')) {
            alert(`Failed to join session ${pendingSessionJoin}: ${error.message || error}`);
          }
          setPendingSessionJoin(null);
        }
      };
      joinPendingSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSessionJoin, wallet, contractClient, walletAddress]);


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
  
  // Store connectWallet in ref so it can be accessed in updateSessionMarkers
  connectWalletRef.current = connectWallet;

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

          // Update location to GeoLink API
          if (walletAddress) {
            try {
              await geolinkApi.updateLocation({
                public_key: walletAddress,
                blockchain: 'stellar',
                latitude,
                longitude,
                description: 'GeoTrust Match Player',
              });
              console.log('[App] Location updated to GeoLink API');
            } catch (error) {
              console.warn('[App] Failed to update location to GeoLink:', error);
            }
          }

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

          // Get country code and find/join existing session or create new one
          const countryCode = await getCountryCode(longitude, latitude);
          if (countryCode && contractClient) {
            try {
              // Final check before joining/creating session
              if (userCurrentSession !== null) {
                console.log('[App] User joined a session while processing - skipping');
                setIsCheckingIn(false);
                return;
              }

              const cellId = calculateCellId(latitude, longitude);
              const assetTag = await getAssetTag();
              
              // First, try to find and join an existing Waiting session
              let sessionId: number | null = null;
              let joinedExisting = false;
              
              // Fetch active sessions to find a Waiting one
              // Use readOnlyClient to avoid sequence number issues
              if (readOnlyClient) {
                try {
                  // Poll recent sessions to find a Waiting one
                  for (let checkId = 1; checkId <= 200; checkId++) {
                    try {
                      const session = await readOnlyClient.getSession(checkId);
                      if (session && session.state === 'Waiting') {
                        // Check if user is already in this session
                        if (session.player1 === walletAddress || session.player2 === walletAddress) {
                          continue;
                        }
                        // Check if session has space (not full)
                        if (session.player1 && session.player2) {
                          continue; // Session is full
                        }
                        
                        // Found a waiting session to join!
                        sessionId = checkId;
                        console.log('[App] Found waiting session, joining:', sessionId);
                        
                        try {
                          await contractClient.joinSession(
                            sessionId, 
                            cellId, 
                            assetTag, 
                            countryCode
                          );
                          joinedExisting = true;
                          console.log('[App] ✅ Joined existing session:', sessionId);
                          
                          // Track this session ID for future polling
                          if (sessionId) {
                            knownActiveSessionIdsRef.current.add(sessionId);
                            maxSessionIdSeenRef.current = Math.max(maxSessionIdSeenRef.current, sessionId);
                          }
                          
                          // If this was the 2nd player, start_game should have been called by the contract
                          if (session.player1) {
                            console.log('[App] This was the 2nd player - start_game should have been called on Game Hub');
                          }
                          break; // Successfully joined, exit loop
                        } catch (joinError: any) {
                          console.warn('[App] Failed to join session', sessionId, ':', joinError);
                          // Continue searching for another session
                          sessionId = null;
                          continue;
                        }
                      }
                    } catch (error) {
                      // Session doesn't exist or error - continue searching
                      continue;
                    }
                  }
                } catch (error) {
                  console.warn('[App] Error searching for waiting sessions:', error);
                }
              }
              
              // If no waiting session found or join failed, create a new one
              if (!joinedExisting) {
                console.log('[App] No waiting session found, creating new session with:', { cellId, countryCode });
                sessionId = await contractClient.createSession();
                console.log('[App] Session created, ID:', sessionId);
                
                // Track this session ID for future polling
                if (sessionId) {
                  knownActiveSessionIdsRef.current.add(sessionId);
                  maxSessionIdSeenRef.current = Math.max(maxSessionIdSeenRef.current, sessionId);
                }
                
                // Wait for transaction to be included
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                console.log('[App] Joining newly created session:', { sessionId, cellId, countryCode });
                
                await contractClient.joinSession(
                  sessionId, 
                  cellId, 
                  assetTag, 
                  countryCode
                );
                console.log('[App] ✅ Joined newly created session:', sessionId);
              }
              
              if (sessionId) {
                setSessionLink(`${window.location.origin}?session=${sessionId}`);
                
                // Refresh active sessions to update UI
                await fetchActiveSessions();
                
                // Fetch other users after checkin
                fetchOtherUsers([longitude, latitude]);
              }
            } catch (error: any) {
              if (error.message?.includes('rejected') || error.message?.includes('denied')) {
                // User rejected transaction - this is expected, don't show error
                console.log('Transaction rejected by user');
              } else if (error.message?.includes('XDR_PARSING_ERROR') || error.message?.includes('XDR format error')) {
                // XDR parsing errors indicate SDK compatibility issues - log but don't show error to user
                console.warn('[App] Auto-checkin failed due to XDR parsing error - SDK may be incompatible:', error.message);
                // Don't show error to user - they've already been notified about XDR issues during admin check
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

  const checkAdminStatus = async () => {
    if (!contractClient || !wallet) {
      console.log('[App] checkAdminStatus skipped - no contractClient or wallet');
      return;
    }

    try {
      console.log('[App] Checking admin status...');
      let admin: string | null = null;
      let xdrError = false;
      
      try {
        // Use read-only client to avoid Freighter prompts
        const client = readOnlyClient || new ReadOnlyContractClient();
        admin = await client.getAdmin();
      } catch (error: any) {
        // Check if this is an XDR parsing error
        if (error.message?.includes('XDR_PARSING_ERROR')) {
          console.warn('[App] XDR parsing error when checking admin - SDK may be incompatible with contract format');
          xdrError = true;
          alert(
            'Warning: Unable to read contract data due to XDR format mismatch.\n\n' +
            'This usually means:\n' +
            '1. The Stellar SDK version is incompatible with the contract\n' +
            '2. The contract format has changed\n\n' +
            'Please update your dependencies or contact support.\n\n' +
            'The app will continue but some features may not work correctly.'
          );
        } else {
          throw error; // Re-throw other errors
        }
      }
      
      const publicKey = await wallet.getPublicKey();
      console.log('[App] Admin from contract:', admin, typeof admin);
      console.log('[App] Current wallet public key:', publicKey);
      
      // If we got an XDR error, don't try to initialize (it would also fail)
      // Check localStorage for previously verified admin status
      if (xdrError) {
        console.warn('[App] Cannot determine admin status due to XDR parsing error - checking localStorage');
        const stored = localStorage.getItem('geotrust_isAdmin');
        const storedAddress = localStorage.getItem('geotrust_adminAddress');
        if (stored === 'true' && storedAddress === publicKey) {
          console.log('[App] Restoring admin status from localStorage');
          setIsAdmin(true);
          return;
        }
        // If no stored admin status, check if this is a known admin address (hardcoded for XDR error recovery)
        // Known admin address: GDPMUX3X4AXOFWMWW74IOAM4ZM4VHOPJS6ZVXYNENSE447MQSXKJ5OGA
        const knownAdminAddresses = [
          'GDPMUX3X4AXOFWMWW74IOAM4ZM4VHOPJS6ZVXYNENSE447MQSXKJ5OGA',
          'GDJMPSG63NX546H2XSPKFQYIJVM46DCA6MUM2NPEOAZJ7WKY6ZZ64GQM' // Previous admin
        ];
        if (knownAdminAddresses.includes(publicKey)) {
          console.log('[App] Wallet matches known admin address - setting admin status');
          setIsAdmin(true);
          localStorage.setItem('geotrust_isAdmin', 'true');
          localStorage.setItem('geotrust_adminAddress', publicKey);
          return;
        }
        // If no stored admin status and not a known admin, preserve current state
        console.warn('[App] No stored admin status found - preserving current admin status');
        return;
      }
      
      // Normalize admin to string for comparison
      const adminStr = admin ? String(admin) : null;
      
      // Store main admin address for country admin management
      setMainAdminAddress(adminStr);
      
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
            console.log('[App] ✅ Contract initialized successfully');
            // Retry admin check after initialization (wait longer for transaction to settle)
            setTimeout(() => {
              console.log('[App] Re-checking admin status after initialization...');
              checkAdminStatus();
            }, 3000);
          } catch (error: any) {
            console.error('[App] Failed to initialize contract:', error);
            // Check if initialization also failed with XDR error
            if (error.message?.includes('XDR_PARSING_ERROR') || error.message?.includes('XDR format error')) {
              alert(
                'Failed to initialize contract due to XDR format mismatch.\n\n' +
                'This indicates an SDK compatibility issue. Please update your dependencies.'
              );
            } else {
              alert(`Failed to initialize contract: ${error.message || error}`);
            }
          }
        }
        return;
      }
      
      if (adminStr === publicKey) {
        setIsAdmin(true);
        // Store admin status in localStorage for XDR error recovery
        localStorage.setItem('geotrust_isAdmin', 'true');
        localStorage.setItem('geotrust_adminAddress', publicKey);
        console.log('[App] ✅ Admin status confirmed, setting up contracts...');
        
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
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            // Don't log as error for user rejections - this is expected behavior
            if (errorMsg.includes('rejected by user') || errorMsg.includes('Transaction was rejected')) {
              console.log('[App] Verifier setup was cancelled by user - skipping Game Hub to avoid sequence issues');
              verifierRejected = true; // Mark as rejected to skip Game Hub
            } else {
              console.error('[App] Failed to set verifier:', error);
              if (errorMsg.includes('txBadSeq') || errorMsg.includes('already') || errorMsg.includes('set')) {
                console.warn('[App] Verifier may already be set or sequence issue - will retry later');
              } else {
                console.warn('[App] Failed to set verifier (non-critical):', errorMsg);
              }
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
            // Use read-only client to avoid Freighter prompts
            const client = readOnlyClient || new ReadOnlyContractClient();
            const currentGameHub = await client.getGameHub();
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
                // Use read-only client to avoid Freighter prompts
                const client = readOnlyClient || new ReadOnlyContractClient();
                const verifyGameHub = await client.getGameHub();
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
        // Clear stored admin status
        localStorage.removeItem('geotrust_isAdmin');
        localStorage.removeItem('geotrust_adminAddress');
        console.log('[App] ❌ User is not admin. Admin:', admin, 'User:', publicKey);
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
      const policyResult = await (client as any).getCountryPolicy();
      // Check if result is valid array
      if (!Array.isArray(policyResult) || policyResult.length < 2) {
        throw new Error('XDR_PARSING_ERROR:get_country_policy returned invalid result');
      }
      const [defaultAllow, allowedCount] = policyResult;
      setDefaultAllowAll(defaultAllow);

      // Fetch allowed countries with pagination (only if allowedCount is valid)
      if (typeof allowedCount === 'number' && allowedCount > 0) {
        try {
          const pageSize = 100;
          const pages = Math.ceil(allowedCount / pageSize);
          const allAllowed = new Set<number>();

          for (let page = 0; page < pages; page++) {
            const countries = await (client as any).listAllowedCountries(page, pageSize);
            if (Array.isArray(countries)) {
              countries.forEach((code: number) => allAllowed.add(code));
            }
          }

          setAllowedCountries(allAllowed);
        } catch (listError: any) {
          // If listing countries fails, just use empty set
          console.warn('[App] Failed to list allowed countries:', listError);
          setAllowedCountries(new Set());
        }
      } else {
        setAllowedCountries(new Set());
      }
    } catch (error: any) {
      // Check if this is an XDR parsing error
      if (error.message?.includes('XDR_PARSING_ERROR')) {
        console.warn('[App] XDR parsing error when fetching country policy - SDK may be incompatible');
        // Set defaults to allow app to continue
        setDefaultAllowAll(false);
        setAllowedCountries(new Set());
      } else {
        console.error('Failed to fetch country policy:', error);
      }
    }
  };

  // Handle joining a session
  const handleJoinSession = async (sessionId: number) => {
    // Note: Sessions are managed entirely on-chain, not in GeoLink
    
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
            
            // Track this session ID for future polling
            if (sessionId) {
              knownActiveSessionIdsRef.current.add(sessionId);
              maxSessionIdSeenRef.current = Math.max(maxSessionIdSeenRef.current, sessionId);
            }
            
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
    type: 'player' | 'opponent' | 'nft' | 'contract';
    location: [number, number];
    userId?: string;
    publicKey?: string;
    distance?: number;
    sessionId?: number;
    cellId?: number;
    country?: number;
    nft?: NearbyNFT;
    contract?: NearbyContract;
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
      
      {/* Stellar Logo - Top Left Corner, visible only when zoomed out */}
      {mapZoom <= 4 && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 1000,
          pointerEvents: 'none',
          transition: 'opacity 0.3s ease-in-out'
        }}>
          <img 
            src="/images/Stellar_Logo.png" 
            alt="Stellar" 
            style={{ 
              height: '48px', 
              width: 'auto',
              maxWidth: '200px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
            }} 
          />
        </div>
      )}
      
      {/* Map Settings Controller - Top Right */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-end'
      }}>
        {/* Search Button */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          style={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Search Location"
        >
          🔍 Search
        </button>
        
        {/* Settings Button */}
        <button
          onClick={() => setShowMapSettings(!showMapSettings)}
          style={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="Map Settings"
        >
          ⚙️ Settings
        </button>
        
        {/* Search Panel */}
        {showSearch && (
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '300px',
            maxWidth: '400px'
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
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
                }}
                placeholder="Search for a location..."
                style={{
                  flex: 1,
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {searchResults.map((result: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => {
                      const [lng, lat] = result.center;
                      if (map.current) {
                        map.current.flyTo({
                          center: [lng, lat],
                          zoom: 12,
                          duration: 1500
                        });
                      }
                      setShowSearch(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee',
                      fontSize: '13px'
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'white';
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{result.text}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{result.place_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Settings Panel */}
        {showMapSettings && (
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '250px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Map Settings</h3>
              <button
                onClick={() => setShowMapSettings(false)}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Map Style */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>Map Style:</label>
              <select
                value={mapStyle}
                onChange={(e) => {
                  const newStyle = e.target.value;
                  setMapStyle(newStyle);
                  if (map.current) {
                    try {
                      map.current.setStyle(newStyle);
                    } catch (error) {
                      console.error('[App] Error setting map style:', error);
                      // Fallback to default style if error occurs
                      const fallbackStyle = 'mapbox://styles/mapbox/light-v11';
                      map.current.setStyle(fallbackStyle);
                      setMapStyle(fallbackStyle);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              >
                <option value="mapbox://styles/mapbox/satellite-streets-v12">Satellite Streets</option>
                <option value="mapbox://styles/mapbox/streets-v12">Streets</option>
                <option value="mapbox://styles/mapbox/outdoors-v12">Outdoors</option>
                <option value="mapbox://styles/mapbox/light-v11">Light</option>
                <option value="mapbox://styles/mapbox/dark-v11">Dark</option>
              </select>
            </div>
            
            {/* Filters */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>Show Markers:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mapFilters.showUsers}
                    onChange={(e) => setMapFilters({ ...mapFilters, showUsers: e.target.checked })}
                  />
                  Users
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mapFilters.showNFTs}
                    onChange={(e) => setMapFilters({ ...mapFilters, showNFTs: e.target.checked })}
                  />
                  NFTs
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mapFilters.showContracts}
                    onChange={(e) => setMapFilters({ ...mapFilters, showContracts: e.target.checked })}
                  />
                  Smart Contracts
                </label>
              </div>
            </div>
            
            {/* 3D Controls */}
            <div style={{ marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>3D Features:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enable3D}
                    onChange={(e) => {
                      setEnable3D(e.target.checked);
                      if (map.current) {
                        if (e.target.checked) {
                          map.current.easeTo({ pitch: 60, bearing: 0, duration: 1000 });
                          setPitch(60);
                        } else {
                          map.current.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
                          setPitch(0);
                        }
                      }
                    }}
                  />
                  Enable 3D View
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showBuildings}
                    onChange={(e) => {
                      setShowBuildings(e.target.checked);
                      if (map.current && map.current.isStyleLoaded()) {
                        const style = map.current.getStyle();
                        if (style && style.layers) {
                          style.layers.forEach((layer: any) => {
                            if (layer.id && layer.id.includes('building')) {
                              try {
                                map.current!.setLayoutProperty(layer.id, 'visibility', e.target.checked ? 'visible' : 'none');
                              } catch (err) {
                                // Layer might not exist in this style
                              }
                            }
                          });
                        }
                      }
                    }}
                  />
                  Show 3D Buildings
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showTerrain}
                    onChange={(e) => {
                      setShowTerrain(e.target.checked);
                      if (map.current && map.current.isStyleLoaded()) {
                        try {
                          if (e.target.checked) {
                            map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
                          } else {
                            map.current.setTerrain(null);
                          }
                        } catch (err) {
                          console.warn('[App] Terrain not available in this style:', err);
                        }
                      }
                    }}
                  />
                  Show Terrain
                </label>
              </div>
              {enable3D && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px' }}>
                    Pitch: {pitch}°
                    <input
                      type="range"
                      min="0"
                      max="60"
                      value={pitch}
                      onChange={(e) => {
                        const newPitch = parseInt(e.target.value);
                        setPitch(newPitch);
                        if (map.current) {
                          map.current.setPitch(newPitch);
                        }
                      }}
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </label>
                  <label style={{ fontSize: '12px' }}>
                    Bearing: {bearing}°
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={bearing}
                      onChange={(e) => {
                        const newBearing = parseInt(e.target.value);
                        setBearing(newBearing);
                        if (map.current) {
                          map.current.setBearing(newBearing);
                        }
                      }}
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className={`overlay ${overlayMinimized && wallet ? 'minimized' : ''} ${!wallet ? 'no-wallet' : ''}`}>
        <div className="overlay-header">
          {wallet && walletAddress && (
            <div className="wallet-status" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Stellar Logo - Small for mobile/panel */}
                <img 
                  src="/images/stellar-xlm.png" 
                  alt="Stellar" 
                  style={{ 
                    height: '20px', 
                    width: '20px',
                    objectFit: 'contain',
                    flexShrink: 0
                  }} 
                />
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
                        setShowSessionDetailsOverlay(true);
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
                      if (!session || !contractClient) return null;
                      
                      // Check if user is player1 or player2 in this session
                      const isPlayer1 = session.player1 === walletAddress;
                      const isPlayer2 = session.player2 === walletAddress;
                      const isMySession = isPlayer1 || isPlayer2;
                      
                      if (!isMySession) return null;
                      
                      // End Session button - works for both Waiting and Active sessions
                      return (
                        <button 
                          className="primary-button" 
                          onClick={async () => {
                            if (!contractClient || !walletAddress) return;
                            
                            // Show confirmation overlay
                            setConfirmationState({
                              isOpen: true,
                              title: 'End Session',
                              message: `Are you sure you want to end session #${userCurrentSession}? This will call end_game on the Game Hub and resolve the match.`,
                              confirmText: 'End Session',
                              cancelText: 'Cancel',
                              type: 'danger',
                              onConfirm: async () => {
                                setConfirmationState(null);
                                
                                try {
                                  if (session.state === 'Active') {
                                    // For Active sessions, use resolveMatch (which calls end_game)
                                    // resolveMatch checks if players matched (same asset_tag and same/adjacent cell_id)
                                    // and determines the winner, then calls Game Hub's end_game
                                    const result = await contractClient.resolveMatch(userCurrentSession);
                                    
                                    const winnerText = result.winner 
                                      ? `${result.winner.slice(0, 6)}...${result.winner.slice(-4)}`
                                      : 'None';
                                    const matchText = result.matched ? 'Players matched!' : 'No match.';
                                    
                                    setNotificationState({
                                      isOpen: true,
                                      title: 'Session Ended',
                                      message: `${matchText} Winner: ${winnerText}`,
                                      type: 'success',
                                      autoClose: 5000,
                                    });
                                  } else if (session.state === 'Waiting') {
                                    // For Waiting sessions, call Game Hub's end_game directly
                                    // Get Game Hub ID from contract instead of env
                                    let gameHubId: string | null = null;
                                    try {
                                      if (readOnlyClient) {
                                        gameHubId = await readOnlyClient.getGameHub();
                                      } else if (contractClient) {
                                        gameHubId = await contractClient.getGameHub();
                                      }
                                    } catch (error) {
                                      console.warn('[App] Failed to get Game Hub from contract:', error);
                                    }
                                    
                                    // Fallback to env if contract doesn't have it
                                    if (!gameHubId) {
                                      gameHubId = process.env.REACT_APP_GAME_HUB_ID || null;
                                    }
                                    
                                    if (!gameHubId) {
                                      setNotificationState({
                                        isOpen: true,
                                        title: 'Error',
                                        message: 'Game Hub ID not configured. Cannot end waiting session. Please set it in the admin panel.',
                                        type: 'error',
                                        autoClose: 5000,
                                      });
                                      return;
                                    }
                                    
                                    // Call end_game on Game Hub: end_game(session_id: u32, player1_won: bool)
                                    // For waiting sessions, we'll set player1_won based on who is ending it
                                    const player1Won = isPlayer1; // If player1 ends it, player1 wins; if player2 ends it, player1 loses
                                    await contractClient.endGameOnGameHub(gameHubId, userCurrentSession, player1Won);
                                    
                                    setNotificationState({
                                      isOpen: true,
                                      title: 'Session Ended',
                                      message: `Session #${userCurrentSession} ended successfully!`,
                                      type: 'success',
                                      autoClose: 5000,
                                    });
                                  } else {
                                    setNotificationState({
                                      isOpen: true,
                                      title: 'Error',
                                      message: `Cannot end session in ${session.state} state.`,
                                      type: 'error',
                                      autoClose: 5000,
                                    });
                                    return;
                                  }
                                  
                                  // Mark this session as ended so we don't re-add it
                                  endedSessionsRef.current.add(userCurrentSession);
                                  
                                  // Clear current session immediately
                                  setUserCurrentSession(null);
                                  setSessionLink('');
                                  
                                  // Refresh sessions after ending (with multiple attempts to ensure state is updated)
                                  const refreshSessions = async () => {
                                    if (readOnlyClient) {
                                      await fetchActiveSessions();
                                      // Check again after a short delay to ensure session state is updated
                                      setTimeout(async () => {
                                        await fetchActiveSessions();
                                      }, 3000);
                                    }
                                  };
                                  refreshSessions();
                                } catch (error: any) {
                                  console.error('Failed to end session:', error);
                                  setNotificationState({
                                    isOpen: true,
                                    title: 'Error',
                                    message: `Failed to end session: ${error.message || error}`,
                                    type: 'error',
                                    autoClose: 7000,
                                  });
                                }
                              },
                            });
                          }}
                          style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#dc3545', color: '#fff', width: '100%', marginBottom: '8px' }}
                        >
                          {session.state === 'Active' ? 'End Session (Resolve Match)' : 'End Session'}
                        </button>
                      );
                    })()}
                    <button 
                      className="primary-button" 
                      onClick={() => {
                        setShowSessionDetailsOverlay(true);
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
                    walletAddress={walletAddress}
                    mainAdminAddress={mainAdminAddress}
                    onManageCountry={(country) => {
                      setSelectedCountry(country);
                      setShowCountryManagementOverlay(true);
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
            <h3>
              {selectedMarker.type === 'player' ? 'Your Profile' : 
               selectedMarker.type === 'nft' ? 'NFT Details' : 
               selectedMarker.type === 'contract' ? 'Smart Contract' :
               'Player Profile'}
            </h3>
            <div className="marker-popup-content">
              {selectedMarker.type === 'nft' && selectedMarker.nft && (
                <>
                  <div className="marker-popup-field">
                    <label>Collection:</label>
                    <span>{selectedMarker.nft.collection_name || selectedMarker.nft.name || 'Unknown NFT'}</span>
                  </div>
                  {selectedMarker.nft.description && (
                    <div className="marker-popup-field">
                      <label>Description:</label>
                      <span>{selectedMarker.nft.description}</span>
                    </div>
                  )}
                  {selectedMarker.nft.distance && (
                    <div className="marker-popup-field">
                      <label>Distance:</label>
                      <span>{selectedMarker.nft.distance.toFixed(1)}m away</span>
                    </div>
                  )}
                  {(selectedMarker.nft.contract_address || selectedMarker.nft.token_id) && (
                    <div className="marker-popup-field">
                      <label>Contract:</label>
                      <span style={{ fontFamily: 'Courier New', fontSize: '11px', wordBreak: 'break-all' }}>
                        {selectedMarker.nft.contract_address || 'N/A'}
                        {selectedMarker.nft.token_id && ` #${selectedMarker.nft.token_id}`}
                      </span>
                    </div>
                  )}
                  <div className="marker-popup-field" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                    <div style={{ 
                      width: '100%', 
                      height: '200px', 
                      backgroundImage: `url(${constructImageUrl(selectedMarker.nft.server_url, selectedMarker.nft.ipfs_hash) || selectedMarker.nft.image_url || 'https://via.placeholder.com/200x200?text=NFT'})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      borderRadius: '8px',
                      border: '2px solid #FFD700'
                    }} />
                  </div>
                </>
              )}
              {selectedMarker.type === 'contract' && selectedMarker.contract && (
                <>
                  <div className="marker-popup-field">
                    <label>Contract Name:</label>
                    <span>{selectedMarker.contract.name || 'Unknown Contract'}</span>
                  </div>
                  {selectedMarker.contract.description && (
                    <div className="marker-popup-field">
                      <label>Description:</label>
                      <span>{selectedMarker.contract.description}</span>
                    </div>
                  )}
                  <div className="marker-popup-field">
                    <label>Contract Address:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'Courier New', fontSize: '11px', wordBreak: 'break-all' }}>
                        {selectedMarker.contract.contract_address}
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedMarker.contract!.contract_address);
                          alert('Contract address copied to clipboard!');
                        }}
                        title="Copy Contract Address"
                        style={{ fontSize: '12px', padding: '4px 8px', flexShrink: 0 }}
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                  {selectedMarker.contract.distance && (
                    <div className="marker-popup-field">
                      <label>Distance:</label>
                      <span>{selectedMarker.contract.distance.toFixed(1)}m away</span>
                    </div>
                  )}
                  {selectedMarker.contract.functions && selectedMarker.contract.functions.length > 0 && (
                    <div className="marker-popup-field">
                      <label>Functions:</label>
                      <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '11px' }}>
                        {selectedMarker.contract.functions.map((func: any, idx: number) => (
                          <div key={idx} style={{ padding: '4px', backgroundColor: '#f0f0f0', borderRadius: '4px', marginBottom: '2px' }}>
                            {func.name || func}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {selectedMarker.publicKey && selectedMarker.type !== 'nft' && selectedMarker.type !== 'contract' && (
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
                <span>
                  {(() => {
                    // When not logged in, show approximate location only
                    if (!walletAddress && selectedMarker.type === 'opponent') {
                      const lat = typeof selectedMarker.location[1] === 'number' 
                        ? selectedMarker.location[1] 
                        : Number(selectedMarker.location[1]) || 0;
                      const lng = typeof selectedMarker.location[0] === 'number' 
                        ? selectedMarker.location[0] 
                        : Number(selectedMarker.location[0]) || 0;
                      // Round to 1 decimal place for approximate location
                      return `${lat.toFixed(1)}, ${lng.toFixed(1)} (approximate)`;
                    }
                    // When logged in, show exact coordinates
                    const lat = typeof selectedMarker.location[1] === 'number' 
                      ? selectedMarker.location[1] 
                      : Number(selectedMarker.location[1]) || 0;
                    const lng = typeof selectedMarker.location[0] === 'number' 
                      ? selectedMarker.location[0] 
                      : Number(selectedMarker.location[0]) || 0;
                    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
                  })()}
                </span>
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
              {selectedMarker.sessionId && selectedMarker.type === 'opponent' && walletAddress && contractClient && (
                <div className="marker-popup-field" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                  {userCurrentSession === selectedMarker.sessionId ? (
                    <div style={{ padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '4px', textAlign: 'center' }}>
                      <span style={{ color: '#2e7d32', fontWeight: 600 }}>✓ You are in this session</span>
                    </div>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={async () => {
                        // Check if already in this session
                        if (userCurrentSession === selectedMarker.sessionId) {
                          alert('You are already in this session!');
                          return;
                        }
                        
                        if (userCurrentSession !== null) {
                          if (!window.confirm(`You are currently in session #${userCurrentSession}. Switch to session #${selectedMarker.sessionId}?`)) {
                            return;
                          }
                        }
                        if (selectedMarker.sessionId) {
                          try {
                            await handleJoinSession(selectedMarker.sessionId);
                            setSelectedMarker(null); // Close overlay after joining
                          } catch (error: any) {
                            console.error('[App] Failed to join session from marker:', error);
                            alert(`Failed to join session: ${error.message || 'Unknown error'}`);
                          }
                        }
                      }}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      {userCurrentSession !== null ? `Switch to Session #${selectedMarker.sessionId}` : `Join Session #${selectedMarker.sessionId}`}
                    </button>
                  )}
                </div>
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
      
      {/* Confirmation Overlay */}
      {confirmationState && (
        <ConfirmationOverlay
          isOpen={confirmationState.isOpen}
          title={confirmationState.title}
          message={confirmationState.message}
          confirmText={confirmationState.confirmText}
          cancelText={confirmationState.cancelText}
          type={confirmationState.type}
          onConfirm={confirmationState.onConfirm}
          onCancel={() => setConfirmationState(null)}
        />
      )}
      
      {/* Notification Overlay */}
      {notificationState && (
        <NotificationOverlay
          isOpen={notificationState.isOpen}
          title={notificationState.title}
          message={notificationState.message}
          type={notificationState.type}
          autoClose={notificationState.autoClose}
          onClose={() => setNotificationState(null)}
        />
      )}
      
      {/* Session Details Overlay */}
      {showSessionDetailsOverlay && userCurrentSession && (
        <SessionDetailsOverlay
          isOpen={showSessionDetailsOverlay}
          onClose={() => setShowSessionDetailsOverlay(false)}
          currentSession={activeSessions.find(s => s.sessionId === userCurrentSession) || null}
          allSessions={activeSessions}
          walletAddress={walletAddress}
          onJoinSession={async (sessionId: number) => {
            await handleJoinSession(sessionId);
            setNotificationState({
              isOpen: true,
              title: 'Success',
              message: `Successfully joined session #${sessionId}!`,
              type: 'success',
              autoClose: 3000,
            });
          }}
        />
      )}
      
      {/* Country Management Overlay */}
      {showCountryManagementOverlay && selectedCountry && contractClient && (
        <CountryManagementOverlay
          isOpen={showCountryManagementOverlay}
          onClose={() => {
            setShowCountryManagementOverlay(false);
            setSelectedCountry(null);
          }}
          countryCode={selectedCountry.code}
          countryName={selectedCountry.name}
          contractClient={contractClient}
          walletAddress={walletAddress}
          mainAdminAddress={mainAdminAddress}
          isMainAdmin={!!(walletAddress && mainAdminAddress && walletAddress === mainAdminAddress)}
          map={map.current}
        />
      )}
      
      {/* Country Profile Overlay (for non-admins) */}
      {showCountryProfileOverlay && selectedCountry && contractClient && (
        <CountryProfileOverlay
          isOpen={showCountryProfileOverlay}
          onClose={() => {
            setShowCountryProfileOverlay(false);
            setSelectedCountry(null);
          }}
          countryCode={selectedCountry.code}
          countryName={selectedCountry.name}
          contractClient={contractClient}
          walletAddress={walletAddress}
          mainAdminAddress={mainAdminAddress}
          onManageCountry={(country) => {
            setSelectedCountry(country);
            setShowCountryProfileOverlay(false);
            setShowCountryManagementOverlay(true);
          }}
        />
      )}
    </div>
  );
};

export default App;
