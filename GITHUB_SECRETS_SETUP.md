# GitHub Secrets Setup

## Required Secrets

Go to: **GitHub Repo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 1. AZURE_WEBAPP_PUBLISH_PROFILE

**Name**: `AZURE_WEBAPP_PUBLISH_PROFILE`

**Value**: Paste the entire XML content from your publish profile:

```xml
<publishData><publishProfile profileName="GeoTrust - Web Deploy" publishMethod="MSDeploy" publishUrl="geotrust-avc5e4gvhrd8acdr.scm.westus-01.azurewebsites.net:443" msdeploySite="GeoTrust" userName="$GeoTrust" userPWD="KrBuQFJFRmzc9BGl29k1ictDPS4ooH0tMuPr4dc6r4dup31bpH5akjqhSmHJ" destinationAppUrl="https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net" SQLServerDBConnectionString="" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="GeoTrust - FTP" publishMethod="FTP" publishUrl="ftps://waws-prod-bay-273.ftp.azurewebsites.windows.net/site/wwwroot" ftpPassiveMode="True" userName="GeoTrust\$GeoTrust" userPWD="KrBuQFJFRmzc9BGl29k1ictDPS4ooH0tMuPr4dc6r4dup31bpH5akjqhSmHJ" destinationAppUrl="https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net" SQLServerDBConnectionString="" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile><publishProfile profileName="GeoTrust - Zip Deploy" publishMethod="ZipDeploy" publishUrl="geotrust-avc5e4gvhrd8acdr.scm.westus-01.azurewebsites.net:443" userName="$GeoTrust" userPWD="KrBuQFJFRmzc9BGl29k1ictDPS4ooH0tMuPr4dc6r4dup31bpH5akjqhSmHJ" destinationAppUrl="https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net" SQLServerDBConnectionString="" mySQLDBConnectionString="" hostingProviderForumLink="" controlPanelLink="https://portal.azure.com" webSystem="WebSites"><databases /></publishProfile></publishData>
```

**Important**: Copy the entire XML from `<publishData>` to `</publishData>` including all three publish profiles.

### 2. REACT_APP_MAPBOX_TOKEN

**Name**: `REACT_APP_MAPBOX_TOKEN`

**Value**: `your_mapbox_token_here`

### 3. REACT_APP_CONTRACT_ID

**Name**: `REACT_APP_CONTRACT_ID`

**Value**: `your_contract_id_here`

### 4. REACT_APP_VERIFIER_ID (Optional)

**Name**: `REACT_APP_VERIFIER_ID`

**Value**: `your_verifier_id_here`

### 5. REACT_APP_GAME_HUB_ID (Optional)

**Name**: `REACT_APP_GAME_HUB_ID`

**Value**: `your_game_hub_id_here`

### 6. REACT_APP_GEOLINK_API_URL

**Name**: `REACT_APP_GEOLINK_API_URL`

**Value**: `https://testnet.stellargeolink.com`

### 7. REACT_APP_GEOLINK_WALLET_PROVIDER_KEY

**Name**: `REACT_APP_GEOLINK_WALLET_PROVIDER_KEY`

**Value**: `your_wallet_provider_key_here`

### 8. REACT_APP_GEOLINK_DATA_CONSUMER_KEY

**Name**: `REACT_APP_GEOLINK_DATA_CONSUMER_KEY`

**Value**: `your_data_consumer_key_here`

## After Adding Secrets

1. Push any change to `main` branch to trigger deployment
2. Check **Actions** tab in GitHub to see deployment progress
3. Visit your app URL to verify: https://geotrust.stellargeolink.com

## Note

These secrets are used during the **build** process. You also need to set the same environment variables in **Azure Portal** → **Configuration** → **Application settings** for the app to run correctly.
