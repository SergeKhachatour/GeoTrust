# CORS Configuration for Soroban RPC

## Problem

When deploying the frontend to a domain (e.g., `https://geotrust.stellargeolink.com`), the browser blocks requests to `https://soroban-testnet.stellar.org` due to CORS (Cross-Origin Resource Sharing) restrictions.

## Solution Options

### Option 1: Use Built-in Backend Proxy (Recommended - Already Implemented!)

✅ **The proxy is already built into your server!** The `server.js` file created during build includes a Soroban RPC proxy endpoint.

1. **The proxy endpoint is available at:** `/api/soroban-rpc`
2. **Update the RPC URL** in your deployment environment:
   ```bash
   REACT_APP_SOROBAN_RPC_URL=https://geotrust.stellargeolink.com/api/soroban-rpc
   ```

This is the best solution because:
- ✅ No third-party dependencies
- ✅ Already implemented in your server
- ✅ Full control over the proxy
- ✅ Better security and reliability
- ✅ Same domain = no CORS issues

### Option 2: Public CORS Proxy (Not Recommended)

**⚠️ Warning:** Public CORS proxies are unreliable and may have security/privacy concerns. Only use for testing.

If you must use a public proxy, the format depends on the service. Most work like:
- `https://proxy-service.com/?url=https://soroban-testnet.stellar.org`
- Or: `https://proxy-service.com/https://soroban-testnet.stellar.org`

**Note:** The example `corsproxy.io` was just a placeholder - you'd need to find a working service and use their specific format.

Example backend proxy (Node.js/Express):
```javascript
app.post('/api/soroban-rpc', async (req, res) => {
  try {
    const response = await fetch('https://soroban-testnet.stellar.org', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Option 3: Contact Stellar

You could also contact Stellar to request CORS headers be added to their RPC endpoint for your domain, but this is unlikely to be approved for public endpoints.

## Configuration

The RPC URL is now configurable via the `REACT_APP_SOROBAN_RPC_URL` environment variable. If not set, it defaults to `https://soroban-testnet.stellar.org`.

**For local development:** No changes needed (CORS doesn't apply to `localhost`)

**For production deployment:** Set `REACT_APP_SOROBAN_RPC_URL` to your CORS proxy or backend endpoint.
