# Contract Deployment Guide

## Prerequisites

- Stellar account with XLM (for fees)
- Freighter wallet installed
- Contract WASM built

## Method 1: Stellar Laboratory (Easiest)

### Step 1: Build the Contract

**⚠️ CRITICAL**: You MUST use `soroban contract build` (not `cargo build`) to create a Soroban-compatible WASM file. Plain cargo builds will fail in Stellar Lab with "reference-types not enabled" errors.

```bash
cd contracts/geotrust-match
soroban contract build
```

The WASM file will be at:
`contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm`

**Optional - Optimize the WASM** (smaller file size, requires soroban-cli with opt feature):
```bash
# Install with opt feature
cargo install --locked soroban-cli --features opt

# Optimize
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/geotrust_match.wasm --wasm-out target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm
```

Then use the `_optimized.wasm` file for deployment.

### Step 2: Deploy via Stellar Lab

1. Go to https://laboratory.stellar.org/
2. Click the **"Soroban"** tab
3. Connect your **Freighter** wallet
4. Click **"Deploy Contract"**
5. Upload the optimized WASM file
6. Click **"Deploy"**
7. **Copy the contract ID** (starts with `C...`)

### Step 3: Initialize the Contract

1. In Stellar Lab, go to **"Invoke Contract"** tab
2. Select your deployed contract
3. Call the `init` function:
   - **admin**: Your Stellar account address (G...)
   - **default_allow_all**: `false` (or `true` to allow all countries by default)
4. Click **"Invoke"**

### Step 4: Update Frontend Config

Add the contract ID to `.env.local`:
```
REACT_APP_CONTRACT_ID=your_contract_id_here
```

## Method 2: Soroban CLI

### Step 1: Install Soroban CLI

```bash
cargo install --locked soroban-cli
```

### Step 2: Set Up Keys

```bash
# Generate a key (or use existing)
soroban keys generate

# Fund the account (testnet only)
soroban keys fund --network testnet
```

### Step 3: Deploy

```bash
# Set your admin address
export ADMIN_ADDRESS="G..."

# Build and deploy
./scripts/build-contract.sh
./scripts/deploy-contract.sh
```

The script will output the contract ID.

## Post-Deployment Setup

### Set Game Hub (Optional)

If you have a Game Hub contract:

**Via Stellar Lab:**
1. Invoke `set_game_hub`
2. Parameter: `game_hub` = Your Game Hub contract address

**Via CLI:**
```bash
soroban contract invoke \
  --id YOUR_CONTRACT_ID \
  --source admin \
  --network testnet \
  -- \
  set_game_hub \
  --game_hub GAME_HUB_ADDRESS
```

### Allow Countries (Admin Only)

**Via Frontend:**
- Connect as admin wallet
- Use the admin panel to toggle countries

**Via Stellar Lab:**
1. Invoke `set_country_allowed`
2. Parameters:
   - `country`: ISO numeric code (e.g., 840 for US)
   - `allowed`: `true` or `false`

**Via CLI:**
```bash
soroban contract invoke \
  --id YOUR_CONTRACT_ID \
  --source admin \
  --network testnet \
  -- \
  set_country_allowed \
  --country 840 \
  --allowed true
```

## Testing the Deployment

1. Start the frontend: `npm start`
2. Connect your wallet
3. Try creating a session
4. If you're the admin, you should see the admin panel

## Troubleshooting

### "Contract not found"
- Verify contract ID in `.env.local`
- Ensure contract is deployed to the same network (testnet/mainnet)

### "Country not allowed"
- Check country policy: `get_country_policy()`
- Allow your country via admin panel or `set_country_allowed`

### "Admin required"
- Ensure you're using the admin wallet
- Verify admin address: `get_admin()`

## Network Selection

- **Testnet**: Use for development/testing
- **Mainnet**: Use for production (requires real XLM)

Make sure your frontend and contract are on the same network!
