# ZK Verifier Contract Deployment Guide

## Overview

The ZK Verifier contract is a separate Soroban contract that verifies zero-knowledge proofs for location privacy. It's deployed separately and then configured in the main GeoTrust Match contract.

## Building the Verifier Contract

```bash
cd contracts/zk-verifier
soroban contract build
```

The optimized WASM will be at:
```
contracts/zk-verifier/target/wasm32-unknown-unknown/release/zk_verifier.wasm
```

## Deploying to Stellar Testnet

### Option 1: Using Stellar Laboratory

1. Go to https://laboratory.stellar.org/
2. Switch to **Testnet**
3. Navigate to **Soroban** → **Deploy Contract**
4. Upload the WASM file: `contracts/zk-verifier/target/wasm32-unknown-unknown/release/zk_verifier.wasm`
5. Click **Deploy**
6. Copy the contract ID (you'll need this for the next step)

### Option 2: Using Soroban CLI

```bash
# Make sure you're on testnet
soroban config network set testnet

# Deploy the contract
soroban contract deploy \
  --wasm contracts/zk-verifier/target/wasm32-unknown-unknown/release/zk_verifier.wasm \
  --source admin \
  --network testnet
```

## Initializing the Verifier Contract

After deployment, you need to initialize it with an admin address:

```bash
soroban contract invoke \
  --id <VERIFIER_CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- \
  init \
  --admin <ADMIN_ADDRESS>
```

Replace:
- `<VERIFIER_CONTRACT_ID>` with the contract ID from deployment
- `<ADMIN_ADDRESS>` with your admin Stellar address (e.g., `GDJMPSG63NX546H2XSPKFQYIJVM46DCA6MUM2NPEOAZJ7WKY6ZZ64GQM`)

## Configuring the Main Contract

Once the verifier is deployed and initialized, configure the main GeoTrust Match contract to use it:

```bash
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --source admin \
  --network testnet \
  -- \
  set_verifier \
  --verifier <VERIFIER_CONTRACT_ID>
```

## How It Works

### Current Implementation (MVP)

The verifier contract currently performs simplified verification:
1. Checks that the proof is non-zero (not empty)
2. Verifies that the public inputs match the expected `cell_id`
3. Returns `true` if both checks pass

### Future Implementation

In production, the verifier would:
1. Deserialize the ZK proof
2. Verify it against the circuit's verification key
3. Check that public inputs match the proof
4. Return `true` only if the proof is cryptographically valid

## Testing the Verifier

You can test the verifier contract directly:

```bash
# Create a test proof (mock)
# Note: In production, proofs would come from the Noir circuit

# Verify a proof
soroban contract invoke \
  --id <VERIFIER_CONTRACT_ID> \
  --network testnet \
  -- \
  verify \
  --proof <PROOF_BYTES> \
  --expected_cell_id 12345
```

## Frontend Integration

Once the verifier is configured, the frontend will automatically:
1. Generate ZK proofs when users share their location
2. Include proofs in `join_session` calls
3. The contract will verify proofs via the verifier contract

## Troubleshooting

### "Verifier not configured" error
- Make sure you've called `set_verifier` on the main contract
- Verify the verifier contract ID is correct

### "Proof verification failed" error
- Check that proofs are being generated correctly
- Verify the proof format matches what the verifier expects
- Ensure public inputs match the `cell_id`

### Contract not found
- Make sure the verifier contract is deployed to the same network (testnet)
- Verify the contract ID is correct

## Notes

- The verifier contract is upgradeable (admin can call `set_admin`)
- For MVP, verification is simplified - in production, use a real ZK proof verification library
- The verifier can verify proofs in batch using `verify_batch`
