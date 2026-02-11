import { StellarWalletsKit, WalletNetwork, allowAllModules } from "@creit.tech/stellar-wallets-kit";
import { Networks } from '@stellar/stellar-sdk';

const WALLET_STORAGE_KEY = 'geotrust_wallet_connected';
const WALLET_ADDRESS_KEY = 'geotrust_wallet_address';

// Global kit instance
let kitInstance: StellarWalletsKit | null = null;

function getOrCreateKit(): StellarWalletsKit {
  if (!kitInstance) {
    // Initialize the kit with all available modules
    kitInstance = new StellarWalletsKit({
      network: WalletNetwork.TESTNET, // Use TESTNET for Stellar Testnet
      modules: allowAllModules(),
    });
    console.log('[Wallet] Stellar Wallets Kit initialized');
  }
  return kitInstance;
}

export class Wallet {
  private connectedAddress: string | null = null;
  private kit: StellarWalletsKit;

  constructor() {
    // Get or create the kit instance
    this.kit = getOrCreateKit();
    
    // Try to restore previous connection
    if (typeof window !== 'undefined') {
      const savedAddress = localStorage.getItem(WALLET_ADDRESS_KEY);
      if (savedAddress && Wallet.wasConnected()) {
        this.connectedAddress = savedAddress;
      }
    }
  }

  // Check if wallet was previously connected
  static wasConnected(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(WALLET_STORAGE_KEY) === 'true';
  }

  // Save connection state
  private saveConnectionState(connected: boolean, address?: string): void {
    if (typeof window === 'undefined') return;
    if (connected && address) {
      localStorage.setItem(WALLET_STORAGE_KEY, 'true');
      localStorage.setItem(WALLET_ADDRESS_KEY, address);
      this.connectedAddress = address;
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      localStorage.removeItem(WALLET_ADDRESS_KEY);
      this.connectedAddress = null;
    }
  }

  async connect(): Promise<void> {
    try {
      // Use the kit's getAddress which will show the wallet selection modal
      const { address } = await this.kit.getAddress();
      
      if (!address) {
        throw new Error('No address returned from wallet');
      }
      
      this.saveConnectionState(true, address);
      console.log('[Wallet] Connected to wallet:', address);
    } catch (error: any) {
      this.saveConnectionState(false);
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      
      // Check if user rejected/cancelled
      if (errorMsg.includes('rejected') || errorMsg.includes('cancelled') || errorMsg.includes('denied') || errorMsg.includes('closed')) {
        throw new Error('Wallet connection was cancelled by user');
      }
      
      throw new Error(`Failed to connect wallet: ${errorMsg}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Disconnect from the kit
      await this.kit.disconnect();
      this.saveConnectionState(false);
      console.log('[Wallet] Disconnected');
    } catch (error) {
      console.error('[Wallet] Error during disconnect:', error);
      // Still clear our state even if there's an error
      this.saveConnectionState(false);
    }
  }

  async getPublicKey(): Promise<string> {
    // If we have a cached address and were connected, try to use it
    // But still verify with the kit
    if (this.connectedAddress && Wallet.wasConnected()) {
      try {
        // Try to get address from kit (this will use the selected wallet)
        const { address } = await this.kit.getAddress({ skipRequestAccess: true });
        if (address) {
          this.connectedAddress = address;
          return address;
        }
      } catch (error) {
        // If that fails, fall through to full connection flow
        console.warn('[Wallet] Failed to get cached address, requesting new connection');
      }
    }
    
    try {
      // Otherwise, get it from the kit (this will show the modal if not connected)
      const { address } = await this.kit.getAddress();
      
      if (!address) {
        throw new Error('No address returned from wallet');
      }
      
      // Cache it
      this.connectedAddress = address;
      this.saveConnectionState(true, address);
      
      return address;
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      throw new Error(`Failed to get public key from wallet: ${errorMsg}`);
    }
  }

  async signTransaction(xdr: string, networkPassphrase?: string): Promise<string> {
    try {
      const address = await this.getPublicKey();
      
      // Use the kit's signTransaction method
      const { signedTxXdr } = await this.kit.signTransaction(xdr, {
        networkPassphrase: networkPassphrase || Networks.TESTNET,
        address,
      });
      
      if (!signedTxXdr) {
        throw new Error('No signed transaction returned from wallet');
      }
      
      return signedTxXdr;
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      
      // Check if user rejected
      if (errorMsg.includes('rejected') || errorMsg.includes('cancelled') || errorMsg.includes('denied')) {
        throw new Error('Transaction was rejected by user');
      }
      
      throw new Error(`Failed to sign transaction: ${errorMsg}`);
    }
  }
}
