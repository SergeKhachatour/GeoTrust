import { 
  Contract, 
  rpc,
  Networks, 
  xdr,
  nativeToScVal,
  Address,
  BASE_FEE,
  TransactionBuilder
} from '@stellar/stellar-sdk';

/**
 * Read-only contract client that doesn't require a wallet
 * Used for fetching public data like country policies and session info
 */
export class ReadOnlyContractClient {
  private contract: Contract;
  private rpc: rpc.Server;
  private contractId: string;
  private network: Networks;

  constructor(contractId?: string) {
    this.network = Networks.TESTNET;
    // Allow RPC URL to be configured via environment variable for CORS proxy support
    // In development, use backend proxy. In production, use configured URL or direct endpoint
    // Check if we're running on localhost (development) to use proxy
    let rpcUrl = process.env.REACT_APP_SOROBAN_RPC_URL;
    if (!rpcUrl && typeof window !== 'undefined') {
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      rpcUrl = isDevelopment
        ? `${window.location.protocol}//${window.location.hostname}:8080/api/soroban-rpc`
        : 'https://soroban-testnet.stellar.org';
    } else if (!rpcUrl) {
      rpcUrl = 'https://soroban-testnet.stellar.org';
    }
    this.rpc = new rpc.Server(rpcUrl);
    console.log('[ReadOnlyContractClient] Using RPC URL:', rpcUrl);
    
    const NEW_CONTRACT_ID = 'CAW645ORVZG64DEOEC3XZ6DYJU56Y35ERVXX4QO6DNDTWDZS6ADONTPR';
    const OLD_CONTRACT_ID = 'CCEOUE46RT6QXZI4OHKWZBOCOKVHIN3SX7OFFGYUQHK3DEY7OOHY22TN';
    
    this.contractId = contractId || process.env.REACT_APP_CONTRACT_ID || NEW_CONTRACT_ID;
    
    if (this.contractId === OLD_CONTRACT_ID) {
      this.contractId = NEW_CONTRACT_ID;
    }
    
    this.contract = new Contract(this.contractId);
  }

  private async call(functionName: string, ...args: any[]): Promise<any> {
    try {
      // Try to use backend API first (uses service account for read-only operations)
      // Check if we're in development or if backend is available
      const isDevelopment = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      if (isDevelopment || process.env.REACT_APP_USE_BACKEND_API === 'true') {
        try {
          // Convert args to parameters array for backend (plain values, backend will convert)
          const parameters = args;

          const backendUrl = isDevelopment 
            ? `${window.location.protocol}//${window.location.hostname}:8080/api/contract/readonly`
            : '/api/contract/readonly';

          const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contractId: this.contractId,
              functionName,
              parameters,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.result) {
              // Parse base64 XDR back to ScVal
              const scVal = xdr.ScVal.fromXDR(data.result, 'base64');
              // Convert ScVal to JavaScript
              return this.scValToJs(scVal);
            }
            return null;
          }
          // If backend fails, fall through to direct RPC
          console.warn('[ReadOnlyContractClient] Backend API failed, falling back to direct RPC');
        } catch (backendError) {
          // If backend is not available, fall through to direct RPC
          console.warn('[ReadOnlyContractClient] Backend API not available, using direct RPC:', backendError);
        }
      }

      // Fallback: Direct RPC simulation (original implementation)
      // Convert arguments to ScVal (same logic as ContractClient)
      const scValArgs = args.map(arg => {
        if (arg instanceof xdr.ScVal) {
          return arg;
        }
        if (typeof arg === 'number') {
          return xdr.ScVal.scvU32(arg);
        }
        if (typeof arg === 'boolean') {
          return xdr.ScVal.scvBool(arg);
        }
        if (typeof arg === 'string') {
          if (arg.length === 56 && (arg.startsWith('G') || arg.startsWith('C'))) {
            try {
              const addr = Address.fromString(arg);
              return addr.toScVal();
            } catch {
              return xdr.ScVal.scvString(arg);
            }
          }
          return xdr.ScVal.scvString(arg);
        }
        if (arg instanceof Uint8Array) {
          return nativeToScVal(arg);
        }
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(arg)) {
          return nativeToScVal(new Uint8Array(arg));
        }
        if (arg === null || arg === undefined) {
          return xdr.ScVal.scvVoid();
        }
        return arg;
      });

      // Build contract operation
      const contractOp = this.contract.call(functionName, ...scValArgs);
      
      // Create a dummy source account for simulation (we don't need a real account)
      // Use a dummy account ID - simulation doesn't require a real account
      const dummyAccount = {
        accountId: () => 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        sequenceNumber: () => '0',
        incrementSequenceNumber: () => {},
      } as any;

      // Build transaction for simulation
      const transaction = new TransactionBuilder(dummyAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.network,
      })
        .addOperation(contractOp)
        .setTimeout(300)
        .build();

      // Simulate the transaction (read-only, no signing needed)
      let simResponse: rpc.Api.SimulateTransactionResponse;
      try {
        simResponse = await this.rpc.simulateTransaction(transaction);
      } catch (simError: any) {
        // Check if it's an XDR parsing error during simulation
        // This can happen when the SDK tries to parse the response and encounters an Option type
        if (simError.message?.includes('Bad union switch') || 
            simError.message?.includes('union switch') ||
            simError.message?.includes('XDR') ||
            simError.toString().includes('Bad union switch')) {
          console.warn(`[ReadOnlyContractClient] XDR parsing error during simulation for ${functionName} - contract format may have changed or SDK version mismatch:`, simError.message || simError.toString());
          // Return null gracefully to allow app to continue
          return null;
        }
        throw simError;
      }

      if (rpc.Api.isSimulationError(simResponse)) {
        throw new Error(`Simulation failed: ${JSON.stringify(simResponse)}`);
      }

      if (!simResponse.result) {
        throw new Error('No result from simulation');
      }

      // Extract return value
      const retval = simResponse.result.retval;
      if (!retval) {
        return null;
      }

      // Convert ScVal to JavaScript value
      try {
        return this.scValToJs(retval);
      } catch (parseError: any) {
        // If parsing fails with "Bad union switch", the contract might have changed
        // or there's an SDK version mismatch. Return null gracefully.
        if (parseError.message?.includes('Bad union switch') || 
            parseError.message?.includes('union switch') ||
            parseError.message?.includes('XDR') ||
            parseError.toString().includes('Bad union switch')) {
          console.warn(`[ReadOnlyContractClient] XDR parsing error for ${functionName} - contract format may have changed:`, parseError.message || parseError.toString());
          // Return null gracefully to allow app to continue
          return null;
        }
        throw parseError;
      }
    } catch (error: any) {
      // Check if it's an XDR parsing error - catch any remaining XDR errors
      if (error.message?.includes('Bad union switch') || 
          error.message?.includes('union switch') ||
          error.message?.includes('XDR_PARSING_ERROR') ||
          error.message?.includes('XDR') ||
          error.toString().includes('Bad union switch')) {
        console.warn(`[ReadOnlyContractClient] XDR parsing error for ${functionName} - contract format may have changed or SDK version mismatch:`, error.message || error.toString());
        return null; // Return null instead of throwing to allow app to continue
      }
      console.error(`[ReadOnlyContractClient] Error calling ${functionName}:`, error);
      throw error;
    }
  }

  private scValToJs(scVal: xdr.ScVal): any {
    switch (scVal.switch()) {
      case xdr.ScValType.scvBool():
        return scVal.b();
      case xdr.ScValType.scvVoid():
        return null;
      case xdr.ScValType.scvU32():
        return scVal.u32();
      case xdr.ScValType.scvI32():
        return scVal.i32();
      case xdr.ScValType.scvU64():
        return scVal.u64().toString();
      case xdr.ScValType.scvI64():
        return scVal.i64().toString();
      case xdr.ScValType.scvU128():
        const u128 = scVal.u128();
        const hi = u128.hi().toString();
        const lo = u128.lo().toString();
        return { hi, lo };
      case xdr.ScValType.scvI128():
        const i128 = scVal.i128();
        const i128hi = i128.hi().toString();
        const i128lo = i128.lo().toString();
        return { hi: i128hi, lo: i128lo };
      case xdr.ScValType.scvString():
        return scVal.str().toString();
      case xdr.ScValType.scvSymbol():
        return scVal.sym().toString();
      case xdr.ScValType.scvBytes():
        return scVal.bytes();
      case xdr.ScValType.scvAddress():
        try {
          const addr = Address.fromScAddress(scVal.address());
          return addr.toString();
        } catch (e) {
          try {
            return scVal.address().accountId().ed25519().toString('hex');
          } catch {
            console.error('[ReadOnlyContractClient] Error converting address:', e);
            return null;
          }
        }
      case xdr.ScValType.scvVec():
        const vec = scVal.vec()?.map((v) => this.scValToJs(v)) || [];
        // Special handling for SessionState enum variants which come as Vec<Symbol>
        if (vec.length === 1 && typeof vec[0] === 'string') {
          const symbolString = vec[0];
          // Check if it matches known session states (case-insensitive)
          if (['Waiting', 'Active', 'Ended'].some(s => s.toLowerCase() === symbolString.toLowerCase())) {
            return symbolString; // Return the string representation of the state
          }
        }
        return vec;
      case xdr.ScValType.scvMap():
        const map = scVal.map();
        const result: any = {};
        map?.forEach((entry) => {
          const keyScVal = entry.key();
          const val = this.scValToJs(entry.val());
          
          // Handle symbol keys (struct field names)
          let key: string;
          if (keyScVal.switch() === xdr.ScValType.scvSymbol()) {
            // Symbol keys are used for struct fields
            const symbol = keyScVal.sym();
            key = symbol.toString();
          } else {
            key = String(this.scValToJs(keyScVal));
          }
          
          result[key] = val;
        });
        return result;
      default:
        console.warn('[ReadOnlyContractClient] Unhandled ScVal type:', scVal.switch());
        return scVal;
    }
  }

  async getCountryPolicy(): Promise<[boolean, number, number]> {
    const result = await this.call('get_country_policy');
    // Check if result is an array (iterable)
    if (!result || !Array.isArray(result)) {
      // If XDR parsing failed or result is invalid, throw error
      throw new Error('XDR_PARSING_ERROR:get_country_policy returned invalid result');
    }
    // Ensure we have at least 3 elements
    if (result.length < 3) {
      throw new Error('XDR_PARSING_ERROR:get_country_policy returned incomplete result');
    }
    return [result[0] as boolean, result[1] as number, result[2] as number];
  }

  async getCountryAllowed(country: number): Promise<boolean> {
    const result = await this.call('get_country_allowed', country);
    return result as boolean;
  }

  async getCountryAdmin(country: number): Promise<string | null> {
    try {
      const result = await this.call('get_country_admin', country);
      if (!result || result === null || result === undefined) {
        return null;
      }
      if (typeof result === 'string') {
        return result;
      }
      return String(result);
    } catch (error: any) {
      console.error('[ReadOnlyContractClient] Failed to get country admin:', error);
      return null;
    }
  }

  async getSession(sessionId: number): Promise<any> {
    return await this.call('get_session', sessionId);
  }

  async listAllowedCountries(page: number = 0, pageSize: number = 100): Promise<number[]> {
    const result = await this.call('list_allowed_countries', page, pageSize);
    return result as number[];
  }

  async getAdmin(): Promise<string | null> {
    try {
      const result = await this.call('get_admin');
      if (!result || result === null || result === undefined) {
        return null;
      }
      if (typeof result === 'string') {
        return result;
      }
      return String(result);
    } catch (error: any) {
      console.error('[ReadOnlyContractClient] Failed to get admin:', error);
      return null;
    }
  }

  async getGameHub(): Promise<string | null> {
    try {
      const result = await this.call('get_game_hub');
      if (!result || result === null || result === undefined) {
        return null;
      }
      if (typeof result === 'string') {
        return result;
      }
      return String(result);
    } catch (error: any) {
      console.error('[ReadOnlyContractClient] Failed to get game hub:', error);
      return null;
    }
  }

  async getCountryInfo(countryCode: string): Promise<any> {
    try {
      const result = await this.call('get_country_info', countryCode);
      return result;
    } catch (error: any) {
      console.error('[ReadOnlyContractClient] Failed to get country info:', error);
      return null;
    }
  }
}
