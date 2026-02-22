# GeoTrust Country Vault Operations Guide

This document provides step-by-step instructions for implementing frontend and backend operations to interact with the country vault smart contract. It covers deposits, payments, balance queries, and all related functionality.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Country Code Handling](#country-code-handling)
- [Deposit Operations](#deposit-operations)
- [Payment Operations](#payment-operations)
- [Balance Queries](#balance-queries)
- [WebAuthn Authentication](#webauthn-authentication)
- [Backend API Endpoints](#backend-api-endpoints)
- [Frontend Integration](#frontend-integration)
- [Error Handling](#error-handling)
- [Complete Code Examples](#complete-code-examples)

## Overview

The country vault system extends the smart wallet contract to maintain separate vault balances per country code. All operations (deposits, payments, balance queries) require a country code parameter.

**Key Concepts:**
- Each user has separate balances per country code
- Country codes are ISO 3166-1 alpha-2 format (e.g., "US", "GB", "FR")
- All contract functions require country code validation
- WebAuthn authentication is required for deposits and payments

## Prerequisites

### Required Environment Variables

```bash
# Contract Configuration
SMART_WALLET_CONTRACT_ID=<contract_address>
STELLAR_NETWORK=testnet  # or mainnet
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"  # or mainnet passphrase

# Asset Configuration
NATIVE_XLM_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC  # Testnet XLM SAC

# WebAuthn Configuration
WEBAUTHN_VERIFIER_CONTRACT=<verifier_address>
WEBAUTHN_RP_ID=<your-relying-party-id>
```

### Required Dependencies

**Backend (Node.js):**
```json
{
  "stellar-sdk": "^11.0.0",
  "@stellar/stellar-sdk": "^11.0.0"
}
```

**Frontend (React/TypeScript):**
```json
{
  "@stellar/stellar-sdk": "^11.0.0",
  "react": "^18.0.0"
}
```

## Country Code Handling

### Country Code Format

- **Format**: ISO 3166-1 alpha-2 (exactly 2 uppercase letters)
- **Examples**: "US", "GB", "FR", "DE", "JP"
- **Validation**: Must be registered and enabled in contract

### Country Code Validation

**Frontend Validation:**
```typescript
function validateCountryCode(countryCode: string): boolean {
  // Check format: exactly 2 uppercase letters
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return false;
  }
  return true;
}

// Example usage
const countryCode = "US";
if (!validateCountryCode(countryCode)) {
  throw new Error("Invalid country code format. Must be 2 uppercase letters (e.g., 'US', 'GB')");
}
```

**Backend Validation:**
```javascript
function validateCountryCode(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') {
    return false;
  }
  // Must be exactly 2 uppercase letters
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return false;
  }
  return true;
}
```

### Getting Available Countries

Query the contract to get list of registered and enabled countries:

```typescript
// Frontend: Get available countries
async function getAvailableCountries(contractId: string): Promise<string[]> {
  // Call contract.get_countries() or similar function
  // Returns list of enabled country codes
  const response = await fetch(`${BACKEND_URL}/api/smart-wallet/get-countries`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  return data.countries || [];
}
```

## Deposit Operations

### Deposit Flow Overview

1. User selects country code
2. User enters amount and asset
3. Generate signature payload (transaction data)
4. Authenticate with WebAuthn (passkey)
5. Call contract `deposit()` function with country code
6. Update UI with new balance

### Frontend Deposit Implementation

**Complete Deposit Function:**
```typescript
interface DepositParams {
  countryCode: string;
  amount: string;  // In XLM (e.g., "10.5")
  asset: string;   // Asset address or "XLM"
  userPublicKey: string;
  userSecretKey: string;
}

async function depositToCountryVault(params: DepositParams): Promise<boolean> {
  const { countryCode, amount, asset, userPublicKey, userSecretKey } = params;

  // 1. Validate country code
  if (!validateCountryCode(countryCode)) {
    throw new Error("Invalid country code");
  }

  // 2. Convert amount to stroops (1 XLM = 10,000,000 stroops)
  const amountInXLM = parseFloat(amount);
  const amountInStroops = Math.round(amountInXLM * 10000000);

  // 3. Get asset address (convert "XLM" to SAC address if needed)
  const assetAddress = asset === "XLM" 
    ? process.env.REACT_APP_NATIVE_XLM_SAC_ADDRESS 
    : asset;

  // 4. Create signature payload (transaction data)
  const transactionData = {
    source: userPublicKey,
    country_code: countryCode,  // Include country code in payload
    asset: assetAddress,
    amount: amount.toString(),
    timestamp: Date.now(),
    operation: "deposit"
  };
  const signaturePayload = JSON.stringify(transactionData);

  // 5. Generate WebAuthn challenge (SHA-256 hash of payload)
  const payloadBytes = new TextEncoder().encode(signaturePayload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', payloadBytes);
  const challenge = new Uint8Array(hashBuffer).slice(0, 32);

  // 6. Authenticate with passkey
  const passkeyCredential = await getStoredPasskeyCredential();
  if (!passkeyCredential) {
    throw new Error("Passkey credential not found");
  }

  const authResult = await navigator.credentials.get({
    publicKey: {
      challenge: challenge,
      allowCredentials: [{
        id: passkeyCredential.id,
        type: 'public-key'
      }],
      rpId: process.env.REACT_APP_WEBAUTHN_RP_ID,
      userVerification: 'required'
    }
  }) as PublicKeyCredential;

  // 7. Extract WebAuthn data
  const response = authResult.response as AuthenticatorAssertionResponse;
  const signature = arrayBufferToBase64(response.signature);
  const authenticatorData = arrayBufferToBase64(response.authenticatorData);
  const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);

  // 8. Call backend deposit endpoint
  const response = await fetch(`${BACKEND_URL}/api/smart-wallet/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractId: process.env.REACT_APP_SMART_WALLET_CONTRACT_ID,
      userAddress: userPublicKey,
      countryCode: countryCode,  // NEW: Country code parameter
      assetAddress: assetAddress,
      amount: amountInStroops,
      userSecretKey: userSecretKey,
      networkPassphrase: process.env.REACT_APP_NETWORK_PASSPHRASE,
      rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL,
      // WebAuthn parameters
      signature: signature,
      passkeyPublicKey: passkeyCredential.publicKey,
      authenticatorData: authenticatorData,
      clientDataJSON: clientDataJSON,
      signaturePayload: signaturePayload
    })
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Deposit failed");
  }

  return true;
}
```

### Backend Deposit Endpoint

**Endpoint:** `POST /api/smart-wallet/deposit`

**Request Body:**
```json
{
  "contractId": "C...",
  "userAddress": "G...",
  "countryCode": "US",  // NEW: Required country code
  "assetAddress": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  "amount": 100000000,  // In stroops
  "userSecretKey": "S...",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "rpcUrl": "https://soroban-testnet.stellar.org:443",
  "signature": "base64...",
  "passkeyPublicKey": "base64...",
  "authenticatorData": "base64...",
  "clientDataJSON": "base64...",
  "signaturePayload": "{\"source\":\"G...\",\"country_code\":\"US\",...}"
}
```

**Backend Implementation:**
```javascript
router.post('/deposit', async (req, res) => {
  try {
    const {
      contractId,
      userAddress,
      countryCode,  // NEW: Country code parameter
      assetAddress,
      amount,
      userSecretKey,
      networkPassphrase,
      rpcUrl,
      signature,
      passkeyPublicKey,
      authenticatorData,
      clientDataJSON,
      signaturePayload
    } = req.body;

    // 1. Validate country code
    if (!validateCountryCode(countryCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid country code. Must be 2 uppercase letters (ISO 3166-1 alpha-2)'
      });
    }

    // 2. Validate WebAuthn parameters
    if (!signature || !passkeyPublicKey || !authenticatorData || !clientDataJSON || !signaturePayload) {
      return res.status(400).json({
        success: false,
        error: 'WebAuthn signature parameters required'
      });
    }

    // 3. Set up Soroban RPC
    const sorobanServer = new SorobanRpcServer(rpcUrl);
    const signingKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
    const userPublicKey = signingKeypair.publicKey();

    // 4. Get account sequence
    const account = await sorobanServer.getAccount(userPublicKey);
    let accountSequence = account.sequenceNumber();

    // 5. Create contract instance
    const contract = new StellarSdk.Contract(contractId);

    // 6. Prepare contract call parameters
    // deposit(user_address, country_code, asset, amount, signature_payload, webauthn_signature, webauthn_authenticator_data, webauthn_client_data)
    
    const userScVal = StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeAccount(
        StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(
          StellarSdk.StrKey.decodeEd25519PublicKey(userPublicKey)
        )
      )
    );

    // Country code as String ScVal
    const countryCodeScVal = StellarSdk.xdr.ScVal.scvString(
      StellarSdk.xdr.ScString.fromString(countryCode)
    );

    const assetScVal = StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeContract(
        StellarSdk.StrKey.decodeContract(assetAddress)
      )
    );

    // Amount as i128
    const amountBigInt = BigInt(amount);
    const hi = amountBigInt >> 64n;
    const lo = amountBigInt & 0xFFFFFFFFFFFFFFFFn;
    const amountI128 = new StellarSdk.xdr.Int128Parts({
      hi: StellarSdk.xdr.Int64.fromString(hi.toString()),
      lo: StellarSdk.xdr.Uint64.fromString(lo.toString())
    });
    const amountScVal = StellarSdk.xdr.ScVal.scvI128(amountI128);

    // WebAuthn parameters as Bytes
    const signatureBytes = Buffer.from(signature, 'base64');
    const authenticatorDataBytes = Buffer.from(authenticatorData, 'base64');
    const clientDataBytes = Buffer.from(clientDataJSON, 'base64');
    const signaturePayloadBytes = Buffer.from(signaturePayload, 'utf8');

    const signatureScVal = StellarSdk.xdr.ScVal.scvBytes(signatureBytes);
    const authenticatorDataScVal = StellarSdk.xdr.ScVal.scvBytes(authenticatorDataBytes);
    const clientDataScVal = StellarSdk.xdr.ScVal.scvBytes(clientDataBytes);
    const signaturePayloadScVal = StellarSdk.xdr.ScVal.scvBytes(signaturePayloadBytes);

    // 7. Call contract.deposit() with country code
    const depositOp = contract.call(
      'deposit',
      userScVal,
      countryCodeScVal,  // NEW: Country code parameter
      assetScVal,
      amountScVal,
      signaturePayloadScVal,
      signatureScVal,
      authenticatorDataScVal,
      clientDataScVal
    );

    // 8. Build and send transaction
    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(userPublicKey, accountSequence),
      {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: networkPassphrase
      }
    )
      .addOperation(depositOp)
      .setTimeout(30)
      .build();

    // 9. Prepare, sign, and send
    const preparedTx = await sorobanServer.prepareTransaction(transaction);
    preparedTx.sign(signingKeypair);

    const sendResult = await sorobanServer.sendTransaction(preparedTx);

    // 10. Wait for confirmation
    let txResult;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await sorobanServer.getTransaction(sendResult.hash);
      if (txResult && txResult.status === 'SUCCESS') {
        break;
      } else if (txResult && txResult.status === 'FAILED') {
        throw new Error('Deposit transaction failed');
      }
    }

    res.json({
      success: true,
      transactionHash: sendResult.hash,
      ledger: txResult.ledger
    });

  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Payment Operations

### Payment Flow Overview

1. User selects country code
2. User enters destination, amount, and asset
3. Check balance for selected country
4. Generate signature payload
5. Authenticate with WebAuthn
6. Call contract `execute_payment()` with country code
7. Update UI with new balance

### Frontend Payment Implementation

```typescript
interface PaymentParams {
  countryCode: string;
  destination: string;
  amount: string;
  asset: string;
  userPublicKey: string;
  userSecretKey: string;
}

async function executePaymentFromCountryVault(params: PaymentParams): Promise<boolean> {
  const { countryCode, destination, amount, asset, userPublicKey, userSecretKey } = params;

  // 1. Validate country code
  if (!validateCountryCode(countryCode)) {
    throw new Error("Invalid country code");
  }

  // 2. Check balance for country
  const balance = await getCountryBalance(userPublicKey, countryCode, asset);
  const amountInStroops = Math.round(parseFloat(amount) * 10000000);
  
  if (balance < amountInStroops) {
    throw new Error(`Insufficient balance in ${countryCode} vault. Available: ${balance / 10000000} ${asset}`);
  }

  // 3. Convert amount and get asset address
  const assetAddress = asset === "XLM" 
    ? process.env.REACT_APP_NATIVE_XLM_SAC_ADDRESS 
    : asset;

  // 4. Create signature payload
  const transactionData = {
    source: userPublicKey,
    country_code: countryCode,  // Include country code
    destination: destination,
    amount: amount.toString(),
    asset: assetAddress,
    timestamp: Date.now(),
    operation: "payment"
  };
  const signaturePayload = JSON.stringify(transactionData);

  // 5. Generate WebAuthn challenge
  const payloadBytes = new TextEncoder().encode(signaturePayload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', payloadBytes);
  const challenge = new Uint8Array(hashBuffer).slice(0, 32);

  // 6. Authenticate with passkey
  const passkeyCredential = await getStoredPasskeyCredential();
  const authResult = await navigator.credentials.get({
    publicKey: {
      challenge: challenge,
      allowCredentials: [{
        id: passkeyCredential.id,
        type: 'public-key'
      }],
      rpId: process.env.REACT_APP_WEBAUTHN_RP_ID,
      userVerification: 'required'
    }
  }) as PublicKeyCredential;

  // 7. Extract WebAuthn data
  const response = authResult.response as AuthenticatorAssertionResponse;
  const signature = arrayBufferToBase64(response.signature);
  const authenticatorData = arrayBufferToBase64(response.authenticatorData);
  const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);

  // 8. Call backend payment endpoint
  const response = await fetch(`${BACKEND_URL}/api/smart-wallet/execute-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractId: process.env.REACT_APP_SMART_WALLET_CONTRACT_ID,
      signerAddress: userPublicKey,
      countryCode: countryCode,  // NEW: Country code parameter
      destination: destination,
      amount: amountInStroops,
      assetAddress: assetAddress,
      userSecretKey: userSecretKey,
      networkPassphrase: process.env.REACT_APP_NETWORK_PASSPHRASE,
      rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL,
      signature: signature,
      passkeyPublicKey: passkeyCredential.publicKey,
      authenticatorData: authenticatorData,
      clientDataJSON: clientDataJSON,
      signaturePayload: signaturePayload
    })
  });

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Payment failed");
  }

  return true;
}
```

### Backend Payment Endpoint

**Endpoint:** `POST /api/smart-wallet/execute-payment`

**Request Body:**
```json
{
  "contractId": "C...",
  "signerAddress": "G...",
  "countryCode": "US",  // NEW: Required country code
  "destination": "G...",
  "amount": 100000000,
  "assetAddress": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  "userSecretKey": "S...",
  "networkPassphrase": "Test SDF Network ; September 2015",
  "rpcUrl": "https://soroban-testnet.stellar.org:443",
  "signature": "base64...",
  "passkeyPublicKey": "base64...",
  "authenticatorData": "base64...",
  "clientDataJSON": "base64...",
  "signaturePayload": "{\"source\":\"G...\",\"country_code\":\"US\",...}"
}
```

**Backend Implementation:**
```javascript
router.post('/execute-payment', async (req, res) => {
  try {
    const {
      contractId,
      signerAddress,
      countryCode,  // NEW: Country code parameter
      destination,
      amount,
      assetAddress,
      userSecretKey,
      networkPassphrase,
      rpcUrl,
      signature,
      passkeyPublicKey,
      authenticatorData,
      clientDataJSON,
      signaturePayload
    } = req.body;

    // 1. Validate country code
    if (!validateCountryCode(countryCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid country code'
      });
    }

    // 2. Set up Soroban RPC
    const sorobanServer = new SorobanRpcServer(rpcUrl);
    const signingKeypair = StellarSdk.Keypair.fromSecret(userSecretKey);
    const userPublicKey = signingKeypair.publicKey();

    // 3. Get account sequence
    const account = await sorobanServer.getAccount(userPublicKey);
    let accountSequence = account.sequenceNumber();

    // 4. Create contract instance
    const contract = new StellarSdk.Contract(contractId);

    // 5. Prepare contract call parameters
    // execute_payment(signer_address, country_code, destination, amount, asset, signature_payload, webauthn_signature, webauthn_authenticator_data, webauthn_client_data)
    
    const signerScVal = StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeAccount(
        StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(
          StellarSdk.StrKey.decodeEd25519PublicKey(signerAddress)
        )
      )
    );

    const countryCodeScVal = StellarSdk.xdr.ScVal.scvString(
      StellarSdk.xdr.ScString.fromString(countryCode)
    );

    const destinationScVal = StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeAccount(
        StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(
          StellarSdk.StrKey.decodeEd25519PublicKey(destination)
        )
      )
    );

    // Amount and asset (same as deposit)
    const amountBigInt = BigInt(amount);
    const hi = amountBigInt >> 64n;
    const lo = amountBigInt & 0xFFFFFFFFFFFFFFFFn;
    const amountI128 = new StellarSdk.xdr.Int128Parts({
      hi: StellarSdk.xdr.Int64.fromString(hi.toString()),
      lo: StellarSdk.xdr.Uint64.fromString(lo.toString())
    });
    const amountScVal = StellarSdk.xdr.ScVal.scvI128(amountI128);

    const assetScVal = StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeContract(
        StellarSdk.StrKey.decodeContract(assetAddress)
      )
    );

    // WebAuthn parameters
    const signatureBytes = Buffer.from(signature, 'base64');
    const authenticatorDataBytes = Buffer.from(authenticatorData, 'base64');
    const clientDataBytes = Buffer.from(clientDataJSON, 'base64');
    const signaturePayloadBytes = Buffer.from(signaturePayload, 'utf8');

    const signatureScVal = StellarSdk.xdr.ScVal.scvBytes(signatureBytes);
    const authenticatorDataScVal = StellarSdk.xdr.ScVal.scvBytes(authenticatorDataBytes);
    const clientDataScVal = StellarSdk.xdr.ScVal.scvBytes(clientDataBytes);
    const signaturePayloadScVal = StellarSdk.xdr.ScVal.scvBytes(signaturePayloadBytes);

    // 6. Call contract.execute_payment() with country code
    const paymentOp = contract.call(
      'execute_payment',
      signerScVal,
      countryCodeScVal,  // NEW: Country code parameter
      destinationScVal,
      amountScVal,
      assetScVal,
      signaturePayloadScVal,
      signatureScVal,
      authenticatorDataScVal,
      clientDataScVal
    );

    // 7. Build and send transaction (same as deposit)
    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(userPublicKey, accountSequence),
      {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: networkPassphrase
      }
    )
      .addOperation(paymentOp)
      .setTimeout(30)
      .build();

    const preparedTx = await sorobanServer.prepareTransaction(transaction);
    preparedTx.sign(signingKeypair);

    const sendResult = await sorobanServer.sendTransaction(preparedTx);

    // 8. Wait for confirmation
    let txResult;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await sorobanServer.getTransaction(sendResult.hash);
      if (txResult && txResult.status === 'SUCCESS') {
        break;
      } else if (txResult && txResult.status === 'FAILED') {
        throw new Error('Payment transaction failed');
      }
    }

    res.json({
      success: true,
      transactionHash: sendResult.hash,
      ledger: txResult.ledger
    });

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## Balance Queries

### Get Balance for Specific Country

**Frontend:**
```typescript
async function getCountryBalance(
  userAddress: string,
  countryCode: string,
  asset: string
): Promise<number> {
  const assetAddress = asset === "XLM" 
    ? process.env.REACT_APP_NATIVE_XLM_SAC_ADDRESS 
    : asset;

  const response = await fetch(`${BACKEND_URL}/api/smart-wallet/get-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractId: process.env.REACT_APP_SMART_WALLET_CONTRACT_ID,
      userAddress: userAddress,
      countryCode: countryCode,  // NEW: Country code parameter
      assetAddress: assetAddress,
      rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL
    })
  });

  const data = await response.json();
  return data.balance || 0;
}
```

**Backend:**
```javascript
router.post('/get-balance', async (req, res) => {
  try {
    const {
      contractId,
      userAddress,
      countryCode,  // NEW: Country code parameter
      assetAddress,
      rpcUrl
    } = req.body;

    // Validate country code
    if (!validateCountryCode(countryCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid country code'
      });
    }

    const sorobanServer = new SorobanRpcServer(rpcUrl);
    const contract = new StellarSdk.Contract(contractId);

    // Prepare parameters for get_balance(user_address, country_code, asset)
    const userScVal = StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeAccount(
        StellarSdk.xdr.PublicKey.publicKeyTypeEd25519(
          StellarSdk.StrKey.decodeEd25519PublicKey(userAddress)
        )
      )
    );

    const countryCodeScVal = StellarSdk.xdr.ScVal.scvString(
      StellarSdk.xdr.ScString.fromString(countryCode)
    );

    const assetScVal = StellarSdk.xdr.ScVal.scvAddress(
      StellarSdk.xdr.ScAddress.scAddressTypeContract(
        StellarSdk.StrKey.decodeContract(assetAddress)
      )
    );

    // Call contract.get_balance()
    const balanceOp = contract.call('get_balance', userScVal, countryCodeScVal, assetScVal);

    // Create read-only transaction
    const dummyAccount = StellarSdk.Keypair.random();
    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(dummyAccount.publicKey(), "0"),
      {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: req.body.networkPassphrase || "Test SDF Network ; September 2015"
      }
    )
      .addOperation(balanceOp)
      .setTimeout(30)
      .build();

    // Simulate transaction (read-only)
    const result = await sorobanServer.simulateTransaction(transaction);
    const balance = result.result?.retval?.i128()?.lo()?.toString() || "0";

    res.json({
      success: true,
      balance: parseInt(balance, 10)
    });

  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      balance: 0
    });
  }
});
```

### Get All Countries for User

```typescript
async function getUserCountries(userAddress: string): Promise<string[]> {
  const response = await fetch(`${BACKEND_URL}/api/smart-wallet/get-user-countries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractId: process.env.REACT_APP_SMART_WALLET_CONTRACT_ID,
      userAddress: userAddress,
      rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL
    })
  });

  const data = await response.json();
  return data.countries || [];
}
```

### Get Total Balance Across All Countries

```typescript
async function getTotalBalance(userAddress: string, asset: string): Promise<number> {
  const response = await fetch(`${BACKEND_URL}/api/smart-wallet/get-total-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contractId: process.env.REACT_APP_SMART_WALLET_CONTRACT_ID,
      userAddress: userAddress,
      assetAddress: asset === "XLM" 
        ? process.env.REACT_APP_NATIVE_XLM_SAC_ADDRESS 
        : asset,
      rpcUrl: process.env.REACT_APP_SOROBAN_RPC_URL
    })
  });

  const data = await response.json();
  return data.totalBalance || 0;
}
```

## WebAuthn Authentication

### Helper Functions

```typescript
// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Get stored passkey credential
async function getStoredPasskeyCredential(): Promise<PublicKeyCredential | null> {
  const stored = localStorage.getItem('passkey_credential');
  if (!stored) return null;
  
  try {
    const credentialData = JSON.parse(stored);
    return {
      id: base64ToArrayBuffer(credentialData.id),
      type: 'public-key',
      // ... other credential properties
    } as PublicKeyCredential;
  } catch (error) {
    console.error('Error parsing passkey credential:', error);
    return null;
  }
}
```

## Error Handling

### Common Errors

**Invalid Country Code:**
```typescript
if (!validateCountryCode(countryCode)) {
  throw new Error("Invalid country code. Must be 2 uppercase letters (e.g., 'US', 'GB')");
}
```

**Country Not Registered:**
```typescript
// Check if country is registered and enabled
const countries = await getAvailableCountries();
if (!countries.includes(countryCode)) {
  throw new Error(`Country code '${countryCode}' is not registered or enabled`);
}
```

**Insufficient Balance:**
```typescript
const balance = await getCountryBalance(userAddress, countryCode, asset);
if (balance < amountInStroops) {
  throw new Error(
    `Insufficient balance in ${countryCode} vault. ` +
    `Available: ${balance / 10000000} ${asset}, ` +
    `Required: ${amount} ${asset}`
  );
}
```

**WebAuthn Authentication Failed:**
```typescript
try {
  const authResult = await navigator.credentials.get({...});
} catch (error) {
  if (error.name === 'NotAllowedError') {
    throw new Error("Passkey authentication was cancelled or denied");
  } else if (error.name === 'InvalidStateError') {
    throw new Error("Passkey credential is invalid or expired");
  } else {
    throw new Error(`WebAuthn authentication failed: ${error.message}`);
  }
}
```

## Complete Code Examples

### React Component: Country Vault Deposit

```typescript
import React, { useState } from 'react';

interface CountryVaultDepositProps {
  userPublicKey: string;
  userSecretKey: string;
}

export const CountryVaultDeposit: React.FC<CountryVaultDepositProps> = ({
  userPublicKey,
  userSecretKey
}) => {
  const [countryCode, setCountryCode] = useState('US');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState('XLM');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleDeposit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate inputs
      if (!validateCountryCode(countryCode)) {
        throw new Error('Invalid country code');
      }
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Invalid amount');
      }

      // Execute deposit
      await depositToCountryVault({
        countryCode,
        amount,
        asset,
        userPublicKey,
        userSecretKey
      });

      setSuccess(`Successfully deposited ${amount} ${asset} to ${countryCode} vault`);
      setAmount(''); // Clear form
    } catch (err: any) {
      setError(err.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Deposit to Country Vault</h2>
      
      <div>
        <label>Country Code:</label>
        <input
          type="text"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
          maxLength={2}
          placeholder="US"
        />
      </div>

      <div>
        <label>Amount:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="10.5"
        />
      </div>

      <div>
        <label>Asset:</label>
        <select value={asset} onChange={(e) => setAsset(e.target.value)}>
          <option value="XLM">XLM</option>
        </select>
      </div>

      <button onClick={handleDeposit} disabled={loading}>
        {loading ? 'Processing...' : 'Deposit'}
      </button>

      {error && <div style={{ color: 'red' }}>{error}</div>}
      {success && <div style={{ color: 'green' }}>{success}</div>}
    </div>
  );
};
```

### React Component: Country Vault Payment

```typescript
export const CountryVaultPayment: React.FC<CountryVaultPaymentProps> = ({
  userPublicKey,
  userSecretKey
}) => {
  const [countryCode, setCountryCode] = useState('US');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [asset, setAsset] = useState('XLM');
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load balance when country code changes
  useEffect(() => {
    if (countryCode && asset) {
      getCountryBalance(userPublicKey, countryCode, asset)
        .then(setBalance)
        .catch(console.error);
    }
  }, [countryCode, asset, userPublicKey]);

  const handlePayment = async () => {
    setLoading(true);
    try {
      await executePaymentFromCountryVault({
        countryCode,
        destination,
        amount,
        asset,
        userPublicKey,
        userSecretKey
      });
      // Refresh balance
      const newBalance = await getCountryBalance(userPublicKey, countryCode, asset);
      setBalance(newBalance);
      alert('Payment successful!');
    } catch (err: any) {
      alert(`Payment failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Payment from Country Vault</h2>
      
      <div>
        <label>Country Code:</label>
        <input
          type="text"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
          maxLength={2}
        />
        <span>Balance: {balance / 10000000} {asset}</span>
      </div>

      <div>
        <label>Destination:</label>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="G..."
        />
      </div>

      <div>
        <label>Amount:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <button onClick={handlePayment} disabled={loading || balance < parseFloat(amount) * 10000000}>
        {loading ? 'Processing...' : 'Send Payment'}
      </button>
    </div>
  );
};
```

## Summary

This guide provides complete implementation details for:

1. **Deposit Operations**: How to deposit tokens to a country-specific vault
2. **Payment Operations**: How to send payments from a country-specific vault
3. **Balance Queries**: How to query balances per country and total balances
4. **WebAuthn Integration**: Complete authentication flow
5. **Backend API**: Full endpoint implementations
6. **Frontend Components**: React component examples
7. **Error Handling**: Common errors and how to handle them

All operations require:
- Country code parameter (ISO 3166-1 alpha-2 format)
- WebAuthn authentication for deposits and payments
- Proper amount conversion (XLM to stroops)
- Transaction confirmation waiting

The country vault system maintains complete isolation between countries while using the same contract infrastructure.
