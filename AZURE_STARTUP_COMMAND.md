# Azure Startup Command Configuration

## Problem
Azure Web App shows "Your web app is running and waiting for your content" because it doesn't know how to serve the React app.

## Solution

### Option 1: Set Startup Command in Azure Portal (Recommended)

1. Go to **Azure Portal** → **GeoTrust** → **Configuration** → **General settings**
2. Find **Startup Command**
3. Set it to one of these options:

   **Option A (Recommended - direct command):**
   ```
   npm install -g serve && serve -s . -l 8080
   ```
   
   **Option B (Alternative - if package.json is deployed):**
   ```
   npm install && npm run start:prod
   ```
   
   **Note:** Since only the `build` folder is deployed, use Option A. The `.` tells serve to serve the current directory (which is the build folder).

4. Click **Save**
5. Go to **Overview** → **Restart**

**Note:** `npm start` won't work because it runs the development server. Use `npm run start:prod` instead, which serves the built static files.

### Option 2: Use web.config (Windows) or .htaccess (Linux)

For Linux App Service, create a startup script or use the startup command above.

### Option 3: Use Azure Deployment Center with Build Configuration

1. Go to **Deployment Center**
2. Configure build settings to:
   - Build command: `npm run build`
   - Output directory: `build`
   - Startup command: `npm install -g serve && serve -s build -l 8080`

## Verify

After setting the startup command:
1. Restart the app in Azure Portal
2. Wait 1-2 minutes for restart
3. Visit the app URL
4. Check **Log stream** in Azure Portal to see if `serve` is running

## Troubleshooting

If the app still doesn't load:
- Check **Log stream** for errors
- Verify the `build` folder exists in the deployment
- Ensure `serve` package is installed (it's in package.json)
- Check that port 8080 is accessible (Azure default)
