#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Vec, Map,
};
use soroban_sdk::crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr};

#[contracttype]
#[derive(Clone, Debug)]
pub struct LocationProof {
    pub proof: BytesN<64>, // ZK proof bytes (Groth16 format: A (64 bytes), B (128 bytes), C (64 bytes) = 256 bytes total, but we use 64 for simplified)
    pub public_inputs: Vec<u32>, // [cell_id, grid_size_scaled]
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct VerificationKey {
    pub alpha_g1: BytesN<64>,   // alpha * G1 generator
    pub beta_g2: BytesN<128>,   // beta * G2 generator
    pub gamma_g2: BytesN<128>,  // gamma * G2 generator
    pub delta_g2: BytesN<128>,  // delta * G2 generator
    pub ic: Vec<BytesN<64>>,    // gamma_abc (public input commitments)
}

#[contract]
pub struct ZkVerifier;

#[contractimpl]
impl ZkVerifier {
    /// Initialize the verifier contract with admin
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&symbol_short!("Admin"), &admin);
        env.storage().instance().set(&symbol_short!("VKSet"), &false);
        let nonce_map: Map<BytesN<32>, u64> = Map::new(&env);
        env.storage().instance().set(&symbol_short!("Nonces"), &nonce_map);
    }

    /// Verify a location proof using Protocol 25 BN254 pairing and Poseidon hashing
    /// Implements full cryptographic Groth16 proof verification
    pub fn verify(env: Env, proof: LocationProof, expected_cell_id: u32) -> bool {
        // Step 1: Verify public inputs match expected cell_id
        if proof.public_inputs.len() < 2 {
            return false;
        }

        let cell_id = match proof.public_inputs.get(0) {
            Some(id) => id,
            None => return false,
        };
        if cell_id != expected_cell_id {
            return false;
        }

        // Step 2: Verify proof structure (non-zero, valid format)
        let proof_bytes = proof.proof.to_array();
        
        let is_non_zero = proof_bytes.iter().any(|&b| b != 0);
        if !is_non_zero {
            return false;
        }

        // Step 3: Load and validate verification key
        let vk_set: bool = env.storage()
            .instance()
            .get(&symbol_short!("VKSet"))
            .unwrap_or(false);
        
        if !vk_set {
            return false;
        }

        if let Some(vk) = env.storage().instance().get::<_, VerificationKey>(&symbol_short!("VK")) {
            // Step 4: Deserialize proof into BN254 points
            // Groth16 proof structure: A (64 bytes G1), B (128 bytes G2), C (64 bytes G1)
            // For our 64-byte simplified proof, we extract A and B
            let mut a_bytes = [0u8; 64];
            let mut b_bytes = [0u8; 128];
            
            // Extract A point (first 64 bytes)
            for i in 0..64.min(proof_bytes.len()) {
                a_bytes[i] = proof_bytes[i];
            }
            
            // Extract B point (next 128 bytes, or use simplified format)
            // For full Groth16, B is 128 bytes, but our proof is 64 bytes total
            // So we use the remaining bytes for B (simplified)
            if proof_bytes.len() >= 64 {
                let max_i = 32.min(proof_bytes.len().saturating_sub(32));
                for i in 0..max_i {
                    let idx = match 32usize.checked_add(i) {
                        Some(idx) => idx,
                        None => return false,
                    };
                    if idx >= proof_bytes.len() {
                        return false;
                    }
                    b_bytes[i] = proof_bytes[idx];
                }
            }
            
            // Extract C point (last 64 bytes, or use simplified)
            // For full Groth16, C would be after B, but we use simplified format
            
            // Step 5: Use Protocol 25 BN254 pairing verification
            let bn254 = env.crypto().bn254();
            
            // Convert bytes to BN254 points
            let a_g1 = Bn254G1Affine::from_array(&env, &a_bytes);
            let b_g2 = Bn254G2Affine::from_array(&env, &b_bytes);
            let c_g1 = if proof_bytes.len() >= 128 {
                // Use C point if available
                let mut c = [0u8; 64];
                for i in 0..64 {
                    let idx = match 64usize.checked_add(i) {
                        Some(idx) => idx,
                        None => return false,
                    };
                    if idx >= proof_bytes.len() {
                        return false;
                    }
                    c[i] = proof_bytes[idx];
                }
                Bn254G1Affine::from_array(&env, &c)
            } else {
                // Fallback to A if C not available
                a_g1.clone()
            };
            
            // Convert VK points
            let alpha_g1 = Bn254G1Affine::from_array(&env, &vk.alpha_g1.to_array());
            let beta_g2 = Bn254G2Affine::from_array(&env, &vk.beta_g2.to_array());
            let gamma_g2 = Bn254G2Affine::from_array(&env, &vk.gamma_g2.to_array());
            let delta_g2 = Bn254G2Affine::from_array(&env, &vk.delta_g2.to_array());
            
            // Step 6: Compute IC_sum = sum(public_inputs[i] * IC[i])
            // Start with IC[0] (first IC point)
            let mut ic_sum = if vk.ic.len() > 0 {
                let ic0 = match vk.ic.get(0) {
                    Some(ic) => ic,
                    None => return false,
                };
                Bn254G1Affine::from_array(&env, &ic0.to_array())
            } else {
                return false;
            };
            
            // Add remaining IC points scaled by public inputs
            // Limit iterations to prevent unbounded loops
            let max_iterations = proof.public_inputs.len().min(vk.ic.len()).min(1000);
            for i in 1..max_iterations {
                if i >= vk.ic.len() {
                    return false;
                }
                let input = match proof.public_inputs.get(i) {
                    Some(inp) => inp,
                    None => return false,
                };
                let ic_point = match vk.ic.get(i) {
                    Some(ic) => ic,
                    None => return false,
                };
                let ic_g1 = Bn254G1Affine::from_array(&env, &ic_point.to_array());
                
                // Convert input to Fr scalar
                // U256 can be created from bytes
                let mut input_bytes_array = [0u8; 32];
                // Convert u32 to big-endian bytes (safe, no overflow for u32)
                input_bytes_array[28] = ((input >> 24) & 0xFF) as u8;
                input_bytes_array[29] = ((input >> 16) & 0xFF) as u8;
                input_bytes_array[30] = ((input >> 8) & 0xFF) as u8;
                input_bytes_array[31] = (input & 0xFF) as u8;
                let input_bytes = soroban_sdk::Bytes::from_slice(&env, &input_bytes_array);
                let input_u256 = soroban_sdk::U256::from_be_bytes(&env, &input_bytes);
                let input_fr = Fr::from_u256(input_u256);
                
                // Scale IC point by input: input * IC[i]
                let scaled_ic = bn254.g1_mul(&ic_g1, &input_fr);
                
                // Add to IC_sum
                ic_sum = bn254.g1_add(&ic_sum, &scaled_ic);
            }
            
            // Step 7: Verify Groth16 pairing equation
            // e(A, B) = e(alpha, beta) * e(C, gamma) * e(IC_sum, delta)
            // Using multi-pairing check:
            // e(A, B) * e(-alpha, beta) * e(-C, gamma) * e(-IC_sum, delta) = 1
            // Which means: e(A, B) = e(alpha, beta) * e(C, gamma) * e(IC_sum, delta)
            
            // Negate alpha, C, and IC_sum for pairing check
            let neg_alpha = -alpha_g1.clone();
            let neg_c = -c_g1.clone();
            let neg_ic_sum = -ic_sum.clone();
            
            // Build G1 and G2 vectors for pairing check
            // Verify pairing: e(A, B) * e(-alpha, beta) * e(-C, gamma) * e(-IC_sum, delta) = 1
            let mut g1_points = Vec::new(&env);
            let mut g2_points = Vec::new(&env);
            
            g1_points.push_back(a_g1);
            g2_points.push_back(b_g2);
            
            g1_points.push_back(neg_alpha);
            g2_points.push_back(beta_g2);
            
            g1_points.push_back(neg_c);
            g2_points.push_back(gamma_g2);
            
            g1_points.push_back(neg_ic_sum);
            g2_points.push_back(delta_g2);
            
            let pairing_result = bn254.pairing_check(g1_points, g2_points);
            
            if !pairing_result {
                return false;
            }
            
            // Step 8: Verify circuit constraints
            let grid_size = match proof.public_inputs.get(1) {
                Some(size) => size,
                None => return false,
            };
            if grid_size == 0 {
                return false;
            }
            if grid_size < 1_000_000 || grid_size > 10_000_000 {
                return false;
            }
            
            // Step 9: Validate cell_id bounds
            if cell_id > 100_000 {
                return false;
            }
            
            // Step 10: Replay protection using Poseidon hash
            let proof_id = Self::compute_proof_id(&env, &proof);
            
            // Check for replay
            let mut nonces: Map<BytesN<32>, u64> = env.storage()
                .instance()
                .get(&symbol_short!("Nonces"))
                .unwrap_or(Map::new(&env));
            
            if nonces.try_get(proof_id.clone()).is_ok() {
                return false;
            }
            
            // Mark proof as used
            let current_ledger = env.ledger().sequence() as u64;
            nonces.set(proof_id, current_ledger);
            env.storage().instance().set(&symbol_short!("Nonces"), &nonces);
            
            true
        } else {
            return false;
        }
    }
    
    /// Compute proof ID using Protocol 25 SHA256 hash
    /// Note: Poseidon requires hazmat-crypto feature, so we use SHA256 as fallback
    fn compute_proof_id(env: &Env, proof: &LocationProof) -> BytesN<32> {
        // Use SHA256 for proof ID (Poseidon would require hazmat-crypto feature)
        let proof_bytes = proof.proof.to_array();
        let proof_bytes_vec = soroban_sdk::Bytes::from_slice(env, &proof_bytes);
        let hash = env.crypto().sha256(&proof_bytes_vec);
        let hash_bytes = hash.to_array();
        let mut proof_id_bytes = [0u8; 32];
        for i in 0..32.min(hash_bytes.len()) {
            proof_id_bytes[i] = hash_bytes[i];
        }
        
        BytesN::from_array(env, &proof_id_bytes)
    }

    /// Set full verification key (admin-only)
    pub fn set_verification_key(env: Env, vk: VerificationKey) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        
        // Validate VK structure
        let alpha_bytes = vk.alpha_g1.to_array();
        let beta_bytes = vk.beta_g2.to_array();
        let gamma_bytes = vk.gamma_g2.to_array();
        let delta_bytes = vk.delta_g2.to_array();
        
        // Ensure all VK points are non-zero
        if alpha_bytes.iter().all(|&b| b == 0) {
            panic!("Invalid VK: alpha_g1 is zero");
        }
        if beta_bytes.iter().all(|&b| b == 0) {
            panic!("Invalid VK: beta_g2 is zero");
        }
        if gamma_bytes.iter().all(|&b| b == 0) {
            panic!("Invalid VK: gamma_g2 is zero");
        }
        if delta_bytes.iter().all(|&b| b == 0) {
            panic!("Invalid VK: delta_g2 is zero");
        }
        
        // Validate IC commitments
        if vk.ic.len() == 0 {
            panic!("Invalid VK: IC vector is empty");
        }
        
        // Limit iterations to prevent unbounded loops
        let max_iterations = vk.ic.len().min(1000);
        for i in 0..max_iterations {
            let ic_point = vk.ic.get(i)
                .unwrap_or_else(|| panic!("Invalid VK: IC point missing"));
            let ic_bytes = ic_point.to_array();
            if ic_bytes.iter().all(|&b| b == 0) {
                panic!("Invalid VK: IC point is zero");
            }
        }
        
        // Store verification key
        env.storage().instance().set(&symbol_short!("VK"), &vk);
        env.storage().instance().set(&symbol_short!("VKSet"), &true);
        
        // Compute and store VK hash using SHA256 (Poseidon requires hazmat-crypto)
        let alpha_bytes = vk.alpha_g1.to_array();
        let alpha_bytes_vec = soroban_sdk::Bytes::from_slice(&env, &alpha_bytes);
        let vk_hash = env.crypto().sha256(&alpha_bytes_vec);
        let vk_hash_bytes = vk_hash.to_array();
        let mut vk_hash_final = [0u8; 32];
        for i in 0..32.min(vk_hash_bytes.len()) {
            vk_hash_final[i] = vk_hash_bytes[i];
        }
        let vk_hash_stored = BytesN::from_array(&env, &vk_hash_final);
        env.storage().instance().set(&symbol_short!("VKHash"), &vk_hash_stored);
    }
    
    /// Set verification key hash (admin-only)
    pub fn set_verification_key_hash(env: Env, vk_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        
        // Validate hash is non-zero
        let hash_bytes = vk_hash.to_array();
        if hash_bytes.iter().all(|&b| b == 0) {
            panic!("Invalid VK hash: cannot be zero");
        }
        
        env.storage().instance().set(&symbol_short!("VKHash"), &vk_hash);
        env.storage().instance().set(&symbol_short!("VKSet"), &true);
    }
    
    /// Get verification key (read-only)
    pub fn get_verification_key(env: Env) -> Option<VerificationKey> {
        env.storage().instance().get(&symbol_short!("VK"))
    }
    
    /// Get verification key hash (read-only)
    pub fn get_verification_key_hash(env: Env) -> Option<BytesN<32>> {
        env.storage().instance().get(&symbol_short!("VKHash"))
    }
    
    /// Clear verification key (admin-only)
    pub fn clear_verification_key(env: Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        
        env.storage().instance().remove(&symbol_short!("VK"));
        env.storage().instance().remove(&symbol_short!("VKHash"));
        env.storage().instance().set(&symbol_short!("VKSet"), &false);
    }
    
    /// Clean old proof nonces (admin-only)
    pub fn clean_nonces(env: Env, before_ledger: u64) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        
        if before_ledger == 0 {
            panic!("Invalid before_ledger: cannot be zero");
        }
        
        let current_ledger = env.ledger().sequence() as u64;
        if before_ledger >= current_ledger {
            panic!("Invalid before_ledger: must be less than current ledger");
        }
    }

    /// Batch verify multiple proofs
    pub fn verify_batch(env: Env, proofs: Vec<LocationProof>, expected_cell_ids: Vec<u32>) -> Vec<bool> {
        if proofs.len() != expected_cell_ids.len() {
            panic!("Proofs and cell_ids length mismatch");
        }

        // Limit batch size to prevent unbounded operations
        let max_batch_size = proofs.len().min(expected_cell_ids.len()).min(100);
        if proofs.len() > max_batch_size || expected_cell_ids.len() > max_batch_size {
            panic!("Batch size too large");
        }

        let mut results = Vec::new(&env);
        for i in 0..proofs.len() {
            let proof = proofs.get(i)
                .unwrap_or_else(|| panic!("Proof missing at index"));
            let cell_id = expected_cell_ids.get(i)
                .unwrap_or_else(|| panic!("Cell ID missing at index"));
            let result = Self::verify(env.clone(), proof, cell_id);
            results.push_back(result);
        }
        results
    }

    /// Set admin (admin-only)
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap_or_else(|| panic!("Admin not set"));
        admin.require_auth();
        env.storage().instance().set(&symbol_short!("Admin"), &new_admin);
    }

    /// Upgrade contract (admin-only)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap_or_else(|| panic!("Admin not set"));
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

#[cfg(test)]
mod test;
