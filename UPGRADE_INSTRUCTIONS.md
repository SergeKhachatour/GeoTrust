# Contract Upgrade Instructions

## Why Upgrade Instead of Deploy?

✅ **Upgrade** (Recommended):
- Keeps the same contract ID
- Preserves all existing data (sessions, country policies, admin, Game Hub, verifier)
- No need to update frontend `.env.local`
- No need to re-initialize or reconfigure

❌ **New Deployment**:
- Creates a new contract ID
- Loses all existing data
- Requires updating frontend config
- Requires re-initialization and reconfiguration

## Step 1: Build the Updated Contract

```bash
cd contracts/geotrust-match
soroban contract build
```

If you have optimization enabled:
```bash
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/geotrust_match.wasm \
  --wasm-out target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm
```

## Step 2: Get the WASM Hash

```bash
# If optimized:
soroban contract hash --wasm target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm

# If not optimized:
soroban contract hash --wasm target/wasm32-unknown-unknown/release/geotrust_match.wasm
```

Copy the hash (it's a 32-byte hex string).

## Step 3: Upgrade the Contract

### Option A: Using the Automated Upgrade Script (Recommended)

**On Linux/Mac:**
```bash
# Set your contract ID
export CONTRACT_ID="C..."  # Your existing contract ID
export NETWORK="testnet"   # Optional, defaults to testnet

# Make script executable (if not already)
chmod +x scripts/upgrade-contract.sh

# Run upgrade script (it will build, optimize, and upgrade automatically)
./scripts/upgrade-contract.sh
```

**On Windows (PowerShell):**
```powershell
# Set your contract ID
$env:CONTRACT_ID = "C..."  # Your existing contract ID
$env:NETWORK = "testnet"   # Optional, defaults to testnet

# Run upgrade script (it will build, optimize, and upgrade automatically)
.\scripts\upgrade-contract.ps1
```

The script will:
1. ✅ Build the contract
2. ✅ Optimize the WASM (if available)
3. ✅ Calculate the WASM hash
4. ✅ Verify contract and admin access
5. ✅ Upgrade the contract
6. ✅ Verify the upgrade succeeded

### Option B: Manual Upgrade Using Soroban CLI

```bash
# Set your contract ID
export CONTRACT_ID="C..."  # Your existing contract ID

# Upgrade (replace WASM_HASH with the hash from Step 2)
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source admin \
  --network testnet \
  -- \
  upgrade \
  --new_wasm_hash WASM_HASH
```

### Option C: Using Stellar Laboratory

1. Go to https://laboratory.stellar.org/
2. Click the **"Soroban"** tab
3. Connect your **Freighter** wallet (must be the admin)
4. Click **"Invoke Contract"**
5. Select your contract ID
6. Choose the `upgrade` function
7. Enter the WASM hash from Step 2
8. Click **"Invoke"**

## Step 4: Verify the Upgrade

After upgrading, verify the new function is available:

```bash
# Check if get_game_hub is now available
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source admin \
  --network testnet \
  -- \
  get_game_hub
```

Or check in the frontend console - it should now be able to verify Game Hub status.

## What Changed in This Update?

1. ✅ Added `get_game_hub()` function to check Game Hub configuration
2. ✅ Enhanced Game Hub verification in frontend
3. ✅ Added "Resolve Match" button to trigger `end_game`
4. ✅ Added logging to track Game Hub calls

## Important Notes

- ⚠️ The upgrade requires admin authentication
- ⚠️ All existing data (sessions, policies, etc.) is preserved
- ⚠️ The contract ID stays the same - no frontend changes needed
- ⚠️ After upgrade, `get_game_hub` will be available to verify Game Hub status

## Troubleshooting

If upgrade fails:
1. Make sure you're using the admin account
2. Check that the WASM hash is correct (32 bytes, hex format)
3. Verify the contract ID is correct
4. Ensure you have enough XLM for transaction fees
