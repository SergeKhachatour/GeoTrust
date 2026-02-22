const express = require('express');
const router = express.Router();
const { 
  Contract, 
  rpc, 
  Networks, 
  Keypair,
  nativeToScVal,
  Address,
  xdr,
  TransactionBuilder,
  BASE_FEE
} = require('@stellar/stellar-sdk');

// Service account for read-only operations
function getServiceAccount() {
  const serviceAccountSecret = process.env.SERVICE_ACCOUNT_SECRET_KEY;
  if (!serviceAccountSecret) {
    throw new Error('SERVICE_ACCOUNT_SECRET_KEY not configured');
  }
  return Keypair.fromSecret(serviceAccountSecret);
}

// Get Soroban RPC server
function getSorobanRPC(rpcUrl) {
  const url = rpcUrl || process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  return new rpc.Server(url);
}

// Get network passphrase
function getNetworkPassphrase(networkPassphrase) {
  return networkPassphrase || process.env.NETWORK_PASSPHRASE || Networks.TESTNET;
}

// Validate ISO2 country code
function validateCountryCode(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') {
    return false;
  }
  return /^[A-Z]{2}$/.test(countryCode);
}

// Convert Buffer/Uint8Array to base64
function toBase64(data) {
  if (Buffer.isBuffer(data)) {
    return data.toString('base64');
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data).toString('base64');
  }
  if (typeof data === 'string') {
    return Buffer.from(data, 'utf8').toString('base64');
  }
  return Buffer.from(data).toString('base64');
}

// POST /api/smart-wallet/deposit - Deposit to country vault
router.post('/deposit', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      contractId,
      userAddress,
      countryCode,
      assetAddress,
      amount,
      userSecretKey,
      networkPassphrase,
      rpcUrl,
      signaturePayload,
      webauthnSignature,
      webauthnAuthenticatorData,
      webauthnClientData
    } = req.body;

    // Validate required fields
    if (!contractId || !userAddress || !countryCode || !assetAddress || !amount || !userSecretKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validate country code
    if (!validateCountryCode(countryCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid country code format (must be ISO2, e.g., "US", "GB")'
      });
    }

    // Set up Soroban RPC
    const sorobanServer = getSorobanRPC(rpcUrl);
    const signingKeypair = Keypair.fromSecret(userSecretKey);
    const network = getNetworkPassphrase(networkPassphrase);

    // Get account sequence
    const account = await sorobanServer.getAccount(signingKeypair.publicKey());
    const accountSequence = account.sequenceNumber();

    // Create contract instance
    const contract = new Contract(contractId);

    // Prepare contract call parameters
    // deposit(user_address, country_code, asset, amount, signature_payload, webauthn_signature, webauthn_authenticator_data, webauthn_client_data)
    const userScVal = Address.fromString(userAddress).toScVal();
    const countryCodeScVal = xdr.ScVal.scvString(countryCode);
    const assetScVal = Address.fromString(assetAddress).toScVal();
    const amountScVal = xdr.ScVal.scvI128(xdr.Int128Parts.fromString(amount.toString()));
    
    // Convert WebAuthn data to Bytes
    const signaturePayloadBytes = signaturePayload 
      ? Buffer.from(signaturePayload, 'utf8')
      : Buffer.alloc(0);
    const webauthnSignatureBytes = webauthnSignature
      ? Buffer.from(webauthnSignature, 'base64')
      : Buffer.alloc(0);
    const webauthnAuthenticatorDataBytes = webauthnAuthenticatorData
      ? Buffer.from(webauthnAuthenticatorData, 'base64')
      : Buffer.alloc(0);
    const webauthnClientDataBytes = webauthnClientData
      ? Buffer.from(webauthnClientData, 'utf8')
      : Buffer.alloc(0);

    const signaturePayloadScVal = nativeToScVal(signaturePayloadBytes);
    const webauthnSignatureScVal = nativeToScVal(webauthnSignatureBytes);
    const webauthnAuthenticatorDataScVal = nativeToScVal(webauthnAuthenticatorDataBytes);
    const webauthnClientDataScVal = nativeToScVal(webauthnClientDataBytes);

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network,
    })
      .addOperation(contract.call(
        'deposit',
        userScVal,
        countryCodeScVal,
        assetScVal,
        amountScVal,
        signaturePayloadScVal,
        webauthnSignatureScVal,
        webauthnAuthenticatorDataScVal,
        webauthnClientDataScVal
      ))
      .setTimeout(30)
      .build();

    // Simulate first
    const simulation = await sorobanServer.simulateTransaction(transaction);
    if (simulation.errorResult) {
      return res.status(400).json({
        success: false,
        error: 'Simulation failed',
        message: simulation.errorResult.toString()
      });
    }

    // Prepare transaction
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Sign transaction
    preparedTx.sign(signingKeypair);

    // Send transaction
    const sendResult = await sorobanServer.sendTransaction(preparedTx);

    // Wait for confirmation
    let txResult;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await sorobanServer.getTransaction(sendResult.hash);
      if (txResult && txResult.status === 'SUCCESS') {
        break;
      } else if (txResult && txResult.status === 'FAILED') {
        return res.status(400).json({
          success: false,
          error: 'Transaction failed',
          message: txResult.statusXdr?.toString() || 'Unknown error'
        });
      }
    }

    if (!txResult || txResult.status !== 'SUCCESS') {
      return res.status(500).json({
        success: false,
        error: 'Transaction timeout'
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Smart Wallet] Deposit completed`, {
      countryCode,
      amount,
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      transactionHash: sendResult.hash
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Smart Wallet] Deposit error:', {
      error: error.message,
      duration: `${duration}ms`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/smart-wallet/execute-payment - Execute payment from country vault
router.post('/execute-payment', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      contractId,
      signerAddress,
      countryCode,
      destination,
      amount,
      assetAddress,
      userSecretKey,
      networkPassphrase,
      rpcUrl,
      signaturePayload,
      webauthnSignature,
      webauthnAuthenticatorData,
      webauthnClientData
    } = req.body;

    // Validate required fields
    if (!contractId || !signerAddress || !countryCode || !destination || !amount || !assetAddress || !userSecretKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validate country code
    if (!validateCountryCode(countryCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid country code format (must be ISO2, e.g., "US", "GB")'
      });
    }

    // Set up Soroban RPC
    const sorobanServer = getSorobanRPC(rpcUrl);
    const signingKeypair = Keypair.fromSecret(userSecretKey);
    const network = getNetworkPassphrase(networkPassphrase);

    // Get account sequence
    const account = await sorobanServer.getAccount(signingKeypair.publicKey());
    const accountSequence = account.sequenceNumber();

    // Create contract instance
    const contract = new Contract(contractId);

    // Prepare contract call parameters
    // execute_payment(signer_address, country_code, destination, amount, asset, signature_payload, webauthn_signature, webauthn_authenticator_data, webauthn_client_data)
    const signerScVal = Address.fromString(signerAddress).toScVal();
    const countryCodeScVal = xdr.ScVal.scvString(countryCode);
    const destinationScVal = Address.fromString(destination).toScVal();
    const amountScVal = xdr.ScVal.scvI128(xdr.Int128Parts.fromString(amount.toString()));
    const assetScVal = Address.fromString(assetAddress).toScVal();
    
    // Convert WebAuthn data to Bytes
    const signaturePayloadBytes = signaturePayload 
      ? Buffer.from(signaturePayload, 'utf8')
      : Buffer.alloc(0);
    const webauthnSignatureBytes = webauthnSignature
      ? Buffer.from(webauthnSignature, 'base64')
      : Buffer.alloc(0);
    const webauthnAuthenticatorDataBytes = webauthnAuthenticatorData
      ? Buffer.from(webauthnAuthenticatorData, 'base64')
      : Buffer.alloc(0);
    const webauthnClientDataBytes = webauthnClientData
      ? Buffer.from(webauthnClientData, 'utf8')
      : Buffer.alloc(0);

    const signaturePayloadScVal = nativeToScVal(signaturePayloadBytes);
    const webauthnSignatureScVal = nativeToScVal(webauthnSignatureBytes);
    const webauthnAuthenticatorDataScVal = nativeToScVal(webauthnAuthenticatorDataBytes);
    const webauthnClientDataScVal = nativeToScVal(webauthnClientDataBytes);

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network,
    })
      .addOperation(contract.call(
        'execute_payment',
        signerScVal,
        countryCodeScVal,
        destinationScVal,
        amountScVal,
        assetScVal,
        signaturePayloadScVal,
        webauthnSignatureScVal,
        webauthnAuthenticatorDataScVal,
        webauthnClientDataScVal
      ))
      .setTimeout(30)
      .build();

    // Simulate first
    const simulation = await sorobanServer.simulateTransaction(transaction);
    if (simulation.errorResult) {
      return res.status(400).json({
        success: false,
        error: 'Simulation failed',
        message: simulation.errorResult.toString()
      });
    }

    // Prepare transaction
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Sign transaction
    preparedTx.sign(signingKeypair);

    // Send transaction
    const sendResult = await sorobanServer.sendTransaction(preparedTx);

    // Wait for confirmation
    let txResult;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      txResult = await sorobanServer.getTransaction(sendResult.hash);
      if (txResult && txResult.status === 'SUCCESS') {
        break;
      } else if (txResult && txResult.status === 'FAILED') {
        return res.status(400).json({
          success: false,
          error: 'Transaction failed',
          message: txResult.statusXdr?.toString() || 'Unknown error'
        });
      }
    }

    if (!txResult || txResult.status !== 'SUCCESS') {
      return res.status(500).json({
        success: false,
        error: 'Transaction timeout'
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[Smart Wallet] Payment executed`, {
      countryCode,
      amount,
      destination: destination.substring(0, 8) + '...',
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      transactionHash: sendResult.hash
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Smart Wallet] Payment error:', {
      error: error.message,
      duration: `${duration}ms`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/smart-wallet/get-balance - Get balance for country and asset
router.post('/get-balance', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      contractId,
      userAddress,
      countryCode,
      assetAddress,
      rpcUrl
    } = req.body;

    if (!contractId || !userAddress || !countryCode || !assetAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (!validateCountryCode(countryCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid country code format'
      });
    }

    const sorobanServer = getSorobanRPC(rpcUrl);
    const contract = new Contract(contractId);
    const serviceAccount = getServiceAccount();

    // Get account for sequence
    const account = await sorobanServer.getAccount(serviceAccount.publicKey());

    // Prepare parameters
    const userScVal = Address.fromString(userAddress).toScVal();
    const countryCodeScVal = xdr.ScVal.scvString(countryCode);
    const assetScVal = Address.fromString(assetAddress).toScVal();

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call('get_balance', userScVal, countryCodeScVal, assetScVal))
      .setTimeout(30)
      .build();

    // Simulate (read-only)
    const simulation = await sorobanServer.simulateTransaction(transaction);
    if (simulation.errorResult) {
      return res.status(400).json({
        success: false,
        error: 'Simulation failed',
        message: simulation.errorResult.toString()
      });
    }

    // Extract balance from result
    const result = simulation.result?.retval;
    let balance = 0;
    if (result) {
      // Result is i128, extract value
      const scVal = xdr.ScVal.fromXDR(result, 'base64');
      if (scVal.switch() === xdr.ScValType.scvI128()) {
        const i128 = scVal.i128();
        balance = Number(i128.lo().low) + (Number(i128.lo().high) * 0x100000000);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Smart Wallet] Get balance completed`, {
      countryCode,
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      balance: balance
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Smart Wallet] Get balance error:', {
      error: error.message,
      duration: `${duration}ms`
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/smart-wallet/get-user-countries - Get all countries where user has balances
router.post('/get-user-countries', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      contractId,
      userAddress,
      rpcUrl
    } = req.body;

    if (!contractId || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const sorobanServer = getSorobanRPC(rpcUrl);
    const contract = new Contract(contractId);
    const serviceAccount = getServiceAccount();

    // Get account for sequence
    const account = await sorobanServer.getAccount(serviceAccount.publicKey());

    // Prepare parameters
    const userScVal = Address.fromString(userAddress).toScVal();

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call('get_user_countries', userScVal))
      .setTimeout(30)
      .build();

    // Simulate (read-only)
    const simulation = await sorobanServer.simulateTransaction(transaction);
    if (simulation.errorResult) {
      return res.status(400).json({
        success: false,
        error: 'Simulation failed',
        message: simulation.errorResult.toString()
      });
    }

    // Extract countries from result (Vec<String>)
    const result = simulation.result?.retval;
    const countries = [];
    if (result) {
      const scVal = xdr.ScVal.fromXDR(result, 'base64');
      if (scVal.switch() === xdr.ScValType.scvVec()) {
        const vec = scVal.vec();
        for (let i = 0; i < vec.length(); i++) {
          const item = vec.get(i);
          if (item.switch() === xdr.ScValType.scvString()) {
            countries.push(item.str().toString());
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Smart Wallet] Get user countries completed`, {
      duration: `${duration}ms`,
      count: countries.length
    });

    res.json({
      success: true,
      countries: countries
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Smart Wallet] Get user countries error:', {
      error: error.message,
      duration: `${duration}ms`
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/smart-wallet/get-total-balance - Get total balance across all countries
router.post('/get-total-balance', async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      contractId,
      userAddress,
      assetAddress,
      rpcUrl
    } = req.body;

    if (!contractId || !userAddress || !assetAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const sorobanServer = getSorobanRPC(rpcUrl);
    const contract = new Contract(contractId);
    const serviceAccount = getServiceAccount();

    // Get account for sequence
    const account = await sorobanServer.getAccount(serviceAccount.publicKey());

    // Prepare parameters
    const userScVal = Address.fromString(userAddress).toScVal();
    const assetScVal = Address.fromString(assetAddress).toScVal();

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call('get_total_balance', userScVal, assetScVal))
      .setTimeout(30)
      .build();

    // Simulate (read-only)
    const simulation = await sorobanServer.simulateTransaction(transaction);
    if (simulation.errorResult) {
      return res.status(400).json({
        success: false,
        error: 'Simulation failed',
        message: simulation.errorResult.toString()
      });
    }

    // Extract balance from result
    const result = simulation.result?.retval;
    let balance = 0;
    if (result) {
      const scVal = xdr.ScVal.fromXDR(result, 'base64');
      if (scVal.switch() === xdr.ScValType.scvI128()) {
        const i128 = scVal.i128();
        balance = Number(i128.lo().low) + (Number(i128.lo().high) * 0x100000000);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Smart Wallet] Get total balance completed`, {
      duration: `${duration}ms`
    });

    res.json({
      success: true,
      balance: balance
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Smart Wallet] Get total balance error:', {
      error: error.message,
      duration: `${duration}ms`
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/smart-wallet/get-countries - Get list of available countries from GeoJSON
router.get('/get-countries', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const geojsonPath = path.join(__dirname, '..', '..', 'public', 'countries.geojson');
    
    if (!fs.existsSync(geojsonPath)) {
      return res.status(404).json({
        success: false,
        error: 'countries.geojson not found'
      });
    }

    const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    const countries = [];

    for (const feature of geojson.features || []) {
      const name = feature.properties?.name || feature.properties?.NAME;
      if (!name) continue;

      // Extract ISO2 code
      let iso2 = feature.properties?.ISO2 || feature.properties?.iso_a2;
      if (!iso2) {
        const iso3 = feature.id || feature.properties?.id || feature.properties?.ISO3 || feature.properties?.iso_a3;
        if (iso3) {
          // Simple ISO3 to ISO2 conversion (would need full mapping in production)
          // For now, just use what's available
        }
      }

      if (iso2 && /^[A-Z]{2}$/.test(iso2)) {
        countries.push({
          name: String(name),
          iso2: iso2.toUpperCase()
        });
      }
    }

    // Sort by name
    countries.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      countries: countries
    });
  } catch (error) {
    console.error('[Smart Wallet] Get countries error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
