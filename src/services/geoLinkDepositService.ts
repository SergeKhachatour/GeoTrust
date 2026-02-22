/**
 * GeoLink Deposit Service
 * Handles pending deposit actions from GeoLink
 * Supports both wallet signing and WebAuthn (passkey) methods
 */

export interface ContractCallIntent {
  v: number;
  network: string;
  rpcUrl: string;
  contractId: string;
  fn: string;
  args: Array<{
    name: string;
    type: string;
    value: string;
  }>;
  signer: string;
  ruleBinding?: string | null;
  nonce: string;
  iat: number;
  exp: number;
}

export class GeoLinkDepositService {
  private walletProviderKey: string;
  private baseUrl: string;

  constructor(walletProviderKey: string) {
    this.walletProviderKey = walletProviderKey;
    this.baseUrl = process.env.REACT_APP_GEOLINK_API_URL || 'https://testnet.stellargeolink.com';
  }

  /**
   * Generate 32-byte hex nonce
   */
  private generateNonce(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Create ContractCallIntent in GeoLink's format
   */
  createContractCallIntent(
    depositAction: any,
    network: string = 'testnet'
  ): ContractCallIntent {
    // Filter out WebAuthn fields from parameters
    const webauthnFieldNames = [
      'signature_payload',
      'webauthn_signature',
      'webauthn_authenticator_data',
      'webauthn_client_data',
      'webauthn_client_data_json',
    ];

    const intentParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(depositAction.parameters || {})) {
      if (
        !webauthnFieldNames.includes(key) &&
        value &&
        typeof value === 'string' &&
        !value.includes('[Will be') &&
        !value.includes('system-generated')
      ) {
        intentParams[key] = value;
      }
    }

    // Create typed arguments array
    const typedArgs = Object.entries(intentParams).map(([name, value]) => ({
      name,
      type: 'String', // Default - ideally use contract introspection for actual types
      value: value.toString(),
    }));

    // Determine RPC URL based on network
    const rpcUrl =
      network === 'mainnet'
        ? 'https://rpc.mainnet.stellar.org:443'
        : 'https://soroban-testnet.stellar.org:443';

    // Create ContractCallIntent
    const now = Math.floor(Date.now() / 1000);
    const intent: ContractCallIntent = {
      v: 1, // Version
      network: network,
      rpcUrl: rpcUrl,
      contractId: depositAction.contract_address,
      fn: depositAction.function_name,
      args: typedArgs,
      signer: depositAction.matched_public_key,
      ruleBinding: depositAction.rule_id ? depositAction.rule_id.toString() : null,
      nonce: this.generateNonce(),
      iat: now,
      exp: now + 300, // 5 minutes expiration
    };

    return intent;
  }

  /**
   * Encode ContractCallIntent to canonical JSON bytes
   */
  encodeIntentToBytes(intent: ContractCallIntent): Uint8Array {
    // Create canonical object (excludes authMode and WebAuthn fields)
    const canonical: any = {
      v: intent.v,
      network: intent.network,
      rpcUrl: intent.rpcUrl,
      contractId: intent.contractId,
      fn: intent.fn,
      args: intent.args.map((arg) => ({
        name: arg.name,
        type: arg.type,
        value: arg.value,
      })),
      signer: intent.signer,
      ...(intent.ruleBinding && { ruleBinding: intent.ruleBinding }),
      nonce: intent.nonce,
      iat: intent.iat,
      exp: intent.exp,
    };

    // Convert to canonical JSON string (sorted keys for deterministic encoding)
    const sortedKeys = Object.keys(canonical).sort();
    const sortedCanonical: any = {};
    for (const key of sortedKeys) {
      sortedCanonical[key] = canonical[key];
    }

    const jsonString = JSON.stringify(sortedCanonical);
    
    // Encode as UTF-8 bytes
    return new TextEncoder().encode(jsonString);
  }

  /**
   * Generate WebAuthn challenge from intent bytes (GeoLink method: SHA-256 hash)
   */
  async generateChallenge(intentBytes: Uint8Array): Promise<Uint8Array> {
    // GeoLink uses SHA-256 hash of intent bytes, then takes first 32 bytes
    const hashBuffer = await crypto.subtle.digest('SHA-256', intentBytes);
    const hash = new Uint8Array(hashBuffer);
    return hash.slice(0, 32); // SHA-256 is already 32 bytes
  }

  /**
   * Execute deposit via GeoLink's execute endpoint (WebAuthn method)
   * 
   * According to API docs: POST /api/contracts/rules/pending/deposits/:action_id/execute
   * 
   * Request Body (WebAuthn method):
   * {
   *   passkeyPublicKeySPKI: "...",
   *   webauthnSignature: "...",
   *   webauthnAuthenticatorData: "...",
   *   webauthnClientData: "...",
   *   signaturePayload: "...",
   *   user_public_key: "...",
   *   user_secret_key: "..."  // Optional: for server-side signing fallback
   * }
   * 
   * Response: { success: true, result: { txHash, status, returnValue, ledger, contractLogs, stellarExpertUrl } }
   */
  async executeDeposit(
    actionId: string,
    publicKey: string,
    userSecretKey: string,
    passkeyPublicKeySPKI: string,
    webauthnSignature: string,
    webauthnAuthenticatorData: string,
    webauthnClientData: string,
    signaturePayload: string
  ): Promise<{
    success: boolean;
    result?: {
      txHash?: string;
      transaction_hash?: string;
      status?: string;
      returnValue?: any;
      ledger?: number;
      contractLogs?: any[];
      stellarExpertUrl?: string;
    };
    error?: string;
  }> {
    const url = `${this.baseUrl}/api/contracts/rules/pending/deposits/${actionId}/execute`;

    // Use documented field names (camelCase)
    const requestBody = {
      user_public_key: publicKey,
      user_secret_key: userSecretKey,
      passkeyPublicKeySPKI: passkeyPublicKeySPKI,
      webauthnSignature: webauthnSignature,
      webauthnAuthenticatorData: webauthnAuthenticatorData,
      webauthnClientData: webauthnClientData,
      signaturePayload: signaturePayload,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': this.walletProviderKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || result.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return result;
  }

  /**
   * Report deposit completion when executed directly via wallet signing
   */
  async reportDepositCompletion(
    actionId: string,
    publicKey: string,
    transactionHash: string,
    ledger: number
  ): Promise<{ success: boolean; message: string }> {
    const url = `${this.baseUrl}/api/contracts/rules/pending/deposits/${actionId}/complete`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': this.walletProviderKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        public_key: publicKey,
        transaction_hash: transactionHash,
        ledger: ledger,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to report completion' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }
}
