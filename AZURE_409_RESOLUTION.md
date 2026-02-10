# Resolve Azure 409 Conflict - Step by Step

## Your App Domain
**Live URL**: https://geotrust.stellargeolink.com

## Why 409 Conflicts Happen
Azure locks the app during deployments. If multiple deployments try to run simultaneously, you get a 409 Conflict error.

## Immediate Resolution Steps

### Step 1: Check Azure Portal (REQUIRED)
1. Go to **Azure Portal** → **GeoTrust** → **Deployment Center**
2. Click on the **Logs** tab
3. Look for any deployment that shows "In Progress" or "Running"
4. **Wait for it to complete** (usually 2-5 minutes)

### Step 2: Check App Status
1. Go to **Azure Portal** → **GeoTrust** → **Overview**
2. Check the **Status** - it should be "Running"
3. If it shows "Restarting" or "Stopped", wait for it to finish

### Step 3: Check for Multiple Deployment Sources
**This is often the cause!**

1. Go to **Azure Portal** → **GeoTrust** → **Deployment Center**
2. Check the **Settings** tab
3. Make sure you have **ONLY ONE** deployment source:
   - Either **GitHub Actions** (via publish profile)
   - OR **Azure Deployment Center** (direct GitHub connection)
   - **NOT BOTH** - having both causes conflicts!

If you have both:
- **Recommended**: Keep GitHub Actions, remove Azure Deployment Center
- Go to **Deployment Center** → **Disconnect** the Azure Deployment Center connection
- Keep only the GitHub Actions workflow

### Step 4: Restart the App (If Still Stuck)
1. Go to **Azure Portal** → **GeoTrust** → **Overview**
2. Click **Restart**
3. Wait 2-3 minutes for restart to complete
4. Then retry the deployment

### Step 5: Retry Deployment
After completing steps 1-4:
1. Go to **GitHub Actions** → **Actions** tab
2. Find the failed workflow run
3. Click **Re-run all jobs**

## Prevention (Already Implemented)
The workflow now has:
- ✅ Concurrency control (prevents multiple simultaneous runs)
- ✅ 60-second initial wait
- ✅ Automatic retry with 90-second wait
- ✅ 10-minute timeout

## If It Still Fails After All Steps

Try deploying manually via Azure Portal:
1. **Azure Portal** → **GeoTrust** → **Deployment Center**
2. Click **Sync** or **Redeploy**
3. This will use Azure's built-in deployment

Or use Azure CLI:
```bash
az webapp deployment source sync --name GeoTrust --resource-group geolink_group
```

## Verify Deployment
After successful deployment:
1. Visit: https://geotrust.stellargeolink.com
2. Check browser console (F12) for errors
3. Verify the app loads correctly
