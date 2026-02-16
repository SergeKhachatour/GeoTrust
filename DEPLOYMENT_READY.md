# Deployment Ready - Protocol 25 Contracts

## ✅ Both Contracts Built Successfully

### Contract Files Ready for Deployment

1. **ZK Verifier Contract**
   - Path: `contracts/zk-verifier/target/wasm32-unknown-unknown/release/zk_verifier.wasm`
   - SDK: `soroban-sdk = "25.0.0"`
   - Features: Protocol 25 BN254 pairing, Groth16 verification

2. **Main Contract (GeoTrust Match)**
   - Path: `contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm`
   - SDK: `soroban-sdk = "25.0.0"`
   - Features: Session management, country gating, Game Hub integration

## Deployment Steps

### 1. Deploy ZK Verifier Contract

1. Go to [Stellar Laboratory](https://laboratory.stellar.org/)
2. Navigate to "Deploy Contract"
3. Upload: `contracts/zk-verifier/target/wasm32-unknown-unknown/release/zk_verifier.wasm`
4. Deploy to **Testnet**
5. Copy the contract ID (starts with `C...`)

### 2. Initialize ZK Verifier

After deployment, initialize the contract:
```bash
soroban contract invoke \
  --id ZK_VERIFIER_CONTRACT_ID \
  --source YOUR_ADMIN_KEY \
  --network testnet \
  -- \
  init \
  --admin YOUR_ADMIN_ADDRESS
```

### 3. Deploy Main Contract

1. Go to [Stellar Laboratory](https://laboratory.stellar.org/)
2. Navigate to "Deploy Contract"
3. Upload: `contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm`
4. Deploy to **Testnet**
5. Copy the contract ID (starts with `C...`)

### 4. Initialize Main Contract

After deployment, initialize the contract:
```bash
soroban contract invoke \
  --id MAIN_CONTRACT_ID \
  --source YOUR_ADMIN_KEY \
  --network testnet \
  -- \
  init \
  --admin YOUR_ADMIN_ADDRESS \
  --default_allow_all false
```

### 5. Configure Contracts

Link the verifier to the main contract:
```bash
soroban contract invoke \
  --id MAIN_CONTRACT_ID \
  --source YOUR_ADMIN_KEY \
  --network testnet \
  -- \
  set_verifier \
  --verifier ZK_VERIFIER_CONTRACT_ID
```

## Environment Variables

After deployment, update `.env.local` with:

```env
# Mapbox Configuration
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here

# Contract IDs (update after deployment)
REACT_APP_CONTRACT_ID=YOUR_MAIN_CONTRACT_ID
REACT_APP_VERIFIER_ID=YOUR_VERIFIER_CONTRACT_ID
```

## About "Ethereum-Compatible" ZK Tooling

**What it means:**
- BN254 (also called alt_bn128) is the **same elliptic curve** used by Ethereum
- Ethereum's EIP-196 and EIP-197 precompiles use BN254
- ZK proof generation tools like **circom**, **snarkjs**, **arkworks** work with both:
  - Ethereum (via EIP-196/EIP-197 precompiles)
  - Stellar Protocol 25 (via native BN254 operations)

**Why this matters:**
- You can use the **same proof generation tools** for both chains
- No need to rewrite circuits for different curves
- Interoperable with existing Ethereum ZK ecosystem
- Same cryptographic security guarantees

**Example tools that work on both:**
- `circom` - Circuit compiler
- `snarkjs` - Proof generation and verification
- `arkworks` - Rust ZK libraries
- Any tool that generates BN254-based Groth16 proofs

**This is on Stellar**, but the cryptographic primitives (BN254 curve) are the same as Ethereum, so the tooling ecosystem is shared.

## Protocol 25 Features Implemented

✅ **BN254 Pairing Operations**
- `env.crypto().bn254().pairing_check()` - Groth16 verification
- `bn254.g1_add()` - G1 point addition
- `bn254.g1_mul()` - G1 scalar multiplication

✅ **Full Groth16 Verification**
- Deserializes proof points (A, B, C)
- Computes IC_sum using point operations
- Verifies pairing equation cryptographically

✅ **Production Ready**
- Complete verification logic
- Replay protection
- VK management
- Admin controls

## Ready for Deployment! 🚀

Both contracts are built and ready to deploy to Stellar Testnet via Stellar Laboratory.
