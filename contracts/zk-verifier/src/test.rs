#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, vec, BytesN, Env, Vec};

#[test]
fn test_verify() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register_contract(None, ZkVerifier);
    
    // Initialize
    ZkVerifierClient::new(&env, &contract_id).init(&admin);

    // Create a mock proof (non-zero bytes)
    let mut proof_bytes = [0u8; 64];
    proof_bytes[0] = 1; // Make it non-zero
    let proof = LocationProof {
        proof: BytesN::from_array(&env, &proof_bytes),
        public_inputs: vec![&env, 12345u32, 1000000u32],
    };

    // Verify
    let client = ZkVerifierClient::new(&env, &contract_id);
    let result = client.verify(&proof, &12345u32);
    assert!(result);

    // Test with wrong cell_id
    let result2 = client.verify(&proof, &99999u32);
    assert!(!result2);
}
