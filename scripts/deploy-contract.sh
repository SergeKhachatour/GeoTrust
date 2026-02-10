#!/bin/bash

set -e

CONTRACT_WASM="contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm"
ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
NETWORK="${NETWORK:-testnet}"

if [ -z "$ADMIN_ADDRESS" ]; then
    echo "Error: ADMIN_ADDRESS environment variable not set"
    exit 1
fi

echo "Deploying GeoTrust Match contract..."
echo "Admin: $ADMIN_ADDRESS"
echo "Network: $NETWORK"

# Deploy contract
CONTRACT_ID=$(soroban contract deploy \
  --wasm "$CONTRACT_WASM" \
  --source admin \
  --network "$NETWORK" \
  --)

echo "Contract deployed: $CONTRACT_ID"

# Initialize contract
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source admin \
  --network "$NETWORK" \
  -- \
  init \
  --admin "$ADMIN_ADDRESS" \
  --default_allow_all false

echo "Contract initialized!"
echo "Contract ID: $CONTRACT_ID"
echo "Set REACT_APP_CONTRACT_ID=$CONTRACT_ID in your .env.local"
