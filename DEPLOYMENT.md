# Deployment Guide

## Prerequisites

1. **Soroban CLI**: Install from [Stellar Docs](https://soroban.stellar.org/docs/getting-started/setup)
2. **Rust**: Install with `wasm32-unknown-unknown` target
3. **Node.js**: 18+ for frontend
4. **Mapbox Token**: Get from [mapbox.com](https://www.mapbox.com)

## Step 1: Build Contract

```bash
chmod +x scripts/build-contract.sh
./scripts/build-contract.sh
```

This will:
- Build the contract WASM
- Optimize it for deployment
- Output the WASM hash for upgrades

## Step 2: Deploy Contract

```bash
# Set your admin address (Stellar account)
export ADMIN_ADDRESS="G..."

# Deploy
chmod +x scripts/deploy-contract.sh
./scripts/deploy-contract.sh
```

The script will:
- Deploy the contract to testnet
- Initialize it with your admin address
- Output the contract ID

## Step 3: Configure Frontend

1. Copy `.env.local.example` to `.env.local`
2. Add your values:
   ```
   REACT_APP_MAPBOX_TOKEN=your_mapbox_token
   REACT_APP_CONTRACT_ID=your_contract_id_from_step_2
   ```

## Step 4: Set Game Hub (Optional)

If you have a Game Hub contract:

```bash
soroban contract invoke \
  --id YOUR_CONTRACT_ID \
  --source admin \
  --network testnet \
  -- \
  set_game_hub \
  --game_hub GAME_HUB_ADDRESS
```

## Step 5: Run Frontend

```bash
npm install
npm start
```

## Upgrading Contract

After making changes to the contract:

```bash
# Rebuild
./scripts/build-contract.sh

# Upgrade
export CONTRACT_ID="C..."
chmod +x scripts/upgrade-contract.sh
./scripts/upgrade-contract.sh
```

## Admin Operations

### Allow a Country

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

### Set Default Policy

```bash
# Allow all by default
soroban contract invoke \
  --id YOUR_CONTRACT_ID \
  --source admin \
  --network testnet \
  -- \
  set_default_allow_all \
  --value true
```

## Testing

### Contract Tests

```bash
cd contracts/geotrust-match
cargo test
```

### ZK Circuit

```bash
cd circuits/country-restriction
nargo prove
nargo verify
```

## Troubleshooting

### Contract deployment fails
- Ensure you have XLM in your admin account
- Check network (testnet vs mainnet)
- Verify Soroban CLI is up to date

### Frontend can't connect
- Check `.env.local` has correct contract ID
- Verify Freighter wallet is installed and connected
- Check browser console for errors

### Country overlay not showing
- Ensure `public/countries.geojson` exists
- Check Mapbox token is valid
- Verify contract has country data
