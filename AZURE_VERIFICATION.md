# Azure Deployment Verification

## ✅ Check if App is Working

1. **Visit your app URL:**
   ```
   https://geotrust.stellargeolink.com
   ```

2. **What to look for:**
   - ✅ Mapbox globe map should load
   - ✅ "Connect Wallet" button should appear
   - ✅ No blank page or "waiting for content" message
   - ✅ Browser console (F12) should show:
     - `[App] Mapbox token loaded`
     - `[ContractClient] Using contract ID: ...`
     - No red errors

## 🔍 If It's Still Not Working

### Check Log Stream

1. Go to **Azure Portal** → **GeoTrust** → **Log stream**
2. Look for:
   - ✅ `serve` starting up
   - ✅ `Serving!` message
   - ✅ Listening on port 8080
   - ❌ Any error messages

### Common Issues

**Issue: "Cannot find module 'serve'" or "Could not read package.json"**
- **Fix:** Since only the `build` folder is deployed, use this startup command:
  ```
  npm install -g serve && serve -s . -l 8080
  ```
  The `.` tells serve to serve the current directory (which is the build folder).

**Issue: "Cannot find module 'build'"**
- **Fix:** The build folder wasn't deployed. Check GitHub Actions deployment logs.

**Issue: App loads but shows blank page**
- **Fix:** Check browser console for errors. Verify environment variables are set in Azure Portal.

**Issue: "Port already in use"**
- **Fix:** Azure should handle port automatically. Try restarting the app again.

## 📋 Quick Checklist

- [ ] Startup command set to `npm run start:prod`
- [ ] App restarted after setting startup command
- [ ] Waited 1-2 minutes after restart
- [ ] Checked Log stream for errors
- [ ] Environment variables set in Azure Portal (Configuration → Application settings)
- [ ] Build folder exists (check via SSH or Kudu console)

## 🔗 Useful Azure Links

- **Log Stream**: Azure Portal → GeoTrust → Log stream
- **Kudu Console**: `https://geotrust.scm.stellargeolink.com` (or check Azure Portal for the actual SCM URL)
- **Application Settings**: Azure Portal → GeoTrust → Configuration → Application settings
