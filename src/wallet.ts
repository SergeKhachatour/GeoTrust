import { 
  isConnected, 
  setAllowed, 
  getPublicKey, 
  signTransaction as freighterSignTransaction 
} from '@stellar/freighter-api';

const WALLET_STORAGE_KEY = 'geotrust_wallet_connected';

export class Wallet {
  private freighterAvailable: boolean = false;

  constructor() {
    // Check if Freighter is available
    this.checkFreighterAvailable();
  }

  // Check if wallet was previously connected
  static wasConnected(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(WALLET_STORAGE_KEY) === 'true';
  }

  // Save connection state
  private saveConnectionState(connected: boolean): void {
    if (typeof window === 'undefined') return;
    if (connected) {
      localStorage.setItem(WALLET_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }

  private checkFreighterAvailable(): void {
    if (typeof window !== 'undefined') {
      // Check if Freighter API is available via window object
      this.freighterAvailable = typeof (window as any).freighterApi !== 'undefined';
    }
  }

  private async waitForFreighter(maxAttempts: number = 20): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      this.checkFreighterAvailable();
      if (this.freighterAvailable) {
        return true;
      }
      // Also check if the functions are available (they might be injected differently)
      try {
        // Try to call isConnected - if it works, Freighter is available
        await isConnected();
        this.freighterAvailable = true;
        return true;
      } catch (e) {
        // Not available yet, wait and retry
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }

  async connect(): Promise<void> {
    // Wait for Freighter to be available (it might load asynchronously)
    const isAvailable = await this.waitForFreighter();
    
    if (!isAvailable) {
      throw new Error('Freighter wallet not found. Please install Freighter extension from https://freighter.app and refresh the page.');
    }

    try {
      // Check if Freighter is connected
      const connected = await isConnected();
      if (!connected) {
        // Request permission to connect
        await setAllowed();
      }
      this.saveConnectionState(true);
    } catch (error: any) {
      // If setAllowed fails, try to get public key directly (this will prompt if needed)
      try {
        await getPublicKey();
        this.saveConnectionState(true);
      } catch (e: any) {
        this.saveConnectionState(false);
        const errorMsg = e?.message || e?.toString() || 'Unknown error';
        throw new Error(`Failed to connect to Freighter: ${errorMsg}. Please make sure Freighter is unlocked and try again.`);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.saveConnectionState(false);
  }

  async getPublicKey(): Promise<string> {
    if (!this.freighterAvailable) {
      const isAvailable = await this.waitForFreighter();
      if (!isAvailable) {
        throw new Error('Wallet not connected');
      }
    }
    
    try {
      const publicKey = await getPublicKey();
      if (!publicKey) {
        throw new Error('No public key returned from Freighter');
      }
      return publicKey;
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      throw new Error(`Failed to get public key from wallet: ${errorMsg}`);
    }
  }

  async signTransaction(xdr: string, networkPassphrase?: string): Promise<string> {
    if (!this.freighterAvailable) {
      const isAvailable = await this.waitForFreighter();
      if (!isAvailable) {
        throw new Error('Wallet not connected');
      }
    }
    
    try {
      const publicKey = await this.getPublicKey();
      
      // Use networkPassphrase if provided, otherwise use network name
      const opts: any = {
        accountToSign: publicKey,
      };
      
      if (networkPassphrase) {
        opts.networkPassphrase = networkPassphrase;
      } else {
        opts.network = 'testnet';
      }
      
      return await freighterSignTransaction(xdr, opts);
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      throw new Error(`Failed to sign transaction: ${errorMsg}`);
    }
  }
}
