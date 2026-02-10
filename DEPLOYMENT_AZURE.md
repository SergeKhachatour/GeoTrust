# Quick Azure Deployment Checklist

## ✅ Completed Steps

1. ✅ Azure Web App created: `GeoTrust`
2. ✅ Resource Group: `geolink_group`
3. ✅ Runtime: Node 22 LTS on Linux
4. ✅ GitHub Repository: https://github.com/SergeKhachatour/GeoTrust
5. ✅ Publish Profile downloaded

## 🔧 Required Configuration

### 1. Set Environment Variables in Azure Portal

Go to: **Azure Portal** → **GeoTrust** → **Configuration** → **Application settings**

Add these **Application settings**:

| Name | Value |
|------|-------|
| `REACT_APP_MAPBOX_TOKEN` | `pk.eyJ1Ijoic2VyZ2UzNjl4MzMiLCJhIjoiY20zZHkzb2xoMDA0eTJxcHU4MTNoYjNlaCJ9.Xl6OxzF9td1IgTTeUp526w` |
| `REACT_APP_CONTRACT_ID` | `CAW645ORVZG64DEOEC3XZ6DYJU56Y35ERVXX4QO6DNDTWDZS6ADONTPR` |
| `REACT_APP_VERIFIER_ID` | `CCG3E6Q53MKZCMYOIRKLRLIQVEK45TDYCCAAPZH32MB4CDN7N5NTLYBC` |
| `REACT_APP_GAME_HUB_ID` | `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG` |

**Important**: Click **Save** after adding all variables, then **Restart** the app.

### 2. Set Up GitHub Secrets

Go to: **GitHub Repo** → **Settings** → **Secrets and variables** → **Actions**

Add these secrets:

1. **`AZURE_WEBAPP_PUBLISH_PROFILE`**
   - Value: Paste the **entire XML content** from your publish profile file
   - This is the XML you just downloaded

2. **`REACT_APP_MAPBOX_TOKEN`**
   - Value: `pk.eyJ1Ijoic2VyZ2UzNjl4MzMiLCJhIjoiY20zZHkzb2xoMDA0eTJxcHU4MTNoYjNlaCJ9.Xl6OxzF9td1IgTTeUp526w`

3. **`REACT_APP_CONTRACT_ID`**
   - Value: `CAW645ORVZG64DEOEC3XZ6DYJU56Y35ERVXX4QO6DNDTWDZS6ADONTPR`

4. **`REACT_APP_VERIFIER_ID`** (optional)
   - Value: `CCG3E6Q53MKZCMYOIRKLRLIQVEK45TDYCCAAPZH32MB4CDN7N5NTLYBC`

5. **`REACT_APP_GAME_HUB_ID`** (optional)
   - Value: `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG`

**Note**: The publish profile XML should start with `<publishData>` and end with `</publishData>`.

### 3. Configure Deployment Source (Optional - Alternative to GitHub Actions)

**Option A: Azure Deployment Center (Easiest - Recommended)**

1. Go to **Deployment Center** in Azure Portal
2. Select **GitHub** as source
3. Click **Authorize** and sign in with GitHub
4. Select:
   - **Organization**: `SergeKhachatour`
   - **Repository**: `GeoTrust`
   - **Branch**: `main`
5. Click **Save**
6. Azure will automatically deploy on every push to `main`

**Option B: GitHub Actions (Current Setup)**

The workflow is already configured. Just add the secrets above and it will deploy automatically on push.

## 🚀 Deploy

### First Deployment

1. **Add GitHub Secrets** (see step 2 above)

2. **Push to trigger deployment** (if using GitHub Actions):
   ```bash
   git push origin main
   ```

3. **Or use Azure Deployment Center** (if using Option A):
   - Just push to `main` and Azure will deploy automatically

### Verify Deployment

1. Visit: `https://geotrust.stellargeolink.com`
2. Open browser console (F12)
3. Check for:
   - ✅ Mapbox token loaded
   - ✅ Contract ID loaded
   - ✅ No errors

## 🔍 Troubleshooting

### App shows blank page
- Check **Log stream** in Azure Portal
- Verify environment variables are set correctly in Azure Portal
- Check browser console for errors

### Environment variables not working
- Variables must start with `REACT_APP_`
- Restart app after changing variables
- Variables are build-time, not runtime
- Make sure they're set in **both** Azure Portal (for runtime) and GitHub Secrets (for build)

### Build fails
- Check **Log stream** for error messages
- Verify `package.json` is correct
- Ensure Node.js version is 22.x
- Check GitHub Actions logs if using Actions

### Deployment not triggering
- Check GitHub Actions permissions
- Verify publish profile secret is correct
- Check deployment logs in Azure Portal

## 📝 Next Steps

1. ✅ Set environment variables in Azure Portal
2. ✅ Add GitHub secrets (publish profile + env vars)
3. ✅ Push code to GitHub (or use Azure Deployment Center)
4. ✅ Verify deployment
5. ⏭️ Set up custom domain (optional)
6. ⏭️ Configure Application Insights alerts

## 🔗 Useful Links

- **Azure Portal**: https://portal.azure.com
- **GitHub Repo**: https://github.com/SergeKhachatour/GeoTrust
- **App URL**: https://geotrust.stellargeolink.com
