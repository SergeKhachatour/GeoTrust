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
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useWalletProviderKey: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const apiKey = useWalletProviderKey ? this.walletProviderKey : this.dataConsumerKey;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[GeoLinkAPI] Request failed for ${endpoint}:`, error);
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
    
    return this.request('/api/location/update', {
      method: 'POST',
      body: JSON.stringify(data),
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
    const response = await this.request<{ nearbyUsers?: NearbyUser[] }>(
      `/api/location/nearby?lat=${latitude}&lon=${longitude}&radius=${radius}`,
      {},
      false // Use data consumer key
    );
    return response.nearbyUsers || [];
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
      const response = await this.request<{ contracts?: NearbyContract[] }>(
        `/api/contracts/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`,
        {},
        false // Use data consumer key
      );
      return response.contracts || [];
    } catch (error) {
      console.warn('[GeoLinkAPI] Nearby contracts endpoint not available:', error);
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
   */
  async createSession(sessionData: {
    session_id?: string;
    player1: string;
    player2?: string;
    state: 'waiting' | 'active' | 'ended';
    latitude?: number;
    longitude?: number;
  }): Promise<SessionData> {
    return this.request<SessionData>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      return await this.request<SessionData>(`/api/sessions/${sessionId}`);
    } catch (error) {
      console.warn(`[GeoLinkAPI] Failed to get session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(publicKey: string): Promise<SessionData[]> {
    try {
      const response = await this.request<{ sessions?: SessionData[] }>(
        `/api/sessions?user=${publicKey}&state=active,waiting`
      );
      return response.sessions || [];
    } catch (error) {
      console.warn(`[GeoLinkAPI] Failed to get sessions for ${publicKey}:`, error);
      return [];
    }
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
