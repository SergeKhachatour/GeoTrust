# Contract Upgrade Guide

## ✅ Contracts Compiled Successfully

Both contracts have been fixed and compiled:
- ✅ `geotrust-match` - Security fixes + Country-specific admin feature
- ✅ `zk-verifier` - Security fixes

## Using the Upgrade Script

The `scripts\upgrade-contract.ps1` script will automatically:
1. Build the contract
2. Optimize the WASM (if available)
3. Install WASM to the ledger
4. Calculate the WASM hash
5. Call the `upgrade()` function

### Quick Start

```powershell
# Option 1: Set environment variables first
$env:CONTRACT_ID = "C..."  # Your contract ID
$env:NETWORK = "testnet"   # or "mainnet"

# Then run the script
.\scripts\upgrade-contract.ps1
```

### Option 2: Interactive Mode

```powershell
# Just run the script - it will prompt for missing values
.\scripts\upgrade-contract.ps1
```

The script will ask you for:
- Contract ID (if not set in environment)
- Network (testnet/mainnet/futurenet)
- Admin identity (for signing the upgrade transaction)

## What Gets Upgraded

### geotrust-match Contract

**New Features:**
- ✅ Country-specific admin management
- ✅ `set_country_admin(country, admin)` - Assign country admin
- ✅ `remove_country_admin(country)` - Remove country admin  
- ✅ `get_country_admin(country)` - Get country admin

**Security Fixes:**
- ✅ Integer overflow protection
- ✅ Safe error handling (no unsafe unwrap)
- ✅ Safe Map access
- ✅ Bounded loops
- ✅ Proper TTL expiration

**Backward Compatibility:**
- ✅ All existing functions work the same
- ✅ Main admin retains full control
- ✅ Country admin feature is opt-in

### zk-verifier Contract

**Security Fixes:**
- ✅ Overflow checks enabled
- ✅ Integer overflow protection
- ✅ Safe error handling
- ✅ Bounded loops (max 1000 iterations)
- ✅ Batch size limits (max 100)

## Important Notes

1. **Data Preservation**: Upgrading preserves all existing data:
   - Admin address
   - Country policies
   - Game Hub address
   - Verifier address
   - All session data

2. **No Re-initialization Needed**: The contract keeps working with the same contract ID

3. **Frontend**: No changes needed to frontend `.env.local` - same contract ID

4. **Cost**: You'll need XLM for:
   - Installing WASM to ledger (one-time per WASM)
   - Upgrade transaction fee

## After Upgrade

Once upgraded, you can use the new country admin features:

```rust
// Main admin sets country admin for USA (country code 840)
set_country_admin(840, usa_admin_address);

// USA admin can now manage USA policy
set_country_allowed(840, true);  // ✅ Works

// Main admin can still manage any country
set_country_allowed(826, true);  // ✅ Works
```

## Troubleshooting

If the upgrade fails:

1. **Check you have enough XLM** in your admin account
2. **Verify contract ID** is correct
3. **Check network** matches your deployment
4. **Ensure admin identity** has proper permissions

The script will provide detailed error messages if something goes wrong.
