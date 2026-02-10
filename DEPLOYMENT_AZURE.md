# Quick Azure Deployment Checklist

## ✅ Completed Steps

1. ✅ Azure Web App created: `GeoTrust`
2. ✅ Resource Group: `geolink_group`
3. ✅ Runtime: Node 22 LTS on Linux
4. ✅ GitHub Repository: https://github.com/SergeKhachatour/GeoTrust

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

### 2. Configure Deployment Source

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

**Option B: GitHub Actions (Advanced)**

If you prefer GitHub Actions, see [AZURE_SETUP_CREDENTIALS.md](./AZURE_SETUP_CREDENTIALS.md) for setting up Azure credentials.

**Option C: Local Git**

```bash
# Get deployment URL from Azure Portal → Deployment Center → Local Git
git remote add azure <deployment-url>
git push azure main
```

### 3. Configure Startup Command

Go to **Configuration** → **General settings** → **Startup Command**:

```bash
npm install -g serve && serve -s build -l 8080
```

Or leave empty if using Azure's automatic Node.js build.

### 4. Set Up GitHub Secrets (Only if using GitHub Actions)

**Skip this if using Azure Deployment Center (Option A above).**

If using GitHub Actions, see [AZURE_SETUP_CREDENTIALS.md](./AZURE_SETUP_CREDENTIALS.md) for detailed instructions on setting up Azure Service Principal credentials.

## 🚀 Deploy

### First Deployment

1. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Initial Azure deployment setup"
   git push origin main
   ```

2. **If using GitHub Actions**: 
   - Go to **Actions** tab in GitHub
   - Workflow will run automatically
   - Check logs for any errors

3. **If using Azure Deployment Center**:
   - Azure will automatically detect the push
   - Check **Deployment Center** → **Logs** for status

### Verify Deployment

1. Visit: `https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net`
2. Open browser console (F12)
3. Check for:
   - ✅ Mapbox token loaded
   - ✅ Contract ID loaded
   - ✅ No errors

## 🔍 Troubleshooting

### App shows blank page
- Check **Log stream** in Azure Portal
- Verify environment variables are set correctly
- Check browser console for errors

### Environment variables not working
- Variables must start with `REACT_APP_`
- Restart app after changing variables
- Variables are build-time, not runtime

### Build fails
- Check **Log stream** for error messages
- Verify `package.json` is correct
- Ensure Node.js version is 22.x

### Deployment not triggering
- Check GitHub Actions permissions
- Verify Azure service connection
- Check deployment logs in Azure Portal

## 📝 Next Steps

1. ✅ Set environment variables
2. ✅ Configure deployment source
3. ✅ Push code to GitHub
4. ✅ Verify deployment
5. ⏭️ Set up custom domain (optional)
6. ⏭️ Configure Application Insights alerts

## 🔗 Useful Links

- **Azure Portal**: https://portal.azure.com
- **GitHub Repo**: https://github.com/SergeKhachatour/GeoTrust
- **App URL**: https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net
