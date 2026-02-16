# GeoLink API Integration

GeoTrust Match now integrates with the Stellar GeoLink backend API for enhanced location services, session management, and user interactions.

## Features

### 1. Location Updates
- Automatically updates user location to GeoLink API when location changes
- Periodic updates every 60 seconds while location is available
- Used for nearby user discovery and session matching

### 2. Nearby Users, NFTs, and Contracts
- Fetches nearby users from GeoLink API based on current location
- Displays nearby NFTs with location data
- Shows nearby smart contract markers
- Updates automatically when location or search radius changes

### 3. Real Session Management
- Creates sessions in GeoLink backend in addition to on-chain sessions
- Enables real-time session discovery and matching
- Syncs session state between on-chain and GeoLink backend

### 4. Wallet Persistence
- Improved wallet connection persistence across page refreshes
- Stores wallet type/ID to enable automatic reconnection
- Better handling of external wallet connections (Freighter, xBull, etc.)

## Configuration

Add the following environment variables to `.env.local`:

```bash
# GeoLink API Configuration
REACT_APP_GEOLINK_API_URL=https://testnet.stellargeolink.com
REACT_APP_GEOLINK_API_KEY=your_api_key_here
```

### Getting an API Key

1. Register as a Wallet Provider or Data Consumer on GeoLink
2. Generate an API key from your dashboard
3. Add it to your `.env.local` file

## API Endpoints Used

### Location Services
- `POST /api/location/update` - Update wallet location
- `GET /api/location/nearby` - Find nearby wallets/users

### NFT Services
- `GET /api/nft/nearby` - Find nearby NFTs

### Contract Services
- `GET /api/contracts` - Get nearby contract markers

### Session Services
- `POST /api/sessions` - Create/update session
- `GET /api/sessions/:id` - Get session by ID
- `GET /api/sessions?user=:publicKey` - Get user's active sessions

## Future Enhancements

### Payment Integration
- Send payments between users via GeoLink API
- Integration with Stellar payment channels

### Smart Contract Rules
- Create location-based smart contract rules via GeoLink API
- Multi-wallet quorum rules for collaborative transactions

### User Profiles
- View other user profiles when clicking on markers
- Trustline comparison (already implemented)
- Transaction history

## Architecture

```
GeoTrust Frontend
    ├── On-chain Sessions (Soroban Contract)
    ├── GeoLink Backend API
    │   ├── Location Updates
    │   ├── Nearby Users/NFTs/Contracts
    │   ├── Session Management
    │   └── User Profiles
    └── Wallet Integration
        └── Stellar Wallets Kit (Freighter, xBull, etc.)
```

## Notes

- GeoLink integration is optional - the app will continue to work without it
- Location updates and nearby user discovery will fall back gracefully if API is unavailable
- On-chain sessions remain the source of truth for game state
- GeoLink sessions provide real-time discovery and matching capabilities
