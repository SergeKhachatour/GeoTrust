import { Buffer } from 'buffer';
import { Wallet } from './wallet';
import { 
  Contract, 
  SorobanRpc, 
  Networks, 
  xdr,
  BASE_FEE,
  Address,
  nativeToScVal
} from '@stellar/stellar-sdk';
import { TransactionBuilder } from '@stellar/stellar-sdk';

export class ContractClient {
  private wallet: Wallet;
  private contract: Contract;
  private network: Networks;
  private rpc: SorobanRpc.Server;
  private contractId: string;

  constructor(wallet: Wallet, contractId?: string) {
    this.wallet = wallet;
    this.network = Networks.TESTNET;
    this.rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
    
    // Debug: Log all env vars to see what's being loaded
    console.log('[ContractClient] REACT_APP_CONTRACT_ID from env:', process.env.REACT_APP_CONTRACT_ID);
    console.log('[ContractClient] All REACT_APP_ vars:', Object.keys(process.env).filter(k => k.startsWith('REACT_APP_')));
    
    // TEMPORARY: Hardcode new contract ID to bypass React env caching issues
    const NEW_CONTRACT_ID = 'CAW645ORVZG64DEOEC3XZ6DYJU56Y35ERVXX4QO6DNDTWDZS6ADONTPR';
    const OLD_CONTRACT_ID = 'CCEOUE46RT6QXZI4OHKWZBOCOKVHIN3SX7OFFGYUQHK3DEY7OOHY22TN';
    
    this.contractId = contractId || process.env.REACT_APP_CONTRACT_ID || NEW_CONTRACT_ID;
    
    // Force use new contract ID if old one is detected
    if (this.contractId === OLD_CONTRACT_ID) {
      console.warn('[ContractClient] ⚠️ Detected OLD contract ID, forcing use of NEW contract ID');
      this.contractId = NEW_CONTRACT_ID;
    }
    
    if (!this.contractId) {
      console.error('[ContractClient] No contract ID provided! Check REACT_APP_CONTRACT_ID in .env.local');
    } else {
      console.log('[ContractClient] Using contract ID:', this.contractId);
      if (this.contractId === NEW_CONTRACT_ID) {
        console.log('[ContractClient] ✅ Using NEW contract ID');
      }
    }
    this.contract = new Contract(this.contractId);
  }

  async init(admin: string, defaultAllowAll: boolean): Promise<void> {
    await this.call('init', admin, defaultAllowAll);
  }

  async getAdmin(): Promise<string | null> {
    try {
      const result = await this.call('get_admin');
      // get_admin returns Option<Address>
      // If result is void/undefined/null, contract is not initialized
      if (!result || result === null || result === undefined) {
        return null;
      }
      // Result might be an Address object or string - convert to string
      if (typeof result === 'string') {
        return result;
      }
      // If it's an object (Address), try to extract the string
      if (result && typeof result === 'object') {
        // Check if it has a toString method or address property
        if (result.toString && typeof result.toString === 'function') {
          const str = result.toString();
          if (str && str.length === 56 && str.startsWith('G')) {
            return str;
          }
        }
        // Try to get address from object properties
        if ((result as any).address) {
          return String((result as any).address);
        }
        console.warn('[ContractClient] getAdmin returned unexpected object:', result);
      }
      // Fallback: try to convert to string
      return String(result);
    } catch (error) {
      console.error('[ContractClient] Failed to get admin:', error);
      // If get_admin fails (e.g., contract not initialized), return null
      return null;
    }
  }

  async getSession(sessionId: number): Promise<any> {
    console.log('[ContractClient] Getting session:', sessionId);
    try {
      const result = await this.call('get_session', sessionId);
      console.log('[ContractClient] Session data:', JSON.stringify(result, null, 2));
      if (result) {
        console.log('[ContractClient] Session state:', result.state);
        console.log('[ContractClient] Player1:', result.player1);
        console.log('[ContractClient] Player2:', result.player2);
      }
      return result;
    } catch (error) {
      console.error('[ContractClient] Failed to get session:', error);
      return null;
    }
  }

  async getCountryPolicy(): Promise<[boolean, number, number]> {
    const result = await this.call('get_country_policy');
    return result as [boolean, number, number];
  }

  async getCountryAllowed(country: number): Promise<boolean | null> {
    const result = await this.call('get_country_allowed', country);
    return result as boolean | null;
  }

  async listAllowedCountries(page: number, pageSize: number): Promise<number[]> {
    const result = await this.call('list_allowed_countries', page, pageSize);
    return result as number[];
  }

  async setCountryAllowed(country: number, allowed: boolean): Promise<void> {
    await this.call('set_country_allowed', country, allowed);
  }

  async setDefaultAllowAll(value: boolean): Promise<void> {
    await this.call('set_default_allow_all', value);
  }

  async setVerifier(verifierId: string): Promise<void> {
    console.log('[ContractClient] setVerifier called with:', verifierId);
    // Convert string to Address - Contract.call() will handle the conversion
    // This calls set_verifier on the MAIN contract (not the verifier contract)
    // The main contract stores the verifier address for later use
    await this.call('set_verifier', verifierId);
    console.log('[ContractClient] ✅ set_verifier transaction completed');
  }

  async setGameHub(gameHubId: string): Promise<void> {
    // Convert string to Address - Contract.call() will handle the conversion
    await this.call('set_game_hub', gameHubId);
  }

  async createSession(): Promise<number> {
    console.log('[ContractClient] Creating session...');
    const result = await this.call('create_session');
    console.log('[ContractClient] Session created with ID:', result);
    return result as number;
  }

  async joinSession(
    sessionId: number,
    cellId: number,
    assetTag: Uint8Array,
    country: number,
    locationProof?: { proof: Uint8Array; publicInputs: number[] }
  ): Promise<void> {
    // First, verify the session exists before trying to join
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found. Please create a session first.`);
      }
      console.log('[ContractClient] Session exists, proceeding to join:', session);
    } catch (error) {
      console.error('[ContractClient] Error checking session before join:', error);
      throw new Error(`Cannot join session ${sessionId}: ${error instanceof Error ? error.message : 'Session not found'}`);
    }
    console.log('[ContractClient] Joining session:', {
      sessionId,
      cellId,
      country,
      hasProof: !!locationProof,
      assetTagLength: assetTag.length,
      assetTagHex: Array.from(assetTag.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('') + '...'
    });
    
    // Get caller address and convert to ScVal Address
    const callerStr = await this.wallet.getPublicKey();
    const callerAddress = new Address(callerStr);
    const callerScVal = xdr.ScVal.scvAddress(callerAddress.toScAddress());
    
    // Convert proof if provided - manually create ScVal Map with symbol keys
    let proofDataScVal: xdr.ScVal | null = null;
    if (locationProof) {
      // Ensure proof is exactly 64 bytes (BytesN<64>)
      let proofBytes = locationProof.proof;
      if (proofBytes.length !== 64) {
        // Pad or truncate to exactly 64 bytes
        const padded = new Uint8Array(64);
        padded.set(proofBytes.slice(0, 64), 0);
        proofBytes = padded;
      }
      
      // Convert proof bytes to ScVal (BytesN<64>)
      const proofScVal = nativeToScVal(proofBytes);
      
      // Convert public inputs array to ScVal Vec<u32>
      const publicInputsScVal = nativeToScVal(locationProof.publicInputs);
      
      // Create ScMap with symbol keys (struct field names as symbols)
      // Soroban structs use symbol keys, not string keys
      const mapEntries: xdr.ScMapEntry[] = [];
      
      // Create symbol for 'proof' field
      mapEntries.push(
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('proof'),
          val: proofScVal,
        })
      );
      
      // Create symbol for 'public_inputs' field
      mapEntries.push(
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol('public_inputs'),
          val: publicInputsScVal,
        })
      );
      
      // scvMap accepts array of ScMapEntry directly (as seen in contract_spec.js)
      proofDataScVal = xdr.ScVal.scvMap(mapEntries);
    }
    
    // Call with all args as ScVal
    // For Option<LocationProof>, pass the ScVal Map directly or null
    // The call method will handle null -> scvVoid conversion
    console.log('[ContractClient] Calling join_session with args:', {
      caller: callerStr,
      sessionId,
      cellId,
      assetTagLength: assetTag.length,
      country,
      proof: proofDataScVal ? 'provided' : 'null'
    });
    
    await this.call('join_session', callerScVal, sessionId, cellId, assetTag, country, proofDataScVal);
    console.log('[ContractClient] Successfully joined session:', sessionId);
  }

  async resolveMatch(sessionId: number): Promise<{ matched: boolean; winner: string | null }> {
    const result = await this.call('resolve_match', sessionId);
    return result as { matched: boolean; winner: string | null };
  }

  private async call(functionName: string, ...args: any[]): Promise<any> {
    console.log(`[ContractClient.call] Calling ${functionName} with ${args.length} args`);
    const publicKey = await this.wallet.getPublicKey();
    
    // Get fresh account data right before building transaction to avoid sequence issues
    // This ensures we always have the latest sequence number
    const sourceAccount = await this.rpc.getAccount(publicKey);
    console.log(`[ContractClient.call] Account sequence for ${functionName}:`, sourceAccount.sequenceNumber());
    
    // Convert all arguments to ScVal
    const scValArgs = args.map(arg => {
      // If already ScVal, return as is
      if (arg instanceof xdr.ScVal) {
        return arg;
      }
      // Convert based on type
      if (typeof arg === 'number') {
        // Assume u32 for numbers (contract uses u32 for IDs and counts)
        return xdr.ScVal.scvU32(arg);
      }
      if (typeof arg === 'boolean') {
        return xdr.ScVal.scvBool(arg);
      }
      if (typeof arg === 'string') {
        // Check if it's an address (Stellar address format: starts with G and is 56 chars)
        if (arg.length === 56 && arg.startsWith('G')) {
          try {
            const addr = Address.fromString(arg);
            return addr.toScVal();
          } catch (e) {
            // If not a valid address, treat as regular string
            return xdr.ScVal.scvString(arg);
          }
        }
        return xdr.ScVal.scvString(arg);
      }
      // Convert Uint8Array/Buffer to ScBytes ScVal using nativeToScVal
      if (arg instanceof Uint8Array) {
        return nativeToScVal(arg);
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(arg)) {
        // Convert Buffer to Uint8Array for nativeToScVal
        return nativeToScVal(new Uint8Array(arg));
      }
      if (arg === null || arg === undefined) {
        // For Option<T> in Rust, null/undefined means None, which is scvVoid
        return xdr.ScVal.scvVoid();
      }
      // For objects (like structs), pass through - Contract.call() will use spec to convert
      // The contract spec knows the struct format and will convert properly with symbol keys
      return arg;
    });
    
    // Check if this is a read-only operation
    const isReadOperation = ['get_admin', 'get_country_policy', 'get_country_allowed', 'list_allowed_countries', 'get_session'].includes(functionName);
    
    if (isReadOperation) {
      // For read operations, use simulation only (no signing/sending)
      console.log(`[ContractClient.call] Read operation ${functionName}, using simulation only...`);
      
      // Build a minimal transaction for simulation
      const contractOp = this.contract.call(functionName, ...scValArgs);
      const transaction = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.network,
      })
        .addOperation(contractOp)
        .setTimeout(300)
        .build();

      // Simulate to get the result
      const simResponse = await this.rpc.simulateTransaction(transaction);
      
      // Check if simulation failed
      if ('error' in simResponse) {
        console.error(`[ContractClient.call] Simulation failed for ${functionName}:`, simResponse.error);
        throw new Error(`Simulation failed: ${JSON.stringify(simResponse.error)}`);
      }
      
      // Extract return value from simulation
      if (simResponse && 'result' in simResponse && simResponse.result) {
        const returnValue = simResponse.result.retval;
        if (returnValue) {
          const converted = this.scValToJs(returnValue);
          console.log(`[ContractClient.call] Read operation ${functionName} result:`, converted, typeof converted);
          return converted;
        }
      }
      
      return null;
    }
    
    // For write operations, build, sign, and send transaction
    const contractOp = this.contract.call(functionName, ...scValArgs);
    
    // Build transaction with longer timeout (300 seconds = 5 minutes)
    // This gives plenty of time for user to approve in Freighter
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: this.network,
    })
      .addOperation(contractOp)
      .setTimeout(300) // 5 minutes timeout
      .build();

    // Simulate to get resource usage
    console.log(`[ContractClient.call] Simulating transaction for ${functionName}...`);
    const simResponse = await this.rpc.simulateTransaction(transaction);
    
    // Check if simulation failed
    if ('error' in simResponse) {
      console.error(`[ContractClient.call] Simulation failed for ${functionName}:`, simResponse.error);
      throw new Error(`Simulation failed: ${JSON.stringify(simResponse.error)}`);
    }
    console.log(`[ContractClient.call] Simulation successful for ${functionName}`);

    // Prepare transaction with resource estimates
    const prepared = await this.rpc.prepareTransaction(transaction);
    
    // Convert to XDR string for signing
    const xdrString = prepared.toXDR();
    
    // Sign transaction - pass network passphrase (this.network is already the passphrase string)
    let signed: string;
    try {
      signed = await this.wallet.signTransaction(xdrString, this.network);
    } catch (error: any) {
      // Check if user rejected
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        throw new Error('Transaction was rejected by user');
      }
      console.error('Transaction signing error:', error);
      console.error('Transaction XDR length:', xdrString.length);
      throw new Error(`Failed to sign transaction: ${error.message || 'Unknown error'}`);
    }
    
    // Rebuild transaction from signed XDR to ensure it's fresh
    const tx = TransactionBuilder.fromXDR(signed, this.network);
    
    // Send transaction immediately after signing
    const sendResponse = await this.rpc.sendTransaction(tx);
    
    if (sendResponse.status === 'ERROR') {
      const errorMsg = sendResponse.errorResult 
        ? JSON.stringify(sendResponse.errorResult) 
        : 'Transaction failed';
      throw new Error(errorMsg);
    }

    // Transaction has been sent successfully
    // For write operations, we should wait for inclusion
    const isWriteOperation = true; // All non-read operations are write operations
    
    if (isWriteOperation) {
      // Wait for transaction to be included by checking ledger sequence
      // This is more reliable than parsing transaction results
      console.log(`[ContractClient.call] Waiting for ${functionName} transaction to be included...`);
      
      // Get current ledger sequence before transaction
      let currentLedger: number;
      try {
        const latestLedger = await this.rpc.getLatestLedger();
        currentLedger = latestLedger.sequence;
        console.log(`[ContractClient.call] Current ledger sequence: ${currentLedger}`);
      } catch (error) {
        console.warn(`[ContractClient.call] Could not get current ledger, using fixed wait`);
        currentLedger = 0;
      }
      
      // Wait for ledger to advance (transaction should be in next ledger or two)
      // Stellar ledgers close every ~5 seconds, so wait up to 15 seconds
      let attempts = 0;
      const maxAttempts = 15;
      let ledgerAdvanced = false;
      
      while (attempts < maxAttempts && !ledgerAdvanced) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        try {
          const latestLedger = await this.rpc.getLatestLedger();
          if (latestLedger.sequence > currentLedger) {
            console.log(`[ContractClient.call] Ledger advanced from ${currentLedger} to ${latestLedger.sequence} (attempt ${attempts})`);
            ledgerAdvanced = true;
            // Wait one more second for ledger state to fully settle
            await new Promise(resolve => setTimeout(resolve, 1000));
            break;
          }
        } catch (error: any) {
          console.warn(`[ContractClient.call] Error checking ledger (attempt ${attempts}):`, error.message);
          // Continue waiting
        }
      }
      
      if (!ledgerAdvanced) {
        console.warn(`[ContractClient.call] Ledger did not advance after ${maxAttempts} attempts, but continuing...`);
        // Still wait a bit to be safe
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Use simulation result for return value (simulation is reliable for return values)
    if (simResponse && 'result' in simResponse && simResponse.result) {
      const returnValue = simResponse.result.retval;
      if (returnValue) {
        return this.scValToJs(returnValue);
      }
    }
    
    return null;
  }

  private scValToJs(scVal: xdr.ScVal): any {
    switch (scVal.switch()) {
      case xdr.ScValType.scvBool():
        return scVal.b();
      case xdr.ScValType.scvU32():
        return scVal.u32();
      case xdr.ScValType.scvI32():
        return scVal.i32();
      case xdr.ScValType.scvU64():
        return scVal.u64();
      case xdr.ScValType.scvI64():
        return scVal.i64();
      case xdr.ScValType.scvAddress():
        try {
          const addr = scVal.address();
          // Address object from Stellar SDK - convert to string using Address constructor
          // The address() method returns an ScAddress, which we need to convert
          const addrObj = Address.fromScAddress(addr);
          // Address object - try to get the account ID string
          // Address might have accountId() method or we need to access a property
          let addrStr: string;
          try {
            // Try accountId() method if it exists
            if (typeof (addrObj as any).accountId === 'function') {
              addrStr = (addrObj as any).accountId();
            } else if ((addrObj as any).accountId && typeof (addrObj as any).accountId === 'string') {
              addrStr = (addrObj as any).accountId;
            } else {
              // Try toString() but check if it's valid
              addrStr = addrObj.toString();
              // If toString returns [object Object], try to get the value property
              if (addrStr === '[object Object]' || !addrStr || addrStr.length !== 56) {
                // Address might have a value or address property
                const value = (addrObj as any).value || (addrObj as any).address || (addrObj as any).accountId;
                if (value && typeof value === 'string' && value.length === 56 && value.startsWith('G')) {
                  addrStr = value;
                } else {
                  // Last resort: try to stringify and parse
                  const json = JSON.stringify(addrObj);
                  const match = json.match(/"([G][A-Z0-9]{55})"/);
                  if (match && match[1]) {
                    addrStr = match[1];
                  } else {
                    throw new Error('Could not extract address string');
                  }
                }
              }
            }
          } catch (e) {
            console.error('[ContractClient] Error extracting address string:', e);
            // Try one more fallback
            addrStr = String(addrObj);
            if (addrStr === '[object Object]') {
              return null;
            }
          }
          
          // Validate
          if (addrStr && addrStr.length === 56 && addrStr.startsWith('G')) {
            console.log('[ContractClient] scvAddress converted to string:', addrStr);
            return addrStr;
          } else {
            console.error('[ContractClient] Invalid address string:', addrStr);
            return null;
          }
        } catch (e) {
          console.error('[ContractClient] Error converting scvAddress:', e);
          // Fallback: try to get the raw address bytes and convert
          try {
            const addr = scVal.address();
            // ScAddress has a toXDR() method that returns bytes
            const addrBytes = addr.toXDR();
            // Try to create Address from bytes
            const addrObj = Address.fromScAddress(addr);
            return addrObj.toString();
          } catch (e2) {
            console.error('[ContractClient] Fallback address conversion also failed:', e2);
            // Last resort: try to extract from the object
            const addr = scVal.address();
            const addrStr = String(addr);
            if (addrStr && addrStr.length === 56 && addrStr.startsWith('G')) {
              return addrStr;
            }
            return null;
          }
        }
      case xdr.ScValType.scvVoid():
        // Void means None for Option types
        return null;
      case xdr.ScValType.scvBytes():
        return scVal.bytes();
      case xdr.ScValType.scvString():
        return scVal.str().toString();
      case xdr.ScValType.scvVec():
        const vec = scVal.vec()?.map((v) => this.scValToJs(v)) || [];
        // Option<Address> might be returned as Vec with one element
        // If it's a single-element vec with an address, return the address string directly
        if (vec.length === 1 && typeof vec[0] === 'string' && vec[0].length === 56 && vec[0].startsWith('G')) {
          return vec[0];
        }
        return vec;
      case xdr.ScValType.scvMap():
        const map: any = {};
        scVal.map()?.forEach((entry) => {
          const key = this.scValToJs(entry.key());
          const val = this.scValToJs(entry.val());
          map[key] = val;
        });
        return map;
      default:
        return scVal;
    }
  }
}
