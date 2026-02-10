#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, BytesN, Env};

#[test]
fn test_init() {
    let env = Env::default();
    let contract_id = env.register_contract(None, GeoTrustMatch);
    let admin = Address::generate(&env);

    env.as_contract(&contract_id, || {
        GeoTrustMatch::init(env.clone(), admin.clone(), true);
    });
}

#[test]
fn test_country_policy() {
    let env = Env::default();
    let contract_id = env.register_contract(None, GeoTrustMatch);
    let admin = Address::generate(&env);

    env.as_contract(&contract_id, || {
        GeoTrustMatch::init(env.clone(), admin.clone(), false);
    });

    env.as_contract(&contract_id, || {
        GeoTrustMatch::set_country_allowed(env.clone(), 840u16, true);
        assert_eq!(GeoTrustMatch::get_country_allowed(env.clone(), 840u16), Some(true));
        assert_eq!(GeoTrustMatch::get_country_allowed(env.clone(), 826u16), None);
    });
}

#[test]
fn test_session_flow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, GeoTrustMatch);
    let admin = Address::generate(&env);
    let player1 = Address::generate(&env);
    let player2 = Address::generate(&env);

    env.as_contract(&contract_id, || {
        GeoTrustMatch::init(env.clone(), admin.clone(), true);
    });

    let session_id = env.as_contract(&contract_id, || {
        GeoTrustMatch::create_session(env.clone())
    });
    assert_eq!(session_id, 1u32);

    let asset_tag = BytesN::from_array(&env, &[0u8; 32]);
    
    env.as_contract(&contract_id, || {
        GeoTrustMatch::join_session(env.clone(), session_id, 1u32, asset_tag.clone(), 840u16);
    });

    env.as_contract(&contract_id, || {
        GeoTrustMatch::join_session(env.clone(), session_id, 1u32, asset_tag.clone(), 840u16);
    });

    let result = env.as_contract(&contract_id, || {
        GeoTrustMatch::resolve_match(env.clone(), session_id)
    });
    assert!(result.matched);
}
