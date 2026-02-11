import { 
  Contract, 
  SorobanRpc, 
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
  private rpc: SorobanRpc.Server;
  private contractId: string;
  private network: Networks;

  constructor(contractId?: string) {
    this.network = Networks.TESTNET;
    this.rpc = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
    
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
      const simResponse = await this.rpc.simulateTransaction(transaction);

      if (SorobanRpc.Api.isSimulationError(simResponse)) {
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
      return this.scValToJs(retval);
    } catch (error: any) {
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
      case xdr.ScValType.scvString():
        return scVal.str().toString();
      case xdr.ScValType.scvAddress():
        try {
          const addr = Address.fromScAddress(scVal.address());
          return addr.toString();
        } catch {
          return scVal.address().accountId().ed25519().toString('hex');
        }
      case xdr.ScValType.scvVec():
        return scVal.vec()?.map(v => this.scValToJs(v)) || [];
      case xdr.ScValType.scvMap():
        const map = scVal.map();
        const result: any = {};
        map?.forEach((entry) => {
          const key = this.scValToJs(entry.key());
          const val = this.scValToJs(entry.val());
          result[key] = val;
        });
        return result;
      default:
        return scVal;
    }
  }

  async getCountryPolicy(): Promise<[boolean, number, number]> {
    const result = await this.call('get_country_policy');
    return result as [boolean, number, number];
  }

  async getCountryAllowed(country: number): Promise<boolean> {
    const result = await this.call('get_country_allowed', country);
    return result as boolean;
  }

  async getSession(sessionId: number): Promise<any> {
    return await this.call('get_session', sessionId);
  }

  async listAllowedCountries(page: number = 0, pageSize: number = 100): Promise<number[]> {
    const result = await this.call('list_allowed_countries', page, pageSize);
    return result as number[];
  }
}
