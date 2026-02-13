#!/bin/bash

set -e

# Configuration
CONTRACT_ID="${CONTRACT_ID:-}"
NETWORK="${NETWORK:-testnet}"
CONTRACT_DIR="contracts/geotrust-match"
BUILD_DIR="$CONTRACT_DIR/target/wasm32-unknown-unknown/release"
WASM_FILE="$BUILD_DIR/geotrust_match.wasm"
WASM_OPTIMIZED="$BUILD_DIR/geotrust_match_optimized.wasm"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if CONTRACT_ID is set
if [ -z "$CONTRACT_ID" ]; then
    print_error "CONTRACT_ID environment variable not set"
    echo ""
    echo "Usage:"
    echo "  export CONTRACT_ID=\"C...\""
    echo "  ./scripts/upgrade-contract.sh"
    echo ""
    echo "Or set it inline:"
    echo "  CONTRACT_ID=\"C...\" ./scripts/upgrade-contract.sh"
    exit 1
fi

print_info "Starting contract upgrade process..."
echo ""
print_info "Contract ID: $CONTRACT_ID"
print_info "Network: $NETWORK"
echo ""

# Step 1: Build the contract
print_info "Step 1: Building contract..."
cd "$CONTRACT_DIR" || exit 1

if ! soroban contract build; then
    print_error "Contract build failed!"
    exit 1
fi

print_success "Contract built successfully"
echo ""

# Step 2: Check if optimization is available and optimize if possible
cd - > /dev/null || exit 1
WASM_TO_USE="$WASM_FILE"

if command -v soroban &> /dev/null && soroban contract optimize --help &> /dev/null 2>&1; then
    print_info "Step 2: Optimizing WASM..."
    if soroban contract optimize \
        --wasm "$WASM_FILE" \
        --wasm-out "$WASM_OPTIMIZED" 2>/dev/null; then
        WASM_TO_USE="$WASM_OPTIMIZED"
        print_success "WASM optimized successfully"
    else
        print_warning "Optimization failed or not available, using unoptimized WASM"
    fi
else
    print_warning "Optimization not available, using unoptimized WASM"
fi
echo ""

# Step 3: Get WASM hash
print_info "Step 3: Calculating WASM hash..."
if ! WASM_HASH=$(soroban contract hash --wasm "$WASM_TO_USE" 2>/dev/null); then
    print_error "Failed to get WASM hash!"
    exit 1
fi

print_success "WASM Hash: $WASM_HASH"
echo ""

# Step 4: Verify contract exists and get current admin
print_info "Step 4: Verifying contract and admin access..."
if ! soroban contract invoke \
    --id "$CONTRACT_ID" \
    --source admin \
    --network "$NETWORK" \
    -- \
    get_admin \
    > /dev/null 2>&1; then
    print_warning "Could not verify admin access (this is okay, continuing...)"
else
    print_success "Contract and admin access verified"
fi
echo ""

# Step 5: Upgrade the contract
print_info "Step 5: Upgrading contract..."
print_warning "This will update the contract WASM. Press Ctrl+C to cancel..."
sleep 2

if soroban contract invoke \
    --id "$CONTRACT_ID" \
    --source admin \
    --network "$NETWORK" \
    -- \
    upgrade \
    --new_wasm_hash "$WASM_HASH"; then
    print_success "Contract upgraded successfully!"
else
    print_error "Contract upgrade failed!"
    exit 1
fi
echo ""

# Step 6: Verify the upgrade (check if new functions are available)
print_info "Step 6: Verifying upgrade..."
sleep 2  # Wait a moment for the upgrade to propagate

# Try to call get_game_hub to verify the new function is available
if soroban contract invoke \
    --id "$CONTRACT_ID" \
    --source admin \
    --network "$NETWORK" \
    -- \
    get_game_hub \
    > /dev/null 2>&1; then
    print_success "Upgrade verified! New functions are available."
else
    print_warning "Could not verify new functions (they may not be available yet or contract may not have Game Hub set)"
fi
echo ""

# Summary
print_success "Upgrade process completed!"
echo ""
print_info "Summary:"
echo "  Contract ID: $CONTRACT_ID"
echo "  Network: $NETWORK"
echo "  WASM Hash: $WASM_HASH"
echo "  WASM File: $WASM_TO_USE"
echo ""
print_info "The contract has been upgraded with the latest changes:"
echo "  ✅ Added get_game_hub() function"
echo "  ✅ Enhanced Game Hub verification"
echo "  ✅ Improved logging for start_game/end_game calls"
echo ""
print_info "Next steps:"
echo "  1. The frontend will automatically detect the new get_game_hub function"
echo "  2. Check the browser console for Game Hub verification messages"
echo "  3. Test by creating a session and verifying start_game is called"
echo "  4. Test by resolving a match and verifying end_game is called"
echo ""
