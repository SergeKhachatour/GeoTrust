# Mapbox Token 401 Error Debugging

## Problem
Mapbox returns 401 (Unauthorized) on Azure but works locally. This means the token in the **built JavaScript bundle** is incorrect.

## Why This Happens
React environment variables are **build-time** - they get baked into the JavaScript during `npm run build`. The token you see in the browser console is from the **built bundle**, not from Azure environment variables.

## Solution: Verify GitHub Secret Matches Local Token

### Step 1: Check Your Local Token
Check your `.env.local` file (or wherever you have the token locally):
```
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
```

### Step 2: Verify GitHub Secret
1. Go to **GitHub Repo** → **Settings** → **Secrets and variables** → **Actions**
2. Find `REACT_APP_MAPBOX_TOKEN`
3. **Copy the entire value** and compare it character-by-character with your local token
4. Common issues:
   - Extra spaces at the beginning/end
   - Missing characters
   - Different token entirely
   - Encoding issues (special characters)

### Step 3: Update GitHub Secret if Needed
If the GitHub Secret doesn't match your local token:
1. Delete the existing `REACT_APP_MAPBOX_TOKEN` secret
2. Create a new one with the **exact** value from your `.env.local`
3. Make sure there are no extra spaces or line breaks

### Step 4: Trigger New Deployment
After updating the secret:
1. Go to **Actions** tab in GitHub
2. Click **Deploy to Azure Web App** workflow
3. Click **Run workflow** → **Run workflow** (use main branch)
4. Wait 2-3 minutes for deployment to complete

### Step 5: Verify
After deployment:
1. Visit your Azure app URL
2. Open browser console (F12)
3. Check the Network tab for Mapbox requests
4. Should see **200 OK** instead of **401 Unauthorized**

## Alternative: Check Token in Browser
You can also check what token is actually in the built bundle:
1. Open browser console on Azure app
2. Type: `process.env.REACT_APP_MAPBOX_TOKEN` (won't work - React env vars are replaced at build time)
3. Instead, check the Network tab → find a Mapbox request → look at the URL
4. The token in the URL is what was baked into the build

## Token Format
Mapbox tokens should:
- Start with `pk.eyJ`
- Be about 150-200 characters long
- Have no spaces or line breaks
- Match exactly between local and GitHub Secret

## Why Azure Portal Variables Don't Help
Azure Portal environment variables won't fix this because:
- React env vars are replaced during `npm run build`
- We deploy a **pre-built** `build` folder
- The build already happened in GitHub Actions with the GitHub Secrets
- Azure Portal vars are runtime, but React needs build-time vars
