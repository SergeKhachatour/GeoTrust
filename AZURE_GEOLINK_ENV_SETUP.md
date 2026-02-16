# Azure Environment Variables Setup for GeoLink Integration

## Quick Setup Guide

You need to add the GeoLink API keys to **both**:
1. **Azure Portal** (for runtime)
2. **GitHub Secrets** (for CI/CD builds)

---

## 1. Azure Portal Configuration

### Step-by-Step:

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to your Web App**: Find "GeoTrust" or your app name
3. **Go to Configuration**: 
   - Left sidebar → **Configuration**
   - Or: **Settings** → **Configuration**
4. **Application settings tab**: Click on it
5. **Add each variable**:

   Click **+ New application setting** for each:

   | Name | Value |
   |------|-------|
   | `REACT_APP_GEOLINK_API_URL` | `https://testnet.stellargeolink.com` |
   | `REACT_APP_GEOLINK_WALLET_PROVIDER_KEY` | `your_wallet_provider_key_here` |
   | `REACT_APP_GEOLINK_DATA_CONSUMER_KEY` | `your_data_consumer_key_here` |

6. **Save**: Click **Save** button at the top
7. **Restart**: Azure will automatically restart your app

### Visual Guide:

```
Azure Portal
  └── Your Web App (GeoTrust)
      └── Configuration
          └── Application settings
              └── + New application setting
                  ├── Name: REACT_APP_GEOLINK_API_URL
                  ├── Value: https://testnet.stellargeolink.com
                  └── OK
              └── + New application setting
                  ├── Name: REACT_APP_GEOLINK_WALLET_PROVIDER_KEY
                  ├── Value: your_wallet_provider_key_here
                  └── OK
              └── + New application setting
                  ├── Name: REACT_APP_GEOLINK_DATA_CONSUMER_KEY
                  ├── Value: your_data_consumer_key_here
                  └── OK
              └── Save (top of page)
```

---

## 2. GitHub Secrets (for CI/CD)

If you're using GitHub Actions for deployment, also add these as secrets:

1. **Go to GitHub**: Your repository → **Settings**
2. **Secrets and variables** → **Actions**
3. **New repository secret** for each:

   - `REACT_APP_GEOLINK_API_URL` = `https://testnet.stellargeolink.com`
   - `REACT_APP_GEOLINK_WALLET_PROVIDER_KEY` = `your_wallet_provider_key_here`
   - `REACT_APP_GEOLINK_DATA_CONSUMER_KEY` = `your_data_consumer_key_here`

---

## 3. Verify Configuration

After setting up:

1. **Check Azure Portal**:
   - Configuration → Application settings
   - Verify all 3 GeoLink variables are present

2. **Test the app**:
   - Visit your app URL
   - Open browser console (F12)
   - Look for GeoLink API logs: `[GeoLinkAPI] ...`

3. **Check deployment logs**:
   - GitHub Actions → Latest workflow run
   - Or: Azure Portal → Deployment Center → Logs

---

## Important Notes

- **Build-time variables**: These are embedded during `npm run build`
- **Must be set before deployment**: Azure needs them during the build process
- **Restart required**: After adding variables, Azure restarts the app automatically
- **Security**: These keys are sensitive - never commit them to git

---

## Troubleshooting

### Variables not working?

1. **Check spelling**: Variable names are case-sensitive
2. **Verify in Azure**: Configuration → Application settings → Check all variables exist
3. **Restart app**: Configuration → General settings → Restart
4. **Check build logs**: Deployment Center → Logs → Look for build errors
5. **Browser cache**: Clear cache and hard refresh (Ctrl+Shift+R)

### Still not working?

- Check Azure Portal → Log stream for runtime errors
- Check browser console for API errors
- Verify API keys are correct in GeoLink dashboard
