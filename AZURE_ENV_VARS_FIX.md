# Fix Azure Environment Variables

## Issue: Mapbox 401 Error

The Mapbox token is returning 401 (Unauthorized), which means either:
1. The token is invalid/expired
2. The token is not set correctly in Azure Portal
3. The token has restrictions that prevent it from being used

## Solution

### 1. Verify Mapbox Token

Check your Mapbox token at: https://account.mapbox.com/access-tokens/

Make sure:
- Token is active
- Token has the correct scopes (styles:read, geocoding:read)
- Token doesn't have URL restrictions that block Azure

### 2. Set Environment Variables in Azure Portal

Go to **Azure Portal** → **GeoTrust** → **Configuration** → **Application settings**

Add/Update these variables:

| Name | Value |
|------|-------|
| `REACT_APP_MAPBOX_TOKEN` | `pk.eyJ1Ijoic2VyZ2UzNjl4MzMiLCJhIjoiY20zZHkzb2xoMDA0eTJxcHU4MTNoYjNlaCJ9.Xl6OxzF9td1IgTTeUp526w` |
| `REACT_APP_CONTRACT_ID` | `CAW645ORVZG64DEOEC3XZ6DYJU56Y35ERVXX4QO6DNDTWDZS6ADONTPR` |
| `REACT_APP_VERIFIER_ID` | `CCG3E6Q53MKZCMYOIRKLRLIQVEK45TDYCCAAPZH32MB4CDN7N5NTLYBC` |
| `REACT_APP_GAME_HUB_ID` | `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG` |

**Important Notes:**
- These are **build-time** variables for React
- They must be set in **both**:
  1. **Azure Portal** (for the deployed app)
  2. **GitHub Secrets** (for the build process)
- After setting, click **Save** and **Restart** the app

### 3. Update GitHub Secrets (for CI/CD)

Go to **GitHub Repo** → **Settings** → **Secrets and variables** → **Actions**

Ensure these secrets are set:
- `REACT_APP_MAPBOX_TOKEN`
- `REACT_APP_CONTRACT_ID`
- `REACT_APP_VERIFIER_ID`
- `REACT_APP_GAME_HUB_ID`

### 4. Rebuild and Redeploy

After updating environment variables:
1. **Restart** the Azure Web App
2. If using GitHub Actions, **trigger a new deployment** (push to main or manually trigger workflow)
3. Wait 2-3 minutes for deployment to complete

## Verify

After restarting:
1. Visit the app URL
2. Open browser console (F12)
3. Check for:
   - ✅ `[App] Mapbox token loaded` (no 401 errors)
   - ✅ Map loads correctly
   - ✅ No "Unauthorized" errors in Network tab

## Contract Errors

The `set_verifier` and `set_game_hub` errors are being handled gracefully - they may already be set. The fix for contract ID address conversion has been applied in the code.
