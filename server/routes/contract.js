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
function getSorobanRPC() {
  const rpcUrl = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  return new rpc.Server(rpcUrl);
}

// Get contract instance
function getContract(contractId) {
  return new Contract(contractId);
}

// POST /api/contract/readonly - Execute read-only contract function
router.post('/readonly', async (req, res) => {
  const startTime = Date.now();
  try {
    const { contractId, functionName, parameters } = req.body;
    
    // Log the request with details
    console.log(`[Contract ReadOnly] ${functionName} called`, {
      contractId: contractId?.substring(0, 8) + '...',
      functionName,
      parameters: parameters ? `${parameters.length} params` : 'none',
      ip: req.ip || req.connection.remoteAddress,
    });
    
    if (!contractId || !functionName) {
      console.warn(`[Contract ReadOnly] Missing required fields:`, { contractId: !!contractId, functionName: !!functionName });
      return res.status(400).json({ 
        error: 'Missing required fields: contractId, functionName' 
      });
    }

    const sorobanServer = getSorobanRPC();
    const contract = getContract(contractId);
    const serviceAccount = getServiceAccount();
    
    // Get account for sequence number
    const account = await sorobanServer.getAccount(serviceAccount.publicKey());
    
    // Convert parameters to ScVal
    const scValParams = [];
    if (parameters && Array.isArray(parameters)) {
      for (const param of parameters) {
        // Handle typed parameters from frontend
        if (param && typeof param === 'object' && param.type) {
          if (param.type === 'u32') {
            scValParams.push(xdr.ScVal.scvU32(param.value));
          } else if (param.type === 'address') {
            scValParams.push(Address.fromString(param.value).toScVal());
          } else if (param.type === 'bool') {
            scValParams.push(xdr.ScVal.scvBool(param.value));
          } else {
            scValParams.push(nativeToScVal(param.value));
          }
        } else if (typeof param === 'number') {
          // Default to u32 for numbers
          scValParams.push(xdr.ScVal.scvU32(param));
        } else if (typeof param === 'boolean') {
          scValParams.push(xdr.ScVal.scvBool(param));
        } else if (typeof param === 'string') {
          // Try as address first (Stellar addresses are 56 chars)
          if (param.length === 56 && (param.startsWith('G') || param.startsWith('C'))) {
            try {
              scValParams.push(Address.fromString(param).toScVal());
            } catch {
              // If not an address, treat as string
              scValParams.push(xdr.ScVal.scvString(param));
            }
          } else {
            scValParams.push(xdr.ScVal.scvString(param));
          }
        } else {
          scValParams.push(nativeToScVal(param));
        }
      }
    }
    
    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(functionName, ...scValParams))
      .setTimeout(30)
      .build();
    
    // Simulate first (read-only)
    const simulation = await sorobanServer.simulateTransaction(transaction);
    
    if (simulation.errorResult) {
      return res.status(400).json({
        error: 'Simulation failed',
        message: simulation.errorResult.toString(),
      });
    }
    
    // Return simulation result (read-only, no need to submit)
    const result = simulation.result?.retval;
    
    // Convert ScVal to a serializable format
    // The result is already an ScVal XDR buffer, convert to base64
    let serializedResult = null;
    if (result) {
      // result is already a Buffer/Uint8Array from XDR, convert to base64
      if (Buffer.isBuffer(result)) {
        serializedResult = result.toString('base64');
      } else if (result instanceof Uint8Array) {
        serializedResult = Buffer.from(result).toString('base64');
      } else {
        // If it's already an ScVal object, serialize it
        serializedResult = result.toXDR('base64');
      }
    }
    
    const duration = Date.now() - startTime;
    const resultSize = serializedResult ? serializedResult.length : 0;
    
    console.log(`[Contract ReadOnly] ${functionName} completed`, {
      duration: `${duration}ms`,
      resultSize: `${resultSize} bytes`,
      success: true,
    });
    
    res.json({
      success: true,
      result: serializedResult, // Send as base64 XDR string
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Contract ReadOnly] ${req.body.functionName || 'unknown'} error:`, {
      error: error.message,
      duration: `${duration}ms`,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
    res.status(500).json({
      error: 'Failed to execute read-only function',
      message: error.message,
    });
  }
});

module.exports = router;
