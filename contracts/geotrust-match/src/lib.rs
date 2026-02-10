#![no_std]
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, Map, Vec, IntoVal,
};

// Import GameHub contract interface
// This allows us to call into the GameHub contract
#[contractclient(name = "GameHubClient")]
pub trait GameHub {
    fn start_game(
        env: Env,
        game_id: Address,
        session_id: u32,
        player1: Address,
        player2: Address,
        player1_points: i128,
        player2_points: i128,
    );

    fn end_game(
        env: Env,
        session_id: u32,
        player1_won: bool
    );
}

// Storage keys - using symbol_short! directly with string literals

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SessionState {
    Waiting,
    Active,
    Ended,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct LocationProof {
    pub proof: BytesN<64>, // ZK proof bytes (simplified - actual size depends on proof system)
    pub public_inputs: Vec<u32>, // [cell_id, grid_size_scaled]
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Session {
    pub player1: Option<Address>,
    pub player2: Option<Address>,
    pub p1_cell_id: Option<u32>,
    pub p2_cell_id: Option<u32>,
    pub p1_asset_tag: Option<BytesN<32>>,
    pub p2_asset_tag: Option<BytesN<32>>,
    pub state: SessionState,
    pub created_ledger: u32,
    pub p1_country: Option<u32>,
    pub p2_country: Option<u32>,
    pub p1_location_proof: Option<LocationProof>, // ZK proof for location (optional for MVP)
    pub p2_location_proof: Option<LocationProof>,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct MatchResult {
    pub matched: bool,
    pub winner: Option<Address>,
}

#[contract]
pub struct GeoTrustMatch;

#[contractimpl]
impl GeoTrustMatch {
    /// Initialize the contract with admin and default policy
    pub fn init(env: Env, admin: Address, default_allow_all: bool) {
        admin.require_auth();
        env.storage().instance().set(&symbol_short!("Admin"), &admin);
        env.storage()
            .instance()
            .set(&symbol_short!("DefAllow"), &default_allow_all);
    }

    /// Set Game Hub address (admin-only)
    pub fn set_game_hub(env: Env, game_hub: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        env.storage().instance().set(&symbol_short!("GameHub"), &game_hub);
    }

    /// Set ZK verifier address (admin-only)
    pub fn set_verifier(env: Env, verifier: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        env.storage().instance().set(&symbol_short!("Verifier"), &verifier);
    }

    /// Set a new admin (admin-only)
    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        env.storage().instance().set(&symbol_short!("Admin"), &new_admin);
    }

    /// Upgrade contract (admin-only)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Set country allowed status (admin-only)
    pub fn set_country_allowed(env: Env, country: u32, allowed: bool) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();

        let mut allow_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("AllowCnt"))
            .unwrap_or(Map::new(&env));

        if allowed {
            allow_map.set(country, true);
        } else {
            allow_map.remove(country);
        }

        env.storage()
            .persistent()
            .set(&symbol_short!("AllowCnt"), &allow_map);
    }

    /// Set default allow all policy (admin-only)
    pub fn set_default_allow_all(env: Env, value: bool) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("Admin"))
            .unwrap();
        admin.require_auth();
        env.storage()
            .instance()
            .set(&symbol_short!("DefAllow"), &value);
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&symbol_short!("Admin"))
    }

    /// Get country allowed status
    pub fn get_country_allowed(env: Env, country: u32) -> Option<bool> {
        Self::is_country_allowed_internal(&env, country).then_some(true)
    }

    /// Get country policy summary
    pub fn get_country_policy(env: Env) -> (bool, u32, u32) {
        let default_allow_all: bool = env
            .storage()
            .instance()
            .get(&symbol_short!("DefAllow"))
            .unwrap_or(false);

        let allow_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("AllowCnt"))
            .unwrap_or(Map::new(&env));

        let deny_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("DenyCnt"))
            .unwrap_or(Map::new(&env));

        let allowed_count = allow_map.len();
        let denied_count = deny_map.len();

        (default_allow_all, allowed_count, denied_count)
    }

    /// List allowed countries with pagination
    pub fn list_allowed_countries(env: Env, page: u32, page_size: u32) -> Vec<u32> {
        let allow_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("AllowCnt"))
            .unwrap_or(Map::new(&env));

        let mut result = vec![&env];
        let start = page * page_size;
        let end = start + page_size;

        let mut count = 0u32;
        allow_map.iter().for_each(|(country, _)| {
            if count >= start && count < end {
                result.push_back(country);
            }
            count += 1;
        });

        result
    }

    /// Create a new session
    pub fn create_session(env: Env) -> u32 {
        let session_id = env.storage().instance().get(&symbol_short!("NextSess"))
            .unwrap_or(0u32) + 1;
        env.storage().instance().set(&symbol_short!("NextSess"), &session_id);

        let session = Session {
            player1: None,
            player2: None,
            p1_cell_id: None,
            p2_cell_id: None,
            p1_asset_tag: None,
            p2_asset_tag: None,
            state: SessionState::Waiting,
            created_ledger: env.ledger().sequence(),
            p1_country: None,
            p2_country: None,
            p1_location_proof: None,
            p2_location_proof: None,
        };

        let key = (symbol_short!("Session"), session_id);
        env.storage().temporary().set(&key, &session);
        env.storage().temporary().extend_ttl(&key, 100000, 100000);

        session_id
    }

    /// Join a session with ZK location proof
    pub fn join_session(
        env: Env,
        caller: Address,
        session_id: u32,
        cell_id: u32,
        asset_tag: BytesN<32>,
        country: u32,
        location_proof: Option<LocationProof>,
    ) {
        caller.require_auth();

        // Check country policy
        if !Self::is_country_allowed_internal(&env, country) {
            panic!("Country not allowed");
        }

        // Verify location proof if provided
        if let Some(ref proof) = location_proof {
            // Verify public inputs match cell_id
            if proof.public_inputs.len() < 1 {
                panic!("Location proof missing public inputs");
            }
            let first_input = proof.public_inputs.get(0).unwrap();
            if first_input != cell_id {
                panic!("Location proof public inputs mismatch");
            }
            
            // Verify proof via verifier contract if configured
            if let Some(verifier_addr) = env.storage().instance().get::<_, Address>(&symbol_short!("Verifier")) {
                // Call verifier contract to verify the proof
                let verify_result: bool = env.invoke_contract(
                    &verifier_addr,
                    &symbol_short!("verify"),
                    soroban_sdk::vec![&env, proof.clone().into_val(&env), cell_id.into_val(&env)],
                );
                if !verify_result {
                    panic!("Location proof verification failed");
                }
            }
        }

        let key = (symbol_short!("Session"), session_id);
        let mut session: Session = env
            .storage()
            .temporary()
            .get(&key)
            .unwrap_or_else(|| panic!("Session not found"));

        if session.state != SessionState::Waiting {
            panic!("Session not in waiting state");
        }

        if session.player1.is_none() {
            session.player1 = Some(caller.clone());
            session.p1_cell_id = Some(cell_id);
            session.p1_asset_tag = Some(asset_tag);
            session.p1_country = Some(country);
            session.p1_location_proof = location_proof;
        } else if session.player2.is_none() {
            if session.player1 == Some(caller.clone()) {
                panic!("Player already in session");
            }
            session.player2 = Some(caller.clone());
            session.p2_cell_id = Some(cell_id);
            session.p2_asset_tag = Some(asset_tag);
            session.p2_country = Some(country);
            session.p2_location_proof = location_proof;
            session.state = SessionState::Active;

            // Call Game Hub start_game if configured
            // Game Hub interface: start_game(game_id: address, session_id: u32, player1: address, player2: address, player1_points: i128, player2_points: i128)
            if let Some(game_hub_addr) = env.storage().instance().get::<_, Address>(&symbol_short!("GameHub")) {
                let player1_addr = session.player1.clone().unwrap();
                // Get the contract's own address as game_id
                let game_id = env.current_contract_address();
                
                // Create GameHub client
                let game_hub = GameHubClient::new(&env, &game_hub_addr);
                
                // Call Game Hub to start the session
                game_hub.start_game(
                    &game_id,
                    &session_id,
                    &player1_addr,
                    &caller,
                    &0i128,
                    &0i128,
                );
            }
        } else {
            panic!("Session is full");
        }

        env.storage().temporary().set(&key, &session);
        env.storage().temporary().extend_ttl(&key, 100000, 100000);
    }

    /// Resolve a match
    pub fn resolve_match(env: Env, session_id: u32) -> MatchResult {
        let key = (symbol_short!("Session"), session_id);
        let mut session: Session = env
            .storage()
            .temporary()
            .get(&key)
            .unwrap_or_else(|| panic!("Session not found"));

        if session.state != SessionState::Active {
            panic!("Session not active");
        }

        let player1 = session.player1.clone().unwrap();
        let player2 = session.player2.clone().unwrap();

        // Check for match: same asset_tag and same or adjacent cell_id
        let matched = session.p1_asset_tag == session.p2_asset_tag
            && (session.p1_cell_id == session.p2_cell_id
                || (session.p1_cell_id.unwrap() as i32 - session.p2_cell_id.unwrap() as i32).abs() <= 1);

        let winner = if matched {
            Some(player1.clone()) // First player wins if matched
        } else {
            Some(player2.clone()) // Second player wins if no match
        };

        session.state = SessionState::Ended;

        // Call Game Hub end_game if configured
        // Game Hub interface: end_game(session_id: u32, player1_won: bool)
        if let Some(game_hub_addr) = env.storage().instance().get::<_, Address>(&symbol_short!("GameHub")) {
            // Determine if player1 won (matched means player1 wins)
            let player1_won = matched;
            
            // Create GameHub client
            let game_hub = GameHubClient::new(&env, &game_hub_addr);
            
            // Call GameHub to end the session
            game_hub.end_game(&session_id, &player1_won);
        }

        env.storage().temporary().set(&key, &session);
        env.storage().temporary().extend_ttl(&key, 100000, 100000);

        MatchResult { matched, winner }
    }

    /// Get session details
    pub fn get_session(env: Env, session_id: u32) -> Option<Session> {
        let key = (symbol_short!("Session"), session_id);
        env.storage().temporary().get(&key)
    }

    /// Internal function to check if country is allowed
    fn is_country_allowed_internal(env: &Env, country: u32) -> bool {
        // Check deny list first
        let deny_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("DenyCnt"))
            .unwrap_or(Map::new(env));

        if deny_map.get(country).is_some() {
            return false;
        }

        // Check allow list
        let allow_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("AllowCnt"))
            .unwrap_or(Map::new(env));

        if allow_map.get(country).is_some() {
            return true;
        }

        // Return default policy
        env.storage()
            .instance()
            .get(&symbol_short!("DefAllow"))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod test;
