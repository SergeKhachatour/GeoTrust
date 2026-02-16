# Azure Web App Deployment Guide

This guide explains how to deploy GeoTrust to Azure App Service.

## Prerequisites

1. **Azure Account** with an active subscription
2. **GitHub Account** with the repository
3. **Azure CLI** (optional, for manual deployment)

## Step 1: Create Azure Web App

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new **Web App** resource
3. Configure:
   - **Name**: `GeoTrust` (or your preferred name)
   - **Runtime Stack**: `Node 22 LTS`
   - **Operating System**: `Linux`
   - **App Service Plan**: Basic (B1) or higher
   - **Region**: Choose closest to your users

## Step 2: Configure Environment Variables

In Azure Portal, go to your Web App → **Configuration** → **Application settings**:

Add these environment variables:

```
REACT_APP_MAPBOX_TOKEN=your_mapbox_token_here
REACT_APP_CONTRACT_ID=your_contract_id_here
REACT_APP_VERIFIER_ID=your_verifier_id_here
REACT_APP_GAME_HUB_ID=your_game_hub_id_here

# GeoLink API Configuration
REACT_APP_GEOLINK_API_URL=https://testnet.stellargeolink.com
REACT_APP_GEOLINK_WALLET_PROVIDER_KEY=your_wallet_provider_key_here
REACT_APP_GEOLINK_DATA_CONSUMER_KEY=your_data_consumer_key_here
```

**Important**: These are build-time variables. They must be set in Azure before building.

**How to add in Azure Portal:**
1. Go to your Web App → **Configuration** → **Application settings**
2. Click **+ New application setting** for each variable
3. Enter the **Name** and **Value**
4. Click **Save** at the top
5. Azure will restart your app automatically

## Step 3: Set Up GitHub Secrets (for CI/CD)

If using GitHub Actions for deployment:

1. Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

   - `AZURE_WEBAPP_PUBLISH_PROFILE`: Get from Azure Portal → Web App → **Get publish profile**
   - `REACT_APP_MAPBOX_TOKEN`: Your Mapbox token
   - `REACT_APP_CONTRACT_ID`: Your contract ID
   - `REACT_APP_VERIFIER_ID`: Your verifier contract ID (optional)
   - `REACT_APP_GAME_HUB_ID`: Your Game Hub contract ID (optional)

## Step 4: Configure Deployment

### Option A: GitHub Actions (Recommended)

1. The workflow file `.github/workflows/azure-deploy.yml` is already configured
2. Push to `main` branch to trigger deployment
3. Or manually trigger from **Actions** tab

### Option B: Azure Deployment Center

1. In Azure Portal → Web App → **Deployment Center**
2. Select **GitHub** as source
3. Authorize Azure to access your GitHub
4. Select repository and branch
5. Azure will automatically deploy on push

### Option C: Manual Deployment (Local Git)

```bash
# Install Azure CLI if not already installed
az login

# Configure local git deployment
az webapp deployment source config-local-git \
  --name GeoTrust \
  --resource-group geolink_group

# Add Azure remote
git remote add azure <azure-git-url>

# Deploy
git push azure main
```

## Step 5: Configure Build Settings

Azure needs to know how to build your React app. Create a startup command:

1. Go to **Configuration** → **General settings**
2. Set **Startup Command**:
   ```bash
   node server.js
   ```
   
   **Note:** This uses a lightweight Node.js server script that's automatically included in the build folder. It starts much faster than installing packages.

Or use Azure's built-in Node.js build:

1. Azure automatically detects `package.json`
2. Runs `npm install` and `npm run build`
3. Serves from `build` folder

## Step 6: Verify Deployment

1. Go to your Web App URL: `https://geotrust.stellargeolink.com`
2. Check browser console for any errors
3. Verify environment variables are loaded (check Network tab for API calls)

## Troubleshooting

### Build Fails

- Check **Log stream** in Azure Portal
- Verify all environment variables are set
- Ensure `package.json` has correct build script

### Environment Variables Not Working

- React environment variables must start with `REACT_APP_`
- Variables must be set **before** build (not at runtime)
- Restart the app after changing environment variables

### App Shows Blank Page

- Check browser console for errors
- Verify Mapbox token is valid
- Check Network tab for failed API calls
- Review Azure **Log stream** for server errors

### Port Configuration

- Azure uses port 8080 by default
- The app is configured to work on any port
- No need to set `PORT` environment variable

## Custom Domain (Optional)

1. Go to **Custom domains** in Azure Portal
2. Add your domain
3. Follow DNS configuration instructions
4. Azure will provision SSL certificate automatically

## Scaling

- **Basic (B1)**: 1 instance, suitable for testing
- **Standard (S1)**: Multiple instances, auto-scaling
- **Premium (P1)**: Higher performance, more features

Upgrade in **App Service Plan** → **Scale up**.

## Monitoring

- **Application Insights**: Already configured
- **Log stream**: Real-time logs in Azure Portal
- **Metrics**: CPU, memory, response time in **Overview**

## Cost Optimization

- Use **Basic (B1)** for development/testing
- Enable **Always On** only if needed (costs extra)
- Set up **Auto-shutdown** for non-production environments

## Security

- Environment variables are encrypted at rest
- HTTPS is enabled by default
- Consider adding **Authentication** in **Authentication/Authorization** settings

## Next Steps

1. Set up custom domain (optional)
2. Configure Application Insights alerts
3. Set up staging slot for testing
4. Configure backup and restore

## Support

- Azure Documentation: https://docs.microsoft.com/azure/app-service
- Stellar Documentation: https://soroban.stellar.org/docs
