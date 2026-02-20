# Country-Specific Policy Design

## Current State
The contract currently has a simple `set_country_allowed(country: u32, allowed: bool)` function that allows/denies countries for session participation.

## Proposed Enhancement
Add granular country-specific policies that allow country admins to control:
- Smart contract display (allow/deny showing smart contracts on map)
- NFT display (allow/deny showing NFTs on map)
- Other future features

## Contract Changes Needed

### 1. Add CountryPolicy Struct
```rust
#[contracttype]
#[derive(Clone, Debug)]
pub struct CountryPolicy {
    pub allow_smart_contracts: bool,  // Allow displaying smart contracts on map
    pub allow_nfts: bool,             // Allow displaying NFTs on map
    pub allow_sessions: bool,         // Allow creating/joining sessions (existing behavior)
    // Future: add more policy flags as needed
}
```

### 2. Add Storage
Store country policies in persistent storage:
```rust
// Map<u32, CountryPolicy> - country code -> policy
env.storage().persistent().set(&symbol_short!("CntPol"), &country_policies);
```

### 3. Add Functions

#### Set Country Policy (admin-only)
```rust
pub fn set_country_policy(
    env: Env,
    country: u32,
    allow_smart_contracts: bool,
    allow_nfts: bool,
    allow_sessions: bool,
) {
    Self::require_admin_auth(&env, Some(country));
    
    let mut policies: Map<u32, CountryPolicy> = env
        .storage()
        .persistent()
        .get(&symbol_short!("CntPol"))
        .unwrap_or(Map::new(&env));
    
    policies.set(country, CountryPolicy {
        allow_smart_contracts,
        allow_nfts,
        allow_sessions,
    });
    
    env.storage()
        .persistent()
        .set(&symbol_short!("CntPol"), &policies);
}
```

#### Get Country Policy
```rust
pub fn get_country_policy(env: Env, country: u32) -> Option<CountryPolicy> {
    let policies: Map<u32, CountryPolicy> = env
        .storage()
        .persistent()
        .get(&symbol_short!("CntPol"))
        .unwrap_or(Map::new(&env));
    
    policies.get(country)
}
```

#### Check if feature is allowed (helper)
```rust
fn is_country_feature_allowed(env: &Env, country: u32, feature: &str) -> bool {
    if let Some(policy) = Self::get_country_policy(env.clone(), country) {
        match feature {
            "smart_contracts" => policy.allow_smart_contracts,
            "nfts" => policy.allow_nfts,
            "sessions" => policy.allow_sessions,
            _ => false,
        }
    } else {
        // Default: check old allow/deny map for backward compatibility
        Self::is_country_allowed_internal(env, country)
    }
}
```

### 4. Update Frontend
- Add UI in `CountryManagementOverlay` to set these policies
- Filter NFTs and contracts based on country policy when displaying on map
- Check policy before showing entities in `fetchOtherUsers` and related functions

## Migration Path
1. Deploy new contract with `CountryPolicy` struct
2. Keep `set_country_allowed` for backward compatibility
3. When `get_country_policy` returns `None`, fall back to `get_country_allowed`
4. Gradually migrate countries to use new policy system

## Example Usage
```rust
// Main admin or country admin sets policy for England (country code 826)
set_country_policy(env, 826, true, false, true);
// This means:
// - Smart contracts: allowed (will show on map)
// - NFTs: denied (will NOT show on map)
// - Sessions: allowed (can create/join sessions)
```
