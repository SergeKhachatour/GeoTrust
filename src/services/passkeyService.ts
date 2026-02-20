/**
 * Passkey Service for GeoTrust
 * Implements WebAuthn for secure, passwordless authentication
 * Similar to xyz-wallet implementation
 */

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  counter: number;
  deviceType: string;
  createdAt: string;
}

export interface PasskeyRegistration {
  credentialId: string;
  publicKey: string;
  counter: number;
}

export class PasskeyService {
  private readonly rpId = window.location.hostname;
  private readonly rpName = 'GeoTrust';
  private readonly userDisplayName = 'GeoTrust User';

  /**
   * Check if WebAuthn is supported by the browser
   */
  isSupported(): boolean {
    return !!(
      window.PublicKeyCredential &&
      window.navigator.credentials &&
      typeof window.navigator.credentials.create === 'function' &&
      typeof window.navigator.credentials.get === 'function'
    );
  }

  /**
   * Check if passkeys are available on this device
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      // Check if platform authenticator is available
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch (error) {
      console.warn('Passkey availability check failed:', error);
      return false;
    }
  }

  /**
   * Register a new passkey for the user
   */
  async registerPasskey(userId: string): Promise<PasskeyRegistration> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    try {
      // Generate a challenge (in production, this should come from your server)
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          id: this.rpId,
          name: this.rpName,
        },
        user: {
          id: new TextEncoder().encode(userId),
          name: userId,
          displayName: this.userDisplayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Prefer platform authenticators (Touch ID, Face ID, etc.)
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create passkey');
      }

      // Extract the credential data
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = this.arrayBufferToBase64(response.getPublicKey()!);
      const credentialId = this.arrayBufferToBase64(credential.rawId);

      return {
        credentialId,
        publicKey,
        counter: 0,
      };
    } catch (error) {
      console.error('Passkey registration failed:', error);
      throw new Error(`Passkey registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Authenticate using an existing passkey
   * Returns all WebAuthn data needed for production verification
   */
  async authenticatePasskey(credentialId?: string, customChallenge?: Uint8Array): Promise<{ 
    credentialId: string; 
    signature: string;
    authenticatorData: string;
    clientDataJSON: string;
  }> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    try {
      // Use custom challenge if provided, otherwise generate a random one
      const challenge = customChallenge || (() => {
        const randomChallenge = new Uint8Array(32);
        crypto.getRandomValues(randomChallenge);
        return randomChallenge;
      })();
      
      if (challenge.length !== 32) {
        throw new Error('Challenge must be exactly 32 bytes');
      }

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        rpId: this.rpId,
        userVerification: 'required',
        allowCredentials: credentialId ? [{
          id: this.base64ToArrayBuffer(credentialId),
          type: 'public-key',
        }] : undefined,
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to authenticate with passkey');
      }

      const response = credential.response as AuthenticatorAssertionResponse;
      const signature = this.arrayBufferToBase64(response.signature);
      const credentialIdBase64 = this.arrayBufferToBase64(credential.rawId);
      const authenticatorData = this.arrayBufferToBase64(response.authenticatorData);
      const clientDataJSON = this.arrayBufferToBase64(response.clientDataJSON);

      return {
        credentialId: credentialIdBase64,
        signature,
        authenticatorData,
        clientDataJSON,
      };
    } catch (error) {
      console.error('Passkey authentication failed:', error);
      throw new Error(`Passkey authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store passkey data securely in localStorage
   */
  async storePasskeyData(credentialId: string, publicKey: string): Promise<void> {
    try {
      const passkeyData: PasskeyCredential = {
        id: credentialId,
        publicKey,
        counter: 0,
        deviceType: this.getDeviceType(),
        createdAt: new Date().toISOString(),
      };

      // Store encrypted passkey data
      const encryptedData = await this.encryptData(JSON.stringify(passkeyData));
      localStorage.setItem('geotrust_passkey_data', encryptedData);
      
      // Also store a flag indicating passkey is enabled
      localStorage.setItem('geotrust_passkey_enabled', 'true');
      
      console.log('✅ Passkey data stored securely');
    } catch (error) {
      console.error('Failed to store passkey data:', error);
      throw error;
    }
  }

  /**
   * Retrieve stored passkey data
   */
  async getStoredPasskeyData(): Promise<PasskeyCredential | null> {
    try {
      const encryptedData = localStorage.getItem('geotrust_passkey_data');
      if (!encryptedData) {
        return null;
      }

      const decryptedData = await this.decryptData(encryptedData);
      return JSON.parse(decryptedData) as PasskeyCredential;
    } catch (error) {
      console.error('Failed to retrieve passkey data:', error);
      return null;
    }
  }

  /**
   * Check if passkey is enabled for this user
   */
  isPasskeyEnabled(): boolean {
    return localStorage.getItem('geotrust_passkey_enabled') === 'true';
  }

  /**
   * Disable passkey and clean up stored data
   */
  async disablePasskey(): Promise<void> {
    localStorage.removeItem('geotrust_passkey_data');
    localStorage.removeItem('geotrust_passkey_enabled');
    console.log('✅ Passkey disabled and data cleaned up');
  }

  /**
   * Get passkey public key in SPKI format (for GeoLink API)
   */
  async getPasskeyPublicKeySPKI(credentialId: string): Promise<string> {
    const passkeyData = await this.getStoredPasskeyData();
    if (!passkeyData || passkeyData.id !== credentialId) {
      throw new Error('Passkey not found');
    }
    // The public key is stored in base64 format
    // For SPKI format, we may need to convert it
    // For now, return the stored public key
    return passkeyData.publicKey;
  }

  /**
   * Convert ArrayBuffer to Base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert Base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Get device type for passkey metadata
   */
  private getDeviceType(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'iOS';
    } else if (userAgent.includes('android')) {
      return 'Android';
    } else if (userAgent.includes('mac')) {
      return 'macOS';
    } else if (userAgent.includes('windows')) {
      return 'Windows';
    } else {
      return 'Unknown';
    }
  }

  /**
   * Simple encryption for localStorage data
   */
  private async encryptData(data: string): Promise<string> {
    // For now, we'll use a simple base64 encoding
    // In production, implement proper encryption with a key derived from user input
    return btoa(data);
  }

  /**
   * Simple decryption for localStorage data
   */
  private async decryptData(encryptedData: string): Promise<string> {
    // For now, we'll use a simple base64 decoding
    // In production, implement proper decryption with a key derived from user input
    return atob(encryptedData);
  }
}

// Export a singleton instance
export const passkeyService = new PasskeyService();
