# Setting Up Allowed Countries List

## Overview

The GeoTrust Match contract uses an on-chain allowlist/denylist system to control which countries can join sessions. This list is managed by the contract admin and is separate from the ZK proof system.

## How It Works

1. **Country Allowlist**: Countries explicitly allowed to join sessions
2. **Country Denylist**: Countries explicitly blocked from joining sessions  
3. **Default Policy**: When neither allowlist nor denylist applies, use default (allow all or deny all)

## Setting Up Countries (Admin Only)

### Via Admin Panel (Frontend)

1. Connect your wallet (must be the admin address)
2. The Admin Panel will appear automatically if you're the admin
3. Use the search box to find countries
4. Click the toggle button to allow/deny countries
5. Or click directly on countries on the map to toggle them

### Via Contract Calls (CLI/Stellar Lab)

#### Allow a Country

```bash
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --source admin \
  --network testnet \
  -- \
  set_country_allowed \
  --country 840 \
  --allowed true
```

#### Deny a Country

```bash
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --source admin \
  --network testnet \
  -- \
  set_country_allowed \
  --country 840 \
  --allowed false
```

#### Set Default Policy

```bash
# Allow all countries by default (if not in denylist)
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --source admin \
  --network testnet \
  -- \
  set_default_allow_all \
  --value true

# Deny all countries by default (if not in allowlist)
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --source admin \
  --network testnet \
  -- \
  set_default_allow_all \
  --value false
```

## Country Codes

Countries are identified by ISO 3166-1 numeric codes (u32):
- **840**: United States
- **826**: United Kingdom
- **124**: Canada
- **36**: Australia
- **276**: Germany
- **250**: France
- **392**: Japan
- **156**: China

See [ISO 3166-1 numeric codes](https://en.wikipedia.org/wiki/ISO_3166-1_numeric) for the complete list.

## ZK Proofs and Country Gating

**Current Status**: ZK proofs are **disabled** for MVP. The contract currently:
1. Checks the on-chain allowlist/denylist directly
2. Accepts an optional `LocationProof` struct but doesn't verify it on-chain
3. Stores the proof for future verification

**Future Integration**: To enable ZK proof verification:
1. Deploy a ZK verifier contract
2. Call `set_verifier` to configure the verifier address
3. Update the contract to call the verifier in `join_session`
4. The ZK proof would prove country membership without revealing exact location

## Checking Current Policy

### Get Country Policy

```bash
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --network testnet \
  -- \
  get_country_policy
```

Returns: `[default_allow_all: bool, allowed_count: u32, denied_count: u32]`

### Check Specific Country

```bash
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --network testnet \
  -- \
  get_country_allowed \
  --country 840
```

Returns: `true` (allowed), `false` (denied), or `null` (uses default policy)

### List Allowed Countries

```bash
soroban contract invoke \
  --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ \
  --network testnet \
  -- \
  list_allowed_countries \
  --page 0 \
  --page_size 100
```

## Example: Setting Up Common Countries

```bash
# Allow United States
soroban contract invoke --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ --source admin --network testnet -- set_country_allowed --country 840 --allowed true

# Allow United Kingdom
soroban contract invoke --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ --source admin --network testnet -- set_country_allowed --country 826 --allowed true

# Allow Canada
soroban contract invoke --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ --source admin --network testnet -- set_country_allowed --country 124 --allowed true

# Set default to deny all (only explicitly allowed countries can join)
soroban contract invoke --id CAO2MKEQ5TPLKSI77DCWTCSO7TWYKPR2POXL5LNPVHVYIS4PFG3DIPRZ --source admin --network testnet -- set_default_allow_all --value false
```

## Notes

- The allowlist/denylist is stored on-chain in the contract's persistent storage
- Changes take effect immediately
- Only the admin address (set during contract initialization) can modify the list
- Country codes must be valid ISO 3166-1 numeric codes (u32)
