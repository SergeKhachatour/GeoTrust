# GeoTrust Match

[![Deploy to Azure](https://img.shields.io/badge/Deploy%20to-Azure-blue)](https://portal.azure.com)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Azure%20Web%20App-green)](https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net)

**Live on Azure**: https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net

On-chain location-based matching game built on Stellar Soroban with country gating and ZK proofs.

## Features

- **On-chain Session Management**: 2-player sessions stored entirely on-chain with TTL
- **Country Allow/Deny Gating**: Admin-managed country restrictions enforced on-chain
- **Mapbox Globe Visualization**: Interactive 3D globe showing allowed/blocked countries
- **Admin Panel**: Toggle country policies directly from the map
- **ZK Country Proofs**: Optional Noir circuit for country restriction verification
- **Upgradeable Contracts**: Admin-controlled contract upgrades
- **Game Hub Integration**: Calls Stellar Game Studio Game Hub for session lifecycle

## Architecture

### Contract (Soroban)

- **Storage**: Admin, country allowlist/denylist, session state (temporary with TTL)
- **Endpoints**:
  - `init(admin, default_allow_all)`: Initialize contract
  - `set_country_allowed(country, allowed)`: Admin-only country policy
  - `create_session()`: Create new 2-player session
  - `join_session(session_id, cell_id, asset_tag, country)`: Join with country check
  - `resolve_match(session_id)`: Determine match and call Game Hub
  - `upgrade(new_wasm_hash)`: Admin-only contract upgrade

### Frontend (React + Mapbox)

- **Globe View**: Mapbox 3D globe projection
- **Country Overlay**: Visual indication of allowed/blocked countries
- **Location Sharing**: Browser geolocation → country code → on-chain join
- **Admin UI**: Click countries on map to toggle policy

### ZK Circuit (Noir)

- **Country Restriction Proof**: Prove country is NOT in restricted list
- Optional badge/verification mechanism (not enforced on-chain in MVP)

## Setup

### Prerequisites

- Node.js 18+
- Rust + wasm32 target
- Soroban CLI
- Freighter wallet extension

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your Mapbox token and contract ID
   ```

3. **Build contract**:
   ```bash
   ./scripts/build-contract.sh
   ```

4. **Deploy contract** (first time):
   ```bash
   export ADMIN_ADDRESS="your_admin_address"
   ./scripts/deploy-contract.sh
   ```

5. **Start frontend** (runs on port 3366):
   ```bash
   npm start
   ```
   
   The app will be available at `http://localhost:3366`

## Usage

### As Player

1. Connect Freighter wallet
2. Click "Share Location / Join Game"
3. Grant location permission
4. System derives country code and checks on-chain policy
5. If allowed, session is created and link is shown
6. Share link with opponent

### As Admin

1. Connect admin wallet
2. Admin panel appears automatically
3. Toggle countries via:
   - Search box + toggle button
   - Click directly on map country polygons
4. Changes are written on-chain immediately

## Contract Deployment

### Initial Deployment

```bash
export ADMIN_ADDRESS="G..."
export NETWORK="testnet"
./scripts/deploy-contract.sh
```

### Upgrade Contract

```bash
export CONTRACT_ID="C..."
./scripts/build-contract.sh
./scripts/upgrade-contract.sh
```

## Game Hub Integration

The contract calls Game Hub at two points:

1. **When second player joins**: `start_game(session_id, player1, player2, 0, 0)`
2. **When match resolved**: `end_game(session_id, winner)`

Set Game Hub address via `set_game_hub(game_hub_address)` (admin-only).

## Country Code Format

Uses ISO 3166-1 numeric codes (e.g., 840 for US, 826 for GB).

Frontend converts ISO2 codes from Mapbox Geocoding API to numeric codes.

## Azure Deployment

This app is deployed to Azure App Service. See [DEPLOYMENT_AZURE.md](./DEPLOYMENT_AZURE.md) for detailed deployment instructions.

**Live URL**: https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net

**Quick Setup:**
1. Set environment variables in Azure Portal (Configuration → Application settings)
2. Configure GitHub deployment source (Deployment Center)
3. Push to `main` branch to auto-deploy

## Protocol 25 (X-Ray) Integration

**Status:** ✅ **Fully Implemented** - Using Protocol 25 BN254 pairing and cryptographic verification

**Current Implementation:**
- ✅ BN254 pairing operations (`bn254.pairing_check`) for Groth16 proof verification
- ✅ BN254 G1/G2 point operations (`g1_add`, `g1_mul`) for IC computation
- ✅ SHA256 hashing for proof IDs (Poseidon available with `hazmat-crypto` feature)
- ✅ True cryptographic proof verification (not structure-based)
- ✅ Production-ready ZK verifier contract

**SDK Version:** `soroban-sdk = "25.0.0"`

**Note:** BN254 is the same curve used by Ethereum (EIP-196/EIP-197), so ZK tools like circom and snarkjs work with both Ethereum and Stellar Protocol 25.

See [PROTOCOL_25_IMPLEMENTATION.md](./PROTOCOL_25_IMPLEMENTATION.md) for details.

## Security Notes

- **No database**: All state is on-chain only
- **Country gating**: Enforced on-chain, but country derivation is client-side (not cryptographically proven)
- **ZK proofs**: Structure validation (upgradeable to Protocol 25 pairing verification)
- **Upgradeability**: Admin-controlled, storage schema must remain stable

## Development

### Contract Tests

```bash
cd contracts/geotrust-match
cargo test
```

### ZK Circuit

```bash
cd circuits/country-restriction
nargo prove
nargo verify
```

## License

MIT
