# Azure Credentials Setup for GitHub Actions

Since basic authentication is disabled, we'll use Azure Service Principal authentication instead.

## Option 1: Azure Service Principal (Recommended)

### Step 1: Create Service Principal

Run this in Azure Cloud Shell or Azure CLI:

```bash
# Login to Azure
az login

# Create service principal (replace with your subscription ID)
az ad sp create-for-rbac \
  --name "GeoTrust-GitHub-Actions" \
  --role contributor \
  --scopes /subscriptions/02cda84e-371c-4811-bacd-12e0c161275c/resourceGroups/geolink_group \
  --sdk-auth
```

This will output JSON like:
```json
{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "02cda84e-371c-4811-bacd-12e0c161275c",
  "tenantId": "...",
  "activeDirectoryEndpointUrl": "https://login.microsoftonline.com",
  "resourceManagerEndpointUrl": "https://management.azure.com/",
  "activeDirectoryGraphResourceId": "https://graph.windows.net/",
  "sqlManagementEndpointUrl": "https://management.core.windows.net:8443/",
  "galleryEndpointUrl": "https://gallery.azure.com/",
  "managementEndpointUrl": "https://management.core.windows.net/"
}
```

### Step 2: Add to GitHub Secrets

1. Go to your GitHub repository: https://github.com/SergeKhachatour/GeoTrust
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `AZURE_CREDENTIALS`
5. Value: Paste the **entire JSON output** from Step 1
6. Click **Add secret**

### Step 3: Add Other Secrets

Also add these secrets (if not already added):

- `REACT_APP_MAPBOX_TOKEN`: `pk.eyJ1Ijoic2VyZ2E3Njl4MzMiLCJhIjoiY20zZHkzb2xoMDA0eTJxcHU4MTNoYjNlaCJ9.Xl6OxzF9td1IgTTeUp526w`
- `REACT_APP_CONTRACT_ID`: `CAW645ORVZG64DEOEC3XZ6DYJU56Y35ERVXX4QO6DNDTWDZS6ADONTPR`
- `REACT_APP_VERIFIER_ID`: `CCG3E6Q53MKZCMYOIRKLRLIQVEK45TDYCCAAPZH32MB4CDN7N5NTLYBC`
- `REACT_APP_GAME_HUB_ID`: `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG`

## Option 2: Enable Basic Authentication (Alternative)

If you prefer to use publish profile:

1. Go to Azure Portal → **GeoTrust** → **Configuration**
2. Under **General settings**, find **FTP / Deployment credentials**
3. Click **Set deployment credentials**
4. Set username and password
5. Click **Save**
6. Now you can download the publish profile

Then add `AZURE_WEBAPP_PUBLISH_PROFILE` secret in GitHub with the publish profile content.

## Option 3: Use Azure Deployment Center (Easiest)

This doesn't require GitHub Actions at all:

1. Go to Azure Portal → **GeoTrust** → **Deployment Center**
2. Select **GitHub** as source
3. Click **Authorize** and sign in with GitHub
4. Select:
   - **Organization**: Your GitHub username
   - **Repository**: `GeoTrust`
   - **Branch**: `main`
5. Click **Save**

Azure will automatically deploy on every push to `main` branch.

**Note**: You still need to set environment variables in Azure Portal → Configuration → Application settings.

## Verify Deployment

After setting up, push to `main` branch:

```bash
git add .
git commit -m "Configure Azure deployment"
git push origin main
```

Check deployment status:
- GitHub: **Actions** tab
- Azure: **Deployment Center** → **Logs**
