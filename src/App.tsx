import React, { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import './App.css';
import { Wallet } from './wallet';
import { ContractClient } from './contract';
import { AdminPanel } from './AdminPanel';
import { GamePanel } from './GamePanel';
import { iso2ToNumeric, iso3ToIso2 } from './countryCodes';

// Set Mapbox access token
const mapboxToken = process.env.REACT_APP_MAPBOX_TOKEN;
if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken;
  console.log('[App] Mapbox token loaded');
} else {
  console.error('[App] Mapbox token not found! Please set REACT_APP_MAPBOX_TOKEN in .env.local');
}

// Removed unused interface

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

  // Define updateCountryOverlay first (used by loadCountryOverlay)
  const updateCountryOverlay = useCallback(() => {
    if (!map.current || !map.current.getSource('countries')) return;

    const source = map.current.getSource('countries') as mapboxgl.GeoJSONSource;
    const data = source._data as GeoJSON.FeatureCollection;

    if (!data || !data.features) return;

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
      feature.properties.allowed = Boolean(allowed);
    });

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

  useEffect(() => {
    // Wait for the ref to be attached to the DOM
    if (!mapContainer.current || map.current) return;
    
    // Get the container and verify it has a style property
    const container = mapContainer.current;
    if (!container || typeof container.style === 'undefined') {
      console.warn('[App] Map container not ready yet');
      return;
    }

    // Check if Mapbox token is available
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (!token) {
      console.error('[App] Mapbox token not found! Check .env.local file');
      return;
    }

    // Ensure map container is visible and properly sized
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
          loadCountryOverlay();
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

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [loadCountryOverlay]);

  useEffect(() => {
    if (map.current && allowedCountries.size > 0) {
      updateCountryOverlay();
    }
  }, [allowedCountries, defaultAllowAll, updateCountryOverlay]);

  // Restore wallet connection on page load
  useEffect(() => {
    const restoreWallet = async () => {
      if (Wallet.wasConnected() && !wallet) {
        try {
          const w = new Wallet();
          await w.connect();
          const address = await w.getPublicKey();
          setWallet(w);
          setWalletAddress(address);
          const client = new ContractClient(w);
          setContractClient(client);
          // Admin check will happen automatically via useEffect when wallet and client are set
        } catch (error) {
          console.log('Failed to restore wallet connection:', error);
          // Clear invalid connection state
          if (typeof window !== 'undefined') {
            localStorage.removeItem('geotrust_wallet_connected');
          }
        }
      }
    };
    restoreWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check admin status when wallet and contract client are ready
  const hasCheckedAdmin = useRef(false);
  useEffect(() => {
    if (wallet && contractClient && !hasCheckedAdmin.current) {
      hasCheckedAdmin.current = true;
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


  const connectWallet = async () => {
    try {
      setWalletError(null);
      const w = new Wallet();
      await w.connect();
      const address = await w.getPublicKey();
      setWallet(w);
      setWalletAddress(address);
      const client = new ContractClient(w);
      setContractClient(client);
      // Admin check will happen automatically via useEffect when wallet and client are set
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      setWalletError(error.message || 'Failed to connect wallet. Please install Freighter extension.');
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
      hasCheckedInRef.current = false;
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const autoCheckIn = async () => {
    if (!navigator.geolocation || !contractClient) return;
    
    setIsCheckingIn(true);
    try {
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

          // Get country code and create session
          const countryCode = await getCountryCode(longitude, latitude);
          if (countryCode && contractClient) {
            try {
              const cellId = calculateCellId(latitude, longitude);
              const assetTag = await getAssetTag();
              console.log('[App] Creating session with:', { cellId, countryCode });
              
              const sessionId = await contractClient.createSession();
              console.log('[App] Session created, ID:', sessionId);
              
              // Additional delay to ensure session is fully persisted (transaction waiting handles most of this)
              // Increased delay to ensure session is available in contract storage
              await new Promise(resolve => setTimeout(resolve, 3000));
              
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
        } catch (error) {
          console.error('Failed to add marker:', error);
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
        if (verifierId) {
          try {
            console.log('[App] ≡ƒöº Setting verifier contract:', verifierId);
            await contractClient.setVerifier(verifierId);
            console.log('[App] Γ£à Verifier contract ID set successfully:', verifierId);
          } catch (error: any) {
            console.error('[App] Γ¥î Failed to set verifier:', error);
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            // Only warn if it's already set, otherwise show error
            if (errorMsg.includes('already') || errorMsg.includes('set')) {
              console.warn('[App] Verifier may already be set');
            } else {
              alert(`Failed to set verifier: ${errorMsg}`);
            }
          }
        } else {
          console.warn('[App] ΓÜá∩╕Å REACT_APP_VERIFIER_ID not set in environment');
        }
        
        // Automatically set Game Hub contract ID if available in env
        const gameHubId = process.env.REACT_APP_GAME_HUB_ID;
        console.log('[App] REACT_APP_GAME_HUB_ID from env:', gameHubId);
        if (gameHubId) {
          try {
            console.log('[App] ≡ƒöº Setting Game Hub contract:', gameHubId);
            await contractClient.setGameHub(gameHubId);
            console.log('[App] Γ£à Game Hub contract ID set successfully:', gameHubId);
          } catch (error: any) {
            console.error('[App] Γ¥î Failed to set Game Hub:', error);
            const errorMsg = error?.message || error?.toString() || 'Unknown error';
            // Only warn if it's already set, otherwise show error
            if (errorMsg.includes('already') || errorMsg.includes('set')) {
              console.warn('[App] Game Hub may already be set');
            } else {
              alert(`Failed to set Game Hub: ${errorMsg}`);
            }
          }
        } else {
          console.warn('[App] ΓÜá∩╕Å REACT_APP_GAME_HUB_ID not set in environment');
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
    if (!contractClient) return;

    try {
      const [defaultAllow, allowedCount] = await contractClient.getCountryPolicy();
      setDefaultAllowAll(defaultAllow);

      // Fetch allowed countries with pagination
      const pageSize = 100;
      const pages = Math.ceil(allowedCount / pageSize);
      const allAllowed = new Set<number>();

      for (let page = 0; page < pages; page++) {
        const countries = await contractClient.listAllowedCountries(page, pageSize);
        countries.forEach((code: number) => allAllowed.add(code));
      }

      setAllowedCountries(allAllowed);
    } catch (error) {
      console.error('Failed to fetch country policy:', error);
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
    distance?: number;
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

  return (
    <div className="App">
      <div ref={mapContainer} className="map-container" />
      
      <div className={`overlay ${overlayMinimized ? 'minimized' : ''}`}>
        <div className="overlay-header">
          {wallet && walletAddress && (
            <div className="wallet-status">
              <span className="wallet-address">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              {isAdmin && <span className="admin-badge">ADMIN</span>}
            </div>
          )}
          <div className="overlay-controls">
            {wallet && (
              <button className="icon-button" onClick={disconnectWallet} title="Disconnect Wallet">
                ✕
              </button>
            )}
            <button 
              className="icon-button" 
              onClick={() => setOverlayMinimized(!overlayMinimized)} 
              title={overlayMinimized ? "Restore" : "Minimize"}
            >
              {overlayMinimized ? '□' : '−'}
            </button>
          </div>
        </div>
        {!overlayMinimized && (
          <>
            {walletError ? (
              <div className="wallet-error">
                <h3>Wallet Connection Required</h3>
                <p>{walletError}</p>
                <p>
                  <a href="https://freighter.app/" target="_blank" rel="noopener noreferrer">
                    Install Freighter Extension ΓåÆ
                  </a>
                </p>
                <button className="primary-button" onClick={() => setWalletError(null)} style={{ marginTop: '12px' }}>
                  Try Again
                </button>
              </div>
            ) : !wallet ? (
              <button className="primary-button" onClick={connectWallet}>
                {isCheckingIn ? (
                  <>
                    <span className="loading-spinner"></span>
                    Connecting...
                  </>
                ) : (
                  'Connect Wallet'
                )}
              </button>
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
                />
                {isAdmin && (
                  <AdminPanel
                    contractClient={contractClient!}
                    allowedCountries={allowedCountries}
                    defaultAllowAll={defaultAllowAll}
                    onCountryToggle={fetchCountryPolicy}
                    map={map.current}
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
            <button className="marker-popup-close" onClick={() => setSelectedMarker(null)}>├ù</button>
            <h3>{selectedMarker.type === 'player' ? 'Your Profile' : 'Player Profile'}</h3>
            <div className="marker-popup-content">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
