/**
 * GeoLink API Client
 * Integrates with Stellar GeoLink backend APIs for location services,
 * nearby users, NFTs, smart contracts, and session management
 */

const GEOLINK_API_BASE = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
const GEOLINK_API_KEY = process.env.REACT_APP_GEOLINK_API_KEY || '';

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
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || GEOLINK_API_KEY;
    this.baseUrl = baseUrl || GEOLINK_API_BASE;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
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
   * Update wallet location
   */
  async updateLocation(data: LocationUpdate): Promise<any> {
    return this.request('/api/location/update', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get nearby wallets/users
   */
  async getNearbyUsers(
    latitude: number,
    longitude: number,
    radius: number = 10000
  ): Promise<NearbyUser[]> {
    const response = await this.request<{ nearbyUsers?: NearbyUser[] }>(
      `/api/location/nearby?lat=${latitude}&lon=${longitude}&radius=${radius}`
    );
    return response.nearbyUsers || [];
  }

  /**
   * Get nearby NFTs
   */
  async getNearbyNFTs(
    latitude: number,
    longitude: number,
    radius: number = 10000
  ): Promise<NearbyNFT[]> {
    const response = await this.request<{ nfts?: NearbyNFT[] }>(
      `/api/nft/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
    );
    return response.nfts || [];
  }

  /**
   * Get nearby smart contract markers
   */
  async getNearbyContracts(
    latitude: number,
    longitude: number,
    radius: number = 10000
  ): Promise<NearbyContract[]> {
    // This might need to be implemented based on GeoLink's contract location API
    // For now, we'll use the contracts endpoint
    try {
      const contracts = await this.request<NearbyContract[]>(
        `/api/contracts?latitude=${latitude}&longitude=${longitude}&radius=${radius}`
      );
      return contracts || [];
    } catch (error) {
      console.warn('[GeoLinkAPI] Nearby contracts endpoint not available:', error);
      return [];
    }
  }

  /**
   * Get wallet location by public key
   */
  async getWalletLocation(publicKey: string): Promise<LocationUpdate | null> {
    try {
      return await this.request<LocationUpdate>(`/api/location/${publicKey}`);
    } catch (error) {
      console.warn(`[GeoLinkAPI] Failed to get location for ${publicKey}:`, error);
      return null;
    }
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
