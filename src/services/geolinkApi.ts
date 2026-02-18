/**
 * GeoLink API Client
 * Integrates with Stellar GeoLink backend APIs for location services,
 * nearby users, NFTs, smart contracts, and session management
 */

const GEOLINK_API_BASE = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
const GEOLINK_WALLET_PROVIDER_KEY = process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY || process.env.REACT_APP_GEOLINK_API_KEY || '';
const GEOLINK_DATA_CONSUMER_KEY = process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY || process.env.REACT_APP_GEOLINK_API_KEY || '';

export interface LocationUpdate {
  public_key: string;
  blockchain: string;
  latitude: number;
  longitude: number;
  wallet_type_id?: number;
  description?: string;
}

export interface NearbyUser {
  public_key: string;
  latitude: number;
  longitude: number;
  distance: number;
  wallet_type?: string;
  description?: string;
  last_updated?: string;
}

export interface NearbyNFT {
  id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  distance: number;
  contract_address?: string;
  token_id?: string;
  image_url?: string;
  server_url?: string;
  ipfs_hash?: string;
  collection_name?: string;
}

export interface NearbyContract {
  id: number;
  name: string;
  contract_address: string;
  latitude: number;
  longitude: number;
  distance: number;
  description?: string;
  functions?: any[];
}

export interface SessionData {
  session_id: string;
  player1: string;
  player2?: string;
  state: 'waiting' | 'active' | 'ended';
  created_at: string;
  updated_at: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

class GeoLinkApiClient {
  private walletProviderKey: string;
  private dataConsumerKey: string;
  private baseUrl: string;

  constructor(walletProviderKey?: string, dataConsumerKey?: string, baseUrl?: string) {
    this.walletProviderKey = walletProviderKey || GEOLINK_WALLET_PROVIDER_KEY;
    this.dataConsumerKey = dataConsumerKey || GEOLINK_DATA_CONSUMER_KEY;
    this.baseUrl = baseUrl || GEOLINK_API_BASE;
    
    // Log API configuration (without exposing keys)
    console.log('[GeoLinkAPI] Initialized:', {
      baseUrl: this.baseUrl,
      hasWalletProviderKey: !!this.walletProviderKey,
      hasDataConsumerKey: !!this.dataConsumerKey,
      walletProviderKeyLength: this.walletProviderKey?.length || 0,
      dataConsumerKeyLength: this.dataConsumerKey?.length || 0,
      // Show first 4 chars and last 4 chars for debugging (safe to log)
      walletProviderKeyPreview: this.walletProviderKey ? 
        `${this.walletProviderKey.substring(0, 4)}...${this.walletProviderKey.substring(this.walletProviderKey.length - 4)}` : 
        'NOT SET',
      dataConsumerKeyPreview: this.dataConsumerKey ? 
        `${this.dataConsumerKey.substring(0, 4)}...${this.dataConsumerKey.substring(this.dataConsumerKey.length - 4)}` : 
        'NOT SET',
      // Check raw env vars at module level
      rawEnvWalletProvider: process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY ? 
        `${process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY.substring(0, 4)}...${process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY.substring(process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY.length - 4)}` : 
        'NOT IN ENV',
      rawEnvDataConsumer: process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY ? 
        `${process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY.substring(0, 4)}...${process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY.substring(process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY.length - 4)}` : 
        'NOT IN ENV',
      // Check raw env vars
      envWalletProviderKeyExists: !!process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY,
      envDataConsumerKeyExists: !!process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY,
      envWalletProviderKeyLength: process.env.REACT_APP_GEOLINK_WALLET_PROVIDER_KEY?.length || 0,
      envDataConsumerKeyLength: process.env.REACT_APP_GEOLINK_DATA_CONSUMER_KEY?.length || 0,
      // Also check if REACT_APP_GEOLINK_API_URL is set
      envApiUrl: process.env.REACT_APP_GEOLINK_API_URL || 'NOT SET',
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useWalletProviderKey: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const apiKey = useWalletProviderKey ? this.walletProviderKey : this.dataConsumerKey;
    
    // Match xyz-wallet pattern exactly - set headers directly in fetch call
    // xyz-wallet uses: headers: { 'X-API-Key': this.walletProviderKey, 'Content-Type': 'application/json' }
    if (!apiKey || apiKey.trim().length === 0) {
      const keyType = useWalletProviderKey ? 'WalletProvider' : 'DataConsumer';
      console.error(`[GeoLinkAPI] No ${keyType} API key available for ${endpoint}`);
      console.error(`[GeoLinkAPI] WalletProviderKey: ${this.walletProviderKey ? 'SET (' + this.walletProviderKey.length + ' chars)' : 'NOT SET'}`);
      console.error(`[GeoLinkAPI] DataConsumerKey: ${this.dataConsumerKey ? 'SET (' + this.dataConsumerKey.length + ' chars)' : 'NOT SET'}`);
      throw new Error(`API key required or invalid`);
    }

    // Build headers exactly like xyz-wallet - set directly without merging
    const headers: Record<string, string> = {
      'X-API-Key': apiKey.trim(),
      'Content-Type': 'application/json',
    };

    // Merge any additional headers from options (but don't override X-API-Key or Content-Type)
    if (options.headers) {
      const additionalHeaders = options.headers as Record<string, string>;
      Object.keys(additionalHeaders).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'x-api-key' && lowerKey !== 'content-type') {
          headers[key] = additionalHeaders[key];
        }
      });
    }

    // Debug logging (similar to xyz-wallet)
    console.log(`[GeoLinkAPI] Request to ${endpoint}:`, {
      url,
      method: options.method || 'GET',
      hasApiKey: true,
      apiKeyLength: apiKey.trim().length,
      apiKeyPreview: `${apiKey.trim().substring(0, 8)}...${apiKey.trim().substring(apiKey.trim().length - 4)}`,
      useWalletProviderKey,
      headersKeys: Object.keys(headers),
    });

    try {
      // Create fetch options - ensure headers are set correctly
      const fetchOptions: RequestInit = {
        ...options,
        headers: headers, // Explicitly set headers (don't merge with options.headers)
      };

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        let errorDetails: any = null;
        try {
          errorDetails = await response.json();
          errorMessage = errorDetails.error || errorDetails.message || errorMessage;
        } catch {
          // If JSON parsing fails, try to get text
          try {
            const text = await response.text();
            if (text) errorMessage = text;
          } catch {
            // If text parsing also fails, use status text
          }
        }
        
        // Log detailed error information
        console.error(`[GeoLinkAPI] Request failed for ${endpoint}:`, {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          errorDetails,
          url,
          method: options.method || 'GET',
          apiKeyLength: apiKey.trim().length,
          apiKeyPreview: `${apiKey.trim().substring(0, 4)}...${apiKey.trim().substring(apiKey.trim().length - 4)}`,
          useWalletProviderKey,
        });
        
        // Special handling for 401 (Unauthorized)
        if (response.status === 401) {
          errorMessage = `API key required or invalid. Check that REACT_APP_GEOLINK_${useWalletProviderKey ? 'WALLET_PROVIDER' : 'DATA_CONSUMER'}_KEY is set correctly.`;
        }
        
        // Special handling for 404 (Not Found)
        if (response.status === 404) {
          errorMessage = `Endpoint not found: ${endpoint}`;
        }
        
        // Special handling for 400 (Bad Request) - may indicate missing parameters
        if (response.status === 400) {
          errorMessage = errorDetails?.error || errorDetails?.message || 'Bad Request - Missing required parameters';
        }
        
        // Create error with status code for caller to handle
        const apiError = new Error(errorMessage);
        (apiError as any).status = response.status;
        throw apiError;
      }

      return await response.json();
    } catch (error: any) {
      // Only log errors that aren't 400/404 (which are expected for some endpoints)
      // Check both error.status and error.message to catch all cases
      const isExpectedError = error.status === 400 || error.status === 404 ||
        error.message?.includes('400') || error.message?.includes('404') ||
        error.message?.includes('not found') || error.message?.includes('Missing required parameters');
      
      if (!isExpectedError) {
        console.error(`[GeoLinkAPI] Request failed for ${endpoint}:`, error);
      }
      throw error;
    }
  }

  /**
   * Update wallet location (uses Wallet Provider key)
   */
  async updateLocation(data: LocationUpdate): Promise<any> {
    console.log('[GeoLinkAPI] Updating location:', {
      public_key: data.public_key.substring(0, 8) + '...',
      latitude: data.latitude,
      longitude: data.longitude,
    });
    
    // Match xyz-wallet format: use 'Stellar' (capital S) for blockchain
    const requestBody = {
      ...data,
      blockchain: 'Stellar', // xyz-wallet uses capital S
    };
    
    return this.request('/api/location/update', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }, true); // Use wallet provider key
  }

  /**
   * Get nearby wallets/users (uses Data Consumer key)
   */
  async getNearbyUsers(
    latitude: number,
    longitude: number,
    radius: number = 10000
  ): Promise<NearbyUser[]> {
    console.log('[GeoLinkAPI] Fetching nearby users:', { latitude, longitude, radius });
    // Match xyz-wallet pattern: use latitude/longitude parameter names
    // Note: GeoLink may not have a nearby users endpoint - this might need to be removed
    // or use a different endpoint like /api/wallets/nearby
    try {
      const response = await this.request<{ nearbyUsers?: NearbyUser[]; users?: NearbyUser[] }>(
        `/api/location/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`,
        {},
        false // Use data consumer key
      );
      return response.nearbyUsers || response.users || [];
    } catch (error: any) {
      // If endpoint doesn't exist (404) or has missing parameters (400), return empty array
      // This is non-critical - the app will use session-based users instead
      if (
        error.status === 400 ||
        error.status === 404 ||
        error.message?.includes('404') || 
        error.message?.includes('not found') ||
        error.message?.includes('400') ||
        error.message?.includes('Missing required parameters') ||
        error.message?.includes('Bad Request')
      ) {
        // Silently return empty array - this endpoint may not be available or may require different parameters
        // The app will use session-based users instead
        // Don't log - this is expected behavior
        return [];
      }
      throw error;
    }
  }

  /**
   * Get nearby NFTs (uses Data Consumer key)
   */
  async getNearbyNFTs(
    latitude: number,
    longitude: number,
    radius: number = 10000
  ): Promise<NearbyNFT[]> {
    console.log('[GeoLinkAPI] Fetching nearby NFTs:', { latitude, longitude, radius });
    const response = await this.request<{ nfts?: NearbyNFT[] }>(
      `/api/nft/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`,
      {},
      false // Use data consumer key
    );
    return response.nfts || [];
  }

  /**
   * Get nearby smart contract markers (uses Data Consumer key)
   */
  async getNearbyContracts(
    latitude: number,
    longitude: number,
    radius: number = 10000
  ): Promise<NearbyContract[]> {
    console.log('[GeoLinkAPI] Fetching nearby contracts:', { latitude, longitude, radius });
    try {
      const response = await this.request<{ contracts?: NearbyContract[]; nearbyContracts?: NearbyContract[] }>(
        `/api/contracts/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`,
        {},
        false // Use data consumer key
      );
      const contracts = response.contracts || response.nearbyContracts || [];
      console.log('[GeoLinkAPI] Fetched', contracts.length, 'nearby contracts');
      return contracts;
    } catch (error: any) {
      // If endpoint doesn't exist (404) or has missing parameters (400), return empty array
      if (
        error.message?.includes('404') || 
        error.message?.includes('not found') ||
        error.message?.includes('400') ||
        error.message?.includes('Missing required parameters') ||
        error.message?.includes('Bad Request')
      ) {
        console.log('[GeoLinkAPI] Nearby contracts endpoint not available or requires different parameters');
        return [];
      }
      console.warn('[GeoLinkAPI] Nearby contracts endpoint error:', error);
      return [];
    }
  }

  /**
   * Get wallet location by public key (uses Data Consumer key)
   */
  async getWalletLocation(publicKey: string): Promise<LocationUpdate | null> {
    try {
      return await this.request<LocationUpdate>(
        `/api/location/${publicKey}`,
        {},
        false // Use data consumer key
      );
    } catch (error) {
      console.warn(`[GeoLinkAPI] Failed to get location for ${publicKey}:`, error);
      return null;
    }
  }

  /**
   * Get wallet location history (uses Wallet Provider key)
   */
  async getWalletLocationHistory(publicKey: string): Promise<any[]> {
    try {
      const response = await this.request<{ history?: any[] }>(
        `/api/locations/history?wallet_address=${publicKey}`,
        {},
        true // Use wallet provider key
      );
      return response.history || [];
    } catch (error) {
      console.warn(`[GeoLinkAPI] Failed to get location history for ${publicKey}:`, error);
      return [];
    }
  }

  /**
   * Update privacy settings (uses Wallet Provider key)
   */
  async updatePrivacySettings(publicKey: string, privacyEnabled: boolean): Promise<any> {
    if (!this.walletProviderKey) {
      throw new Error('Wallet Provider API key is not configured');
    }
    
    const privacyLevel = privacyEnabled ? 'public' : 'private';
    const requestBody = {
      public_key: publicKey,
      privacy_level: privacyLevel,
      location_sharing: privacyEnabled,
    };
    
    console.log('[GeoLinkAPI] Updating privacy settings:', {
      public_key: publicKey.substring(0, 8) + '...',
      privacy_level: privacyLevel,
    });
    
    return this.request('/api/wallet-provider/privacy-settings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }, true); // Use wallet provider key
  }

  /**
   * Update visibility settings (uses Wallet Provider key)
   */
  async updateVisibilitySettings(publicKey: string, isVisible: boolean): Promise<any> {
    if (!this.walletProviderKey) {
      throw new Error('Wallet Provider API key is not configured');
    }
    
    const visibilityLevel = isVisible ? 'public' : 'private';
    const requestBody = {
      public_key: publicKey,
      visibility_level: visibilityLevel,
      show_location: isVisible,
    };
    
    console.log('[GeoLinkAPI] Updating visibility settings:', {
      public_key: publicKey.substring(0, 8) + '...',
      visibility_level: visibilityLevel,
    });
    
    return this.request('/api/wallet-provider/visibility-settings', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }, true); // Use wallet provider key
  }

  /**
   * Create or update session
   * NOTE: GeoLink doesn't have a sessions endpoint - sessions are managed entirely on-chain in GeoTrust
   * This method is kept for API compatibility but does nothing
   */
  async createSession(sessionData: {
    session_id?: string;
    player1: string;
    player2?: string;
    state: 'waiting' | 'active' | 'ended';
    latitude?: number;
    longitude?: number;
  }): Promise<SessionData> {
    // GeoLink doesn't support sessions - return a mock response
    console.log('[GeoLinkAPI] Sessions are managed on-chain, not in GeoLink');
    return {
      session_id: sessionData.session_id || '',
      player1: sessionData.player1,
      player2: sessionData.player2,
      state: sessionData.state,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Get session by ID
   * NOTE: GeoLink doesn't have a sessions endpoint - sessions are managed entirely on-chain in GeoTrust
   * This method is kept for API compatibility but returns null
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    console.log('[GeoLinkAPI] Sessions are managed on-chain, not in GeoLink');
    return null;
  }

  /**
   * Get active sessions for a user
   * NOTE: GeoLink doesn't have a sessions endpoint - sessions are managed entirely on-chain in GeoTrust
   * This method is kept for API compatibility but returns empty array
   */
  async getUserSessions(publicKey: string): Promise<SessionData[]> {
    // GeoLink doesn't support sessions - return empty array
    // Sessions are fetched from the on-chain contract instead
    return [];
  }

  /**
   * Create smart contract rule
   */
  async createContractRule(ruleData: {
    contract_address: string;
    function_name: string;
    conditions: any;
    execution_type: string;
    quorum?: {
      required_signatures: number;
      wallets: string[];
    };
  }): Promise<any> {
    return this.request('/api/contracts/rules', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    });
  }

  /**
   * Get contract rules for a user
   */
  async getContractRules(publicKey: string): Promise<any[]> {
    try {
      const response = await this.request<{ rules?: any[] }>(
        `/api/contracts/rules?user=${publicKey}`
      );
      return response.rules || [];
    } catch (error) {
      console.warn(`[GeoLinkAPI] Failed to get rules for ${publicKey}:`, error);
      return [];
    }
  }

  /**
   * Create multi-wallet quorum rule
   */
  async createQuorumRule(ruleData: {
    name: string;
    required_signatures: number;
    wallets: string[];
    contract_address?: string;
    function_name?: string;
    conditions?: any;
  }): Promise<any> {
    return this.request('/api/smart-wallet/quorum-rules', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    });
  }
}

export const geolinkApi = new GeoLinkApiClient();
