# ZK Proof Guide for Location Privacy

## Overview

The contract now supports ZK proofs to hide exact latitude/longitude coordinates on-chain. Instead of storing raw coordinates, players submit:

1. **Cell ID** (public) - The discretized grid cell
2. **ZK Proof** (public) - Proves cell_id is correctly derived from lat/lon
3. **Public Inputs** (public) - cell_id and grid_size for verification

The actual **latitude and longitude remain private** and are never stored on-chain.

## Architecture

### ZK Circuit (`circuits/location-proof/`)

The Noir circuit proves:
- Cell ID is correctly calculated from lat/lon
- Lat/lon are within valid ranges (-90 to 90, -180 to 180)
- Without revealing the exact coordinates

**Private Inputs:**
- `latitude`: Scaled by 1e6 (e.g., 40000000 for 40.0°)
- `longitude`: Scaled by 1e6 (e.g., -74000000 for -74.0°)

**Public Inputs:**
- `cell_id`: The calculated grid cell ID
- `grid_size`: Grid size scaled by 1e6 (e.g., 1000000 for 1.0°)

### Contract Changes

The `join_session` function now accepts an optional `LocationProof`:

```rust
pub fn join_session(
    env: Env,
    caller: Address,
    session_id: u32,
    cell_id: u32,
    asset_tag: BytesN<32>,
    country: u32,
    location_proof: Option<LocationProof>, // NEW: ZK proof
)
```

The contract:
1. Validates public inputs match the provided cell_id
2. Stores the proof (for future verification)
3. For MVP: Proof verification is optional (can be added via verifier contract)

### Frontend Integration

The frontend automatically generates proofs when joining:

```typescript
import { generateLocationProof } from './zk-proof';

const locationProof = await generateLocationProof(latitude, longitude);
await contractClient.joinSession(sessionId, cellId, assetTag, country, {
  proof: locationProof.proof,
  publicInputs: [cellId, gridSize]
});
```

## Generating Proofs

### Using Noir CLI

1. **Install Noir**:
   ```bash
   cargo install nargo
   ```

2. **Navigate to circuit**:
   ```bash
   cd circuits/location-proof
   ```

3. **Generate proof**:
   ```bash
   nargo prove
   ```

4. **Verify proof**:
   ```bash
   nargo verify
   ```

### Proof Generation in Frontend

For MVP, the frontend uses a mock proof generator. To integrate actual Noir proofs:

1. **Option 1: Use noir-wasm** (browser-based):
   ```bash
   npm install @noir-lang/noir_wasm
   ```

2. **Option 2: Use Noir.js** (if available):
   ```bash
   npm install @noir-lang/noir_js
   ```

3. **Option 3: Generate proofs server-side**:
   - Create a proof generation service
   - Frontend sends lat/lon (over HTTPS)
   - Service generates proof and returns it

## On-Chain Verification

### Current Implementation (Protocol 25)

**Status:** ✅ **Full Cryptographic Verification** - Using Protocol 25 BN254 pairing

**What's Verified:**
- ✅ **BN254 Pairing**: `e(A, B) = e(alpha, beta) * e(C, gamma) * e(IC_sum, delta)`
- ✅ **Public Inputs**: Match expected cell_id and circuit constraints
- ✅ **Proof Structure**: G1/G2 point deserialization and validation
- ✅ **VK Structure**: Full verification key validation
- ✅ **IC Commitments**: Computed using `g1_add` and `g1_mul`
- ✅ **Replay Protection**: SHA256-based proof ID tracking

**SDK Version:** `soroban-sdk = "25.0.0"`

**Implementation:**
- Uses `env.crypto().bn254().pairing_check()` for Groth16 verification
- Uses `Bn254G1Affine` and `Bn254G2Affine` for point operations
- Uses SHA256 for proof IDs (Poseidon available with `hazmat-crypto` feature)

See [PROTOCOL_25_IMPLEMENTATION.md](./PROTOCOL_25_IMPLEMENTATION.md) for implementation details.

### Verifier Contract Setup

1. **Deploy Verifier Contract**:
   ```bash
   cd contracts/zk-verifier
   soroban contract build
   # Deploy via Stellar Lab
   ```

2. **Set Verifier Address**:
   ```bash
   soroban contract invoke \
     --id YOUR_CONTRACT_ID \
     --source admin \
     --network testnet \
     -- \
     set_verifier \
     --verifier VERIFIER_CONTRACT_ADDRESS
   ```

3. **Contract Auto-Verifies**:
   - When proof is provided, contract calls verifier
   - Only accepts join if proof is valid

## Privacy Benefits

✅ **Latitude/longitude never stored on-chain**
✅ **Only cell_id (coarse grid) is public**
✅ **Proof ensures cell_id is legitimate**
✅ **Players can't fake their location**

## Grid Size Considerations

- **1.0 degree grid**: ~111 km resolution (current)
- **0.1 degree grid**: ~11 km resolution (more precise)
- **0.01 degree grid**: ~1.1 km resolution (very precise)

Smaller grids provide better location accuracy but:
- Require more computation for proofs
- May reveal more location information
- Consider privacy vs. gameplay needs

## Example Usage

```typescript
// Player at 40.7128°N, 74.0060°W (New York)
const lat = 40.7128;
const lng = -74.0060;

// Generate proof
const proof = await generateLocationProof(lat, lng, 1.0);

// Join session with proof
await contract.joinSession(
  sessionId,
  proof.publicInputs.cellId, // Cell ID from proof
  assetTag,
  countryCode,
  {
    proof: proof.proof,
    publicInputs: [proof.publicInputs.cellId, proof.publicInputs.gridSize]
  }
);
```

## Security Notes

- **Proof generation must be client-side** to keep lat/lon private
- **Never send lat/lon to server** (except over encrypted HTTPS for proof generation service)
- **Verify proofs on-chain** in production for security
- **Consider rate limiting** to prevent proof spam

## Future Enhancements

1. **Distance proofs**: Prove two players are within X km without revealing locations
2. **Merkle tree proofs**: Prove location is in a specific region
3. **Multi-location proofs**: Prove player visited multiple locations
4. **Time-based proofs**: Prove location at specific time
