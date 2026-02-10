# Quick Setup Guide

## Environment Variables

Create a `.env.local` file in the root directory with:

```
REACT_APP_MAPBOX_TOKEN=pk.eyJ1Ijoic2VyZ2UzNjl4MzMiLCJhIjoiY20zZHkzb2xoMDA0eTJxcHU4MTNoYjNlaCJ9.Xl6OxzF9td1IgTTeUp526w
REACT_APP_CONTRACT_ID=your_contract_id_here
```

**Note**: The Mapbox token is already set above. You'll need to add your contract ID after deploying.

## Steps Completed

✅ Dependencies installed (`npm install`)
✅ Map style changed to "Light" (`mapbox://styles/mapbox/light-v11`)
✅ Contract code fixed (u32 for country codes, proper Soroban SDK 21.0 syntax)
✅ Frontend updated to match contract changes
✅ Port set to 3366
✅ ZK proof support added for location privacy (lat/lon never stored on-chain)
✅ Contract built successfully

## Starting Locally

### Start the Frontend

Simply run:
```bash
npm start
```

The app will open at `http://localhost:3366`

## Contract Deployment

You have two main options for deploying the Soroban contract:

### Option 1: Stellar Laboratory (Recommended for Testing)

1. **Build the contract WASM** (IMPORTANT: Use Soroban CLI, not plain cargo):
   ```bash
   cd contracts/geotrust-match
   soroban contract build
   ```
   
   This produces a Soroban-compatible WASM at:
   `contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm`
   
   **⚠️ CRITICAL**: 
   - You MUST use `soroban contract build` (not `cargo build`) 
   - The `Cargo.toml` includes optimized release profile settings for Soroban
   - These settings ensure the WASM is properly formatted and optimized for size
   - Plain cargo builds produce WASM files that will fail with "reference-types not enabled" errors
   
   **Optional - Optimize for smaller size**:
   ```bash
   # Install soroban-cli with opt feature
   cargo install --locked soroban-cli --features opt
   
   # Optimize the WASM
   soroban contract optimize \
     --wasm target/wasm32-unknown-unknown/release/geotrust_match.wasm \
     --wasm-out target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm
   ```
   Then use the `_optimized.wasm` file for deployment.

2. **Go to Stellar Laboratory**:
   - Visit: https://laboratory.stellar.org/
   - Select "Soroban" tab
   - Connect your wallet (Freighter)

3. **Deploy Contract**:
   - Click "Deploy Contract"
   - Upload the WASM file: `contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm`
     (or the `_optimized.wasm` version if you optimized it)
   - **Make sure you used `soroban contract build`** - plain cargo builds won't work!
   - Click "Deploy"

4. **Initialize Contract**:
   - After deployment, copy the contract ID
   - Go to "Invoke Contract" tab
   - Select your contract
   - Call `init` function with:
     - `admin`: Your Stellar account address (G...)
     - `default_allow_all`: `false` (or `true` if you want all countries allowed by default)
   - Click "Invoke"

5. **Add Contract ID to .env.local**:
   ```
   REACT_APP_CONTRACT_ID=your_contract_id_from_lab
   ```

### Option 2: Soroban CLI (Advanced)

1. **Install Soroban CLI** (if not already installed):
   ```bash
   cargo install --locked soroban-cli
   ```

2. **Set up your keys**:
   ```bash
   soroban keys generate
   soroban keys fund --network testnet
   ```

3. **Build and deploy**:
   ```bash
   # Build
   ./scripts/build-contract.sh
   
   # Deploy (replace YOUR_ADMIN_ADDRESS with your Stellar address)
   export ADMIN_ADDRESS="YOUR_ADMIN_ADDRESS"
   ./scripts/deploy-contract.sh
   ```

4. **Add contract ID to .env.local**

## After Deployment

1. **Set Game Hub** (optional, if you have a Game Hub contract):
   - In Stellar Lab: Invoke `set_game_hub` with your Game Hub contract address
   - Or via CLI: `soroban contract invoke --id YOUR_CONTRACT_ID -- set_game_hub --game_hub GAME_HUB_ADDRESS`

2. **Configure countries** (as admin):
   - Use the admin panel in the frontend (appears when you connect as admin)
   - Or invoke `set_country_allowed` in Stellar Lab

3. **Start playing**:
   - Connect your wallet in the frontend
   - Click "Share Location / Join Game"
   - The app will automatically generate ZK proofs to protect your location privacy

## ZK Proof Features

The contract now supports **zero-knowledge proofs** to protect location privacy:

- **Latitude/longitude are NEVER stored on-chain** - only a discretized `cell_id` (grid cell)
- **ZK proofs** prove the `cell_id` is correctly derived from lat/lon without revealing exact coordinates
- **Privacy-first design** - your exact location remains private

### How It Works

1. Frontend gets your location (lat/lon) via browser geolocation
2. Generates a ZK proof that proves `cell_id` is correct (without revealing lat/lon)
3. Submits proof + `cell_id` to contract
4. Contract validates and stores only the `cell_id` (not lat/lon)

### ZK Circuit

The Noir circuit is located at `circuits/location-proof/`:
- Proves cell_id calculation is correct
- Validates lat/lon are within valid ranges
- Keeps coordinates completely private

For more details, see `ZK_PROOF_GUIDE.md`.