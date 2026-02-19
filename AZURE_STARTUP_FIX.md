# Azure Startup Command Fix

## Problem

Azure is trying to run `npm run azure-start` but can't find `package.json`. The error shows:
```
npm error path /package.json
npm error enoent Could not read package.json
```

## Solution

Change the Azure startup command to use an absolute path:

### In Azure Portal:

1. Go to **Configuration** → **General settings**
2. Find **Startup Command**
3. Change it from:
   ```
   npm run azure-start
   ```
   
   To:
   ```
   cd /home/site/wwwroot && cd server && npm start
   ```
   
   Or simply:
   ```
   cd /home/site/wwwroot/server && npm start
   ```

4. Click **Save**
5. **Restart** the app

## Why This Works

- Azure runs commands from `/home/site/wwwroot` by default
- The `server/` directory is at `/home/site/wwwroot/server/`
- Using absolute paths ensures npm finds the correct `package.json`
- The server's `package.json` is in `/home/site/wwwroot/server/package.json`

## Alternative: Use Relative Path

If the working directory is already `/home/site/wwwroot`, you can also use:
```
cd server && npm start
```

But the absolute path is more reliable.
