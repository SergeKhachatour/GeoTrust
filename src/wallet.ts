import { StellarWalletsKit, WalletNetwork, allowAllModules } from "@creit.tech/stellar-wallets-kit";
import { Networks } from '@stellar/stellar-sdk';

const WALLET_STORAGE_KEY = 'geotrust_wallet_connected';
const WALLET_ADDRESS_KEY = 'geotrust_wallet_address';
const WALLET_TYPE_KEY = 'geotrust_wallet_type'; // Store which wallet was used

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
  private isConnecting: boolean = false;

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
  private saveConnectionState(connected: boolean, address?: string, walletType?: string): void {
    if (typeof window === 'undefined') return;
    if (connected && address) {
      localStorage.setItem(WALLET_STORAGE_KEY, 'true');
      localStorage.setItem(WALLET_ADDRESS_KEY, address);
      if (walletType) {
        localStorage.setItem(WALLET_TYPE_KEY, walletType);
      }
      this.connectedAddress = address;
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
      localStorage.removeItem(WALLET_ADDRESS_KEY);
      localStorage.removeItem(WALLET_TYPE_KEY);
      this.connectedAddress = null;
    }
  }

  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      throw new Error('Wallet connection already in progress');
    }
    
    this.isConnecting = true;
    
    try {
      // First, get available wallets to log them for debugging
      const supportedWallets = await this.kit.getSupportedWallets();
      console.log('[Wallet] Available wallets:', supportedWallets.map(w => ({
        name: w.name,
        id: w.id,
        isAvailable: w.isAvailable,
        type: w.type
      })));
      
      const availableWallets = supportedWallets.filter(w => w.isAvailable);
      if (availableWallets.length === 0) {
        throw new Error('No wallets available. Please install a Stellar wallet like xBull, Albedo, or Lobstr.');
      }
      
      // Check if modal is already open by checking if button was created
      // If button exists, modal might be open, so we should wait or handle differently
      try {
        // Open the modal to let user select a wallet
        return new Promise((resolve, reject) => {
          this.kit.openModal({
            onWalletSelected: async (wallet) => {
              try {
                console.log('[Wallet] User selected wallet:', wallet.name, wallet.id);
                
                // Set the selected wallet
                this.kit.setWallet(wallet.id);
                
                // Now get the address
                const { address } = await this.kit.getAddress();
                
                if (!address) {
                  reject(new Error('No address returned from wallet'));
                  return;
                }
                
                this.saveConnectionState(true, address, wallet.id);
                console.log('[Wallet] Connected to wallet:', wallet.name, address);
                this.isConnecting = false;
                resolve();
              } catch (error: any) {
                this.isConnecting = false;
                const errorMsg = error?.message || error?.toString() || 'Unknown error';
                console.error('[Wallet] Error connecting to wallet:', error);
                reject(new Error(`Failed to connect to ${wallet.name}: ${errorMsg}`));
              }
            },
            onClosed: (err) => {
              this.isConnecting = false;
              if (err) {
                console.log('[Wallet] Modal closed with error:', err);
                reject(new Error(`Wallet selection cancelled: ${err.message || err}`));
              } else {
                console.log('[Wallet] Modal closed by user');
                reject(new Error('Wallet connection was cancelled by user'));
              }
            },
            modalTitle: 'Connect Stellar Wallet',
            notAvailableText: 'Not available on this device'
          });
        });
      } catch (error: any) {
        this.isConnecting = false;
        const errorMsg = error?.message || error?.toString() || 'Unknown error';
        
        // If modal is already open, wait a bit and try to get address instead
        if (errorMsg.includes('already open') || errorMsg.includes('modal is already')) {
          console.log('[Wallet] Modal already open, trying to get address directly...');
          // Wait a moment for the existing modal to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          // Try to get address - if wallet is already selected, this should work
          try {
            const { address } = await this.kit.getAddress();
            if (address) {
              this.saveConnectionState(true, address);
              return;
            }
          } catch (e) {
            // If that fails, rethrow the original error
            throw error;
          }
        }
        
        // Check if user rejected/cancelled
        if (errorMsg.includes('rejected') || errorMsg.includes('cancelled') || errorMsg.includes('denied') || errorMsg.includes('closed')) {
          throw new Error('Wallet connection was cancelled by user');
        }
        
        throw new Error(`Failed to connect wallet: ${errorMsg}`);
      }
    } catch (error: any) {
      this.isConnecting = false;
      this.saveConnectionState(false);
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      
      // Check if user rejected/cancelled
      if (errorMsg.includes('rejected') || errorMsg.includes('cancelled') || errorMsg.includes('denied') || errorMsg.includes('closed')) {
        throw new Error('Wallet connection was cancelled by user');
      }
      
      throw error;
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

  async getPublicKey(skipConnect: boolean = false): Promise<string> {
    // If we have a cached address and were connected, try to restore the wallet connection
    if (this.connectedAddress && Wallet.wasConnected() && typeof window !== 'undefined') {
      const savedWalletType = localStorage.getItem(WALLET_TYPE_KEY);
      
      // Try to restore the specific wallet if we know which one was used
      if (savedWalletType) {
        try {
          // Set the wallet first
          this.kit.setWallet(savedWalletType);
          // Then try to get address
          const { address } = await this.kit.getAddress({ skipRequestAccess: skipConnect });
          if (address) {
            this.connectedAddress = address;
            this.saveConnectionState(true, address, savedWalletType);
            return address;
          }
        } catch (error) {
          console.warn('[Wallet] Failed to restore wallet connection, will try full connection:', error);
          // If restore fails and skipConnect is true, throw error
          if (skipConnect) {
            throw new Error('Failed to restore wallet connection');
          }
        }
      } else {
        // No wallet type saved, try to get address directly
        try {
          const { address } = await this.kit.getAddress({ skipRequestAccess: skipConnect });
          if (address) {
            this.connectedAddress = address;
            return address;
          }
        } catch (error) {
          if (skipConnect) {
            throw new Error('Failed to get cached address');
          }
          console.warn('[Wallet] Failed to get cached address, requesting new connection');
        }
      }
    }
    
    // Try to get address - if it fails with "set wallet first", we need to connect
    try {
      const { address } = await this.kit.getAddress({ skipRequestAccess: skipConnect });
      if (address) {
        this.connectedAddress = address;
        this.saveConnectionState(true, address);
        return address;
      }
      throw new Error('No address returned from wallet');
    } catch (error: any) {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      
      // If skipConnect is true, don't try to connect - just throw the error
      if (skipConnect) {
        throw new Error(`Failed to get public key from wallet: ${errorMsg}`);
      }
      
      // If it's a "set wallet first" error, trigger connection
      if (errorMsg.includes('set the wallet first') || errorMsg.includes('Please set the wallet')) {
        // Try to connect (this will open the modal)
        await this.connect();
        // After connect, getAddress should work
        const { address } = await this.kit.getAddress();
        if (address) {
          this.connectedAddress = address;
          this.saveConnectionState(true, address);
          return address;
        }
        throw new Error('No address returned from wallet after connection');
      }
      
      throw new Error(`Failed to get public key from wallet: ${errorMsg}`);
    }
  }

  async signTransaction(xdr: string, networkPassphrase?: string): Promise<string> {
    try {
      // For signing, we need a connected wallet, so don't skip connect
      const address = await this.getPublicKey(false);
      
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
