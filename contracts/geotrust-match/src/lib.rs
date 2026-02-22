#![no_std]
use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, Map, Vec, IntoVal, String,
    token, Bytes,
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

#[contracttype]
#[derive(Clone, Debug)]
pub struct CountryInfo {
    pub code: String,           // ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "FR")
    pub name: String,            // Full country name
    pub enabled: bool,          // Whether country vault is enabled
    pub created_at: u64,        // Timestamp when country was registered
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
        Self::extend_instance_ttl(&env);
    }

    /// Get admin for a specific country (returns country admin if set, otherwise main admin)
    fn get_admin_for_country(env: &Env, country: Option<u32>) -> Option<Address> {
        // If country is specified, check for country-specific admin
        if let Some(country_id) = country {
            let country_admins: Map<u32, Address> = env
                .storage()
                .instance()
                .get(&symbol_short!("CntAdm"))
                .unwrap_or(Map::new(env));
            
            if let Some(country_admin) = country_admins.get(country_id) {
                return Some(country_admin);
            }
        }
        
        // Fall back to main admin
        env.storage().instance().get(&symbol_short!("Admin"))
    }

    /// Require admin auth for a specific country (checks country admin first, then main admin)
    fn require_admin_auth(env: &Env, country: Option<u32>) {
        let admin = Self::get_admin_for_country(env, country)
            .unwrap_or_else(|| panic!("Admin not set"));
        admin.require_auth();
    }

    /// Extend instance storage TTL to keep contract data alive
    /// Threshold: ~1 day (17,280 ledgers), Extend to: ~30 days (518,400 ledgers)
    fn extend_instance_ttl(env: &Env) {
        env.storage().instance().extend_ttl(17_280, 518_400);
    }

    /// Set Game Hub address (admin-only)
    pub fn set_game_hub(env: Env, game_hub: Address) {
        Self::require_admin_auth(&env, None);
        env.storage().instance().set(&symbol_short!("GameHub"), &game_hub);
        Self::extend_instance_ttl(&env);
    }

    /// Set ZK verifier address (admin-only)
    pub fn set_verifier(env: Env, verifier: Address) {
        Self::require_admin_auth(&env, None);
        env.storage().instance().set(&symbol_short!("Verifier"), &verifier);
        Self::extend_instance_ttl(&env);
    }

    /// Set a new main admin (main admin-only)
    pub fn set_admin(env: Env, new_admin: Address) {
        Self::require_admin_auth(&env, None);
        env.storage().instance().set(&symbol_short!("Admin"), &new_admin);
        Self::extend_instance_ttl(&env);
    }

    /// Set country-specific admin (main admin-only)
    /// Allows main admin to delegate admin rights for specific countries
    pub fn set_country_admin(env: Env, country: u32, country_admin: Address) {
        Self::require_admin_auth(&env, None);
        
        let mut country_admins: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&symbol_short!("CntAdm"))
            .unwrap_or(Map::new(&env));
        
        country_admins.set(country, country_admin.clone());
        env.storage().instance().set(&symbol_short!("CntAdm"), &country_admins);
        Self::extend_instance_ttl(&env);
    }

    /// Remove country-specific admin (main admin-only)
    /// Removes country admin, reverting to main admin for that country
    pub fn remove_country_admin(env: Env, country: u32) {
        Self::require_admin_auth(&env, None);
        
        let mut country_admins: Map<u32, Address> = env
            .storage()
            .instance()
            .get(&symbol_short!("CntAdm"))
            .unwrap_or(Map::new(&env));
        
        country_admins.remove(country);
        env.storage().instance().set(&symbol_short!("CntAdm"), &country_admins);
        Self::extend_instance_ttl(&env);
    }

    /// Get country-specific admin (returns country admin if set, otherwise main admin)
    pub fn get_country_admin(env: Env, country: u32) -> Option<Address> {
        Self::get_admin_for_country(&env, Some(country))
    }

    /// Upgrade contract (main admin-only)
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        Self::require_admin_auth(&env, None);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }

    /// Set country allowed status (country admin or main admin)
    /// Country admins can only set policy for their assigned country
    pub fn set_country_allowed(env: Env, country: u32, allowed: bool) {
        // Check if caller is country admin or main admin
        Self::require_admin_auth(&env, Some(country));

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

    /// Set default allow all policy (main admin-only)
    pub fn set_default_allow_all(env: Env, value: bool) {
        Self::require_admin_auth(&env, None);
        env.storage()
            .instance()
            .set(&symbol_short!("DefAllow"), &value);
        Self::extend_instance_ttl(&env);
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&symbol_short!("Admin"))
    }

    /// Get Game Hub address
    pub fn get_game_hub(env: Env) -> Option<Address> {
        env.storage().instance().get(&symbol_short!("GameHub"))
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
        
        // Use checked arithmetic to prevent overflow
        let start = page.checked_mul(page_size)
            .unwrap_or_else(|| panic!("Page calculation overflow"));
        let end = start.checked_add(page_size)
            .unwrap_or_else(|| panic!("End calculation overflow"));

        let mut count = 0u32;
        allow_map.iter().for_each(|(country, _)| {
            if count >= start && count < end {
                result.push_back(country);
            }
            count = count.checked_add(1)
                .unwrap_or_else(|| panic!("Count overflow"));
        });

        result
    }

    /// Create a new session
    pub fn create_session(env: Env) -> u32 {
        let current_id = env.storage().instance().get(&symbol_short!("NextSess"))
            .unwrap_or(0u32);
        let session_id = current_id.checked_add(1)
            .unwrap_or_else(|| panic!("Session ID overflow"));
        env.storage().instance().set(&symbol_short!("NextSess"), &session_id);
        Self::extend_instance_ttl(&env);

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
        // Extend TTL: signature is extend_ttl(key, threshold, extend_to)
        // threshold must be <= extend_to, so we use threshold=100000, extend_to=100001
        env.storage().temporary().extend_ttl(&key, 100000, 100001);

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
            let first_input = proof.public_inputs.get(0)
                .unwrap_or_else(|| panic!("Location proof missing first input"));
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
                let player1_addr = session.player1.clone()
                    .unwrap_or_else(|| panic!("Player 1 not set"));
                // Get the contract's own address as game_id
                let game_id = env.current_contract_address();
                
                // Create GameHub client
                let game_hub = GameHubClient::new(&env, &game_hub_addr);
                
                // Call Game Hub to start the session
                // This will create a transaction visible on Stellar Expert
                game_hub.start_game(
                    &game_id,
                    &session_id,
                    &player1_addr,
                    &caller,
                    &0i128,
                    &0i128,
                );
            } else {
                // Log that Game Hub is not configured (this won't appear in production but helps debugging)
                // In production, you'd want to handle this gracefully
            }
        } else {
            panic!("Session is full");
        }

        env.storage().temporary().set(&key, &session);
        // Extend TTL: signature is extend_ttl(key, threshold, extend_to)
        // threshold must be <= extend_to, so we use threshold=100000, extend_to=100001
        env.storage().temporary().extend_ttl(&key, 100000, 100001);
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

        let player1 = session.player1.clone()
            .unwrap_or_else(|| panic!("Player 1 not set"));
        let player2 = session.player2.clone()
            .unwrap_or_else(|| panic!("Player 2 not set"));

        // Check for match: same asset_tag and same or adjacent cell_id
        let matched = session.p1_asset_tag == session.p2_asset_tag
            && (session.p1_cell_id == session.p2_cell_id
                || {
                    let p1_cell = session.p1_cell_id
                        .unwrap_or_else(|| panic!("Player 1 cell ID missing"));
                    let p2_cell = session.p2_cell_id
                        .unwrap_or_else(|| panic!("Player 2 cell ID missing"));
                    let diff = (p1_cell as i32).checked_sub(p2_cell as i32)
                        .unwrap_or_else(|| panic!("Cell ID calculation overflow"));
                    diff.abs() <= 1
                });

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
            // This will create a transaction visible on Stellar Expert
            game_hub.end_game(&session_id, &player1_won);
        } else {
            // Log that Game Hub is not configured (this won't appear in production but helps debugging)
            // In production, you'd want to handle this gracefully
        }

        env.storage().temporary().set(&key, &session);
        // Extend TTL: signature is extend_ttl(key, threshold, extend_to)
        // threshold must be <= extend_to, so we use threshold=100000, extend_to=100001
        env.storage().temporary().extend_ttl(&key, 100000, 100001);

        MatchResult { matched, winner }
    }

    /// Get session details
    pub fn get_session(env: Env, session_id: u32) -> Option<Session> {
        let key = (symbol_short!("Session"), session_id);
        env.storage().temporary().get(&key)
    }

    /// Internal function to check if country is allowed
    fn is_country_allowed_internal(env: &Env, country: u32) -> bool {
        // Check deny list first (use try_get to avoid panics)
        let deny_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("DenyCnt"))
            .unwrap_or(Map::new(env));

        if deny_map.try_get(country).unwrap_or_default().is_some() {
            return false;
        }

        // Check allow list (use try_get to avoid panics)
        let allow_map: Map<u32, bool> = env
            .storage()
            .persistent()
            .get(&symbol_short!("AllowCnt"))
            .unwrap_or(Map::new(env));

        if allow_map.try_get(country).unwrap_or_default().is_some() {
            return true;
        }

        // Return default policy
        env.storage()
            .instance()
            .get(&symbol_short!("DefAllow"))
            .unwrap_or(false)
    }

    // ========== Country Vault Functions ==========

    /// Validate country code (must be 2 uppercase letters, registered, and enabled)
    fn validate_country_code(env: &Env, country_code: &String) -> bool {
        // Check length (must be 2 characters)
        if country_code.len() != 2 {
            return false;
        }
        
        // Check if country is registered
        let country_registry: Map<String, CountryInfo> = env
            .storage()
            .persistent()
            .get(&symbol_short!("CntReg"))
            .unwrap_or(Map::new(env));
        
        match country_registry.get(country_code.clone()) {
            Some(country_info) => country_info.enabled,
            None => false,
        }
    }

    /// Register a new country code (admin-only)
    pub fn register_country(
        env: Env,
        country_code: String,
        country_name: String,
        admin_address: Address,
    ) -> bool {
        admin_address.require_auth();
        Self::require_admin_auth(&env, None);

        // Validate country code format (must be 2 uppercase letters)
        if country_code.len() != 2 {
            panic!("Country code must be exactly 2 characters");
        }

        let mut country_registry: Map<String, CountryInfo> = env
            .storage()
            .persistent()
            .get(&symbol_short!("CntReg"))
            .unwrap_or(Map::new(&env));

        // Check if country already exists
        if country_registry.contains_key(country_code.clone()) {
            panic!("Country already registered");
        }

        let country_info = CountryInfo {
            code: country_code.clone(),
            name: country_name,
            enabled: true,
            created_at: env.ledger().timestamp(),
        };

        country_registry.set(country_code, country_info);
        env.storage().persistent().set(&symbol_short!("CntReg"), &country_registry);

        true
    }

    /// Enable or disable a country vault (admin-only)
    pub fn set_country_enabled(
        env: Env,
        country_code: String,
        enabled: bool,
        admin_address: Address,
    ) -> bool {
        admin_address.require_auth();
        Self::require_admin_auth(&env, None);

        let mut country_registry: Map<String, CountryInfo> = env
            .storage()
            .persistent()
            .get(&symbol_short!("CntReg"))
            .unwrap_or(Map::new(&env));

        let mut country_info = country_registry
            .get(country_code.clone())
            .unwrap_or_else(|| panic!("Country not registered"));

        country_info.enabled = enabled;
        country_registry.set(country_code, country_info);
        env.storage().persistent().set(&symbol_short!("CntReg"), &country_registry);

        true
    }

    /// Get country info
    pub fn get_country_info(env: Env, country_code: String) -> Option<CountryInfo> {
        let country_registry: Map<String, CountryInfo> = env
            .storage()
            .persistent()
            .get(&symbol_short!("CntReg"))
            .unwrap_or(Map::new(&env));
        
        country_registry.get(country_code)
    }

    /// Deposit tokens to country-specific vault
    /// Following the same pattern as XYZ-Wallet: verify auth, check balance, transfer, update storage
    pub fn deposit(
        env: Env,
        user_address: Address,
        country_code: String,
        asset: Address,
        amount: i128,
        _signature_payload: Bytes, // WebAuthn signature payload (can be verified externally)
        _webauthn_signature: Bytes, // WebAuthn signature (for future verification)
        _webauthn_authenticator_data: Bytes, // WebAuthn authenticator data
        _webauthn_client_data: Bytes, // WebAuthn client data JSON
    ) -> bool {
        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Validate country code (must be registered and enabled)
        // Check this early to fail fast with clear error
        if country_code.len() != 2 {
            panic!("Country code must be exactly 2 characters");
        }
        
        let country_registry: Map<String, CountryInfo> = env
            .storage()
            .persistent()
            .get(&symbol_short!("CntReg"))
            .unwrap_or(Map::new(&env));
        
        let country_info = match country_registry.get(country_code.clone()) {
            Some(info) => info,
            None => panic!("Country not registered"),
        };
        
        if !country_info.enabled {
            panic!("Country vault is disabled");
        }

        // Create token client and check user's token balance FIRST
        // Check balance before requiring auth to avoid unnecessary auth if balance is insufficient
        let token_client = token::Client::new(&env, &asset);
        let contract_address = env.current_contract_address();
        
        // Check user's token balance before attempting transfer
        // This is a read operation, doesn't require authorization
        let user_token_balance = token_client.balance(&user_address);
        if user_token_balance < amount {
            panic!("Insufficient token balance");
        }

        // Require authorization from the user AFTER balance check
        // Soroban's authorization framework handles signature verification and replay prevention
        // This must be called before any token operations to ensure proper authorization
        user_address.require_auth();

        // Transfer tokens from user to contract
        // The user is directly transferring their tokens to the contract
        // Authorization is already verified via require_auth() above
        // The SDK will automatically handle the authorization for the nested token contract call
        token_client.transfer(&user_address, &contract_address, &amount);

        // Update country-specific balance
        // Storage structure: Map<Address, Map<String, Map<Address, i128>>>
        // (user -> country_code -> asset -> balance)
        let mut balances_map: Map<Address, Map<String, Map<Address, i128>>> = env
            .storage()
            .persistent()
            .get(&symbol_short!("Balances"))
            .unwrap_or(Map::new(&env));

        let mut user_balances: Map<String, Map<Address, i128>> = balances_map
            .get(user_address.clone())
            .unwrap_or(Map::new(&env));

        let mut country_balances: Map<Address, i128> = user_balances
            .get(country_code.clone())
            .unwrap_or(Map::new(&env));

        let current_balance = country_balances.get(asset.clone()).unwrap_or(0);
        let new_balance = current_balance.checked_add(amount)
            .unwrap_or_else(|| panic!("Balance overflow"));
        country_balances.set(asset.clone(), new_balance);
        user_balances.set(country_code.clone(), country_balances);
        balances_map.set(user_address.clone(), user_balances);
        env.storage().persistent().set(&symbol_short!("Balances"), &balances_map);

        true
    }

    /// Execute payment from country-specific vault
    /// Following the same pattern as XYZ-Wallet: verify auth, check balance, transfer, update storage
    pub fn execute_payment(
        env: Env,
        signer_address: Address,
        country_code: String,
        destination: Address,
        amount: i128,
        asset: Address,
        _signature_payload: Bytes, // WebAuthn signature payload (can be verified externally)
        _webauthn_signature: Bytes, // WebAuthn signature (for future verification)
        _webauthn_authenticator_data: Bytes, // WebAuthn authenticator data
        _webauthn_client_data: Bytes, // WebAuthn client data JSON
    ) -> bool {
        // Validate country code first
        if !Self::validate_country_code(&env, &country_code) {
            panic!("Invalid or disabled country code");
        }

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        // Require authorization from the user BEFORE token operations
        // Soroban's authorization framework handles signature verification and replay prevention
        signer_address.require_auth();

        // Check user's logical balance for this asset in this country
        // The contract tracks per-user, per-country balances in storage
        let user_balance = Self::get_balance(env.clone(), signer_address.clone(), country_code.clone(), asset.clone());
        if user_balance < amount {
            panic!("Insufficient balance");
        }

        // Create token client for the asset
        let token_client = token::Client::new(&env, &asset);
        let contract_address = env.current_contract_address();
        
        // Custodial model: Contract holds the tokens
        // Transfer directly from contract's balance to destination
        token_client.transfer(&contract_address, &destination, &amount);

        // Update country-specific balance (deduct the transferred amount)
        let mut balances_map: Map<Address, Map<String, Map<Address, i128>>> = env
            .storage()
            .persistent()
            .get(&symbol_short!("Balances"))
            .unwrap_or(Map::new(&env));

        let mut user_balances: Map<String, Map<Address, i128>> = balances_map
            .get(signer_address.clone())
            .unwrap_or(Map::new(&env));

        let mut country_balances: Map<Address, i128> = user_balances
            .get(country_code.clone())
            .unwrap_or(Map::new(&env));

        let current_balance = country_balances.get(asset.clone()).unwrap_or(0);
        let new_balance = current_balance.checked_sub(amount)
            .unwrap_or_else(|| panic!("Balance underflow"));
        country_balances.set(asset.clone(), new_balance);
        user_balances.set(country_code.clone(), country_balances);
        balances_map.set(signer_address.clone(), user_balances);
        env.storage().persistent().set(&symbol_short!("Balances"), &balances_map);

        true
    }

    /// Get balance for a specific country and asset
    pub fn get_balance(
        env: Env,
        user_address: Address,
        country_code: String,
        asset: Address,
    ) -> i128 {
        let balances_map: Map<Address, Map<String, Map<Address, i128>>> = env
            .storage()
            .persistent()
            .get(&symbol_short!("Balances"))
            .unwrap_or(Map::new(&env));

        let user_balances: Map<String, Map<Address, i128>> = balances_map
            .get(user_address)
            .unwrap_or(Map::new(&env));

        let country_balances: Map<Address, i128> = user_balances
            .get(country_code)
            .unwrap_or(Map::new(&env));

        country_balances.get(asset).unwrap_or(0)
    }

    /// Get all asset balances for a user in a specific country
    pub fn get_user_country_balances(
        env: Env,
        user_address: Address,
        country_code: String,
    ) -> Map<Address, i128> {
        let balances_map: Map<Address, Map<String, Map<Address, i128>>> = env
            .storage()
            .persistent()
            .get(&symbol_short!("Balances"))
            .unwrap_or(Map::new(&env));

        let user_balances: Map<String, Map<Address, i128>> = balances_map
            .get(user_address)
            .unwrap_or(Map::new(&env));

        user_balances.get(country_code).unwrap_or(Map::new(&env))
    }

    /// Get all countries where user has balances
    pub fn get_user_countries(env: Env, user_address: Address) -> Vec<String> {
        let balances_map: Map<Address, Map<String, Map<Address, i128>>> = env
            .storage()
            .persistent()
            .get(&symbol_short!("Balances"))
            .unwrap_or(Map::new(&env));

        let user_balances: Map<String, Map<Address, i128>> = balances_map
            .get(user_address)
            .unwrap_or(Map::new(&env));

        let mut result = vec![&env];
        user_balances.iter().for_each(|(country_code, _)| {
            result.push_back(country_code);
        });

        result
    }

    /// Get total balance across all countries for a specific asset
    pub fn get_total_balance(
        env: Env,
        user_address: Address,
        asset: Address,
    ) -> i128 {
        let balances_map: Map<Address, Map<String, Map<Address, i128>>> = env
            .storage()
            .persistent()
            .get(&symbol_short!("Balances"))
            .unwrap_or(Map::new(&env));

        let user_balances: Map<String, Map<Address, i128>> = balances_map
            .get(user_address)
            .unwrap_or(Map::new(&env));

        let mut total = 0i128;
        user_balances.iter().for_each(|(_, country_balances)| {
            if let Some(balance) = country_balances.get(asset.clone()) {
                total = total.checked_add(balance)
                    .unwrap_or_else(|| panic!("Total balance overflow"));
            }
        });

        total
    }
}

#[cfg(test)]
mod test;
