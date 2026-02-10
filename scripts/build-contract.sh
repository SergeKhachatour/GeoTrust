#!/bin/bash

set -e

echo "Building GeoTrust Match contract..."

cd contracts/geotrust-match

# Build Soroban-compatible WASM (CRITICAL: use soroban contract build, not plain cargo)
echo "Building with soroban contract build..."
soroban contract build

echo "Contract built successfully!"
echo "WASM: target/wasm32-unknown-unknown/release/geotrust_match.wasm"

# Optional: Optimize WASM (requires soroban-cli with opt feature)
if command -v soroban &> /dev/null && soroban contract optimize --help &> /dev/null; then
    echo "Optimizing WASM..."
    soroban contract optimize \
      --wasm target/wasm32-unknown-unknown/release/geotrust_match.wasm \
      --wasm-out target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm
    echo "Optimized WASM: target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm"
    
    # Get WASM hash for upgrade
    WASM_HASH=$(soroban contract hash \
      --wasm target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm)
else
    echo "Skipping optimization (soroban-cli opt feature not available)"
    # Get WASM hash for upgrade
    WASM_HASH=$(soroban contract hash \
      --wasm target/wasm32-unknown-unknown/release/geotrust_match.wasm)
fi

echo "WASM Hash: $WASM_HASH"
