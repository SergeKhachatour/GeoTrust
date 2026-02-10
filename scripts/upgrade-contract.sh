#!/bin/bash

set -e

CONTRACT_ID="${CONTRACT_ID:-}"
CONTRACT_WASM="contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm"
NETWORK="${NETWORK:-testnet}"

if [ -z "$CONTRACT_ID" ]; then
    echo "Error: CONTRACT_ID environment variable not set"
    exit 1
fi

echo "Upgrading contract: $CONTRACT_ID"
echo "Network: $NETWORK"

# Get WASM hash
WASM_HASH=$(soroban contract hash --wasm "$CONTRACT_WASM")
echo "WASM Hash: $WASM_HASH"

# Upgrade contract
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source admin \
  --network "$NETWORK" \
  -- \
  upgrade \
  --new_wasm_hash "$WASM_HASH"

echo "Contract upgraded successfully!"
