# Azure Deployment with Backend Server

## Overview

The GeoTrust application uses a backend server (like xyz-wallet) that serves both:
- API endpoints (`/api/*`)
- React static files (from `build/` directory)

## Azure Configuration

### Startup Command

In Azure Portal → Your App Service → Configuration → General settings:

**Startup Command:**
```
cd /home/site/wwwroot/server && npm install --production && npm start
```

**Important:** Use the absolute path `/home/site/wwwroot/server` to ensure npm finds the correct `package.json` file.

**Alternative (if working directory is already `/home/site/wwwroot`):**
```
cd server && npm start
```

**Note:** Do NOT use `npm run azure-start` in Azure, as it may have path resolution issues.

### Build Process

The GitHub Actions workflow should:
1. Build the React app: `npm run build`
2. Install server dependencies: `cd server && npm install`
3. Deploy everything to Azure

The server will automatically:
- Serve API endpoints at `/api/*`
- Serve React static files from the `build/` directory
- Handle React routing (SPA)

### Environment Variables

Set in Azure Portal → Configuration → Application settings:

**Backend Variables:**
```
NODE_ENV=production
PORT=8080
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

**Frontend Variables (for build):**
```
REACT_APP_MAPBOX_TOKEN=your_mapbox_token
REACT_APP_CONTRACT_ID=your_contract_id
REACT_APP_VERIFIER_ID=your_verifier_id
REACT_APP_GEOLINK_API_URL=your_geolink_url
REACT_APP_GEOLINK_WALLET_PROVIDER_KEY=your_key
REACT_APP_GEOLINK_DATA_CONSUMER_KEY=your_key
REACT_APP_SOROBAN_RPC_URL=https://your-app.azurewebsites.net/api/soroban-rpc
```

Note: `REACT_APP_SOROBAN_RPC_URL` should point to your Azure app's proxy endpoint.

### File Structure in Azure

After deployment, Azure should have:
```
/
├── server/
│   ├── index.js
│   ├── routes/
│   │   ├── countries.js
│   │   └── soroban-rpc.js
│   ├── package.json
│   └── node_modules/
├── build/
│   ├── index.html
│   ├── static/
│   └── countries.geojson
└── package.json
```

### How It Works

1. **API Requests**: All `/api/*` requests are handled by Express routes
2. **Static Files**: All other requests serve React static files
3. **SPA Routing**: Any non-API route returns `index.html` for client-side routing

### Verification

After deployment, test:
- `https://your-app.azurewebsites.net/health` - Should return `{"status":"OK"}`
- `https://your-app.azurewebsites.net/api/countries` - Should return GeoJSON
- `https://your-app.azurewebsites.net/` - Should load React app

### Troubleshooting

**If API endpoints return 404:**
- Check that server routes are properly set up
- Verify server is running (check Log stream in Azure)

**If React app doesn't load:**
- Check that `build/` directory exists
- Verify `build/index.html` exists
- Check server logs for path resolution

**If countries.geojson can't be updated:**
- Verify file permissions in Azure
- Check that `public/countries.geojson` is copied to `build/` during build
- Verify the server can write to the file location
