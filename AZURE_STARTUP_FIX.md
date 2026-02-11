# Azure Startup Timeout Fix

## Problem
The Azure app was timing out during startup because it was trying to install `serve` globally on every container start, which took over 3 minutes and exceeded the 230-second timeout.

## Solution
Created a lightweight Node.js server script (`server.js`) that uses only built-in Node.js modules (no package installation required). This server:
- Starts instantly (no package installation)
- Serves static files from the build folder
- Handles client-side routing (serves `index.html` for all routes)
- Supports all common MIME types

## What Changed
1. **Created `scripts/create-server.js`**: Script that generates `server.js` in the build folder
2. **Updated `package.json`**: Build script now automatically creates `server.js` after building
3. **Updated GitHub Actions**: Build process includes the server script
4. **Updated documentation**: All Azure docs now reference the new startup command

## Action Required: Update Azure Startup Command

**You must update the startup command in Azure Portal:**

1. Go to **Azure Portal** → **GeoTrust** → **Configuration** → **General settings**
2. Find **Startup Command**
3. Change it from:
   ```
   npm install -g serve && serve -s . -l 8080
   ```
   To:
   ```
   node server.js
   ```
4. Click **Save**
5. Go to **Overview** → **Restart**

## Why This Works
- The `server.js` file is automatically created in the `build` folder during the GitHub Actions build
- When the build folder is deployed to Azure, `server.js` is included
- Node.js is already available in the container, so no installation is needed
- The server starts in milliseconds instead of minutes

## Verification
After updating the startup command and restarting:
1. Check **Log stream** in Azure Portal
2. You should see: `Server running at http://localhost:8080/`
3. The app should load within seconds instead of timing out
