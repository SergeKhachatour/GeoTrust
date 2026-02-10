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

**Value**: `pk.eyJ1Ijoic2VyZ2UzNjl4MzMiLCJhIjoiY20zZHkzb2xoMDA0eTJxcHU4MTNoYjNlaCJ9.Xl6OxzF9td1IgTTeUp526w`

### 3. REACT_APP_CONTRACT_ID

**Name**: `REACT_APP_CONTRACT_ID`

**Value**: `CAW645ORVZG64DEOEC3XZ6DYJU56Y35ERVXX4QO6DNDTWDZS6ADONTPR`

### 4. REACT_APP_VERIFIER_ID (Optional)

**Name**: `REACT_APP_VERIFIER_ID`

**Value**: `CCG3E6Q53MKZCMYOIRKLRLIQVEK45TDYCCAAPZH32MB4CDN7N5NTLYBC`

### 5. REACT_APP_GAME_HUB_ID (Optional)

**Name**: `REACT_APP_GAME_HUB_ID`

**Value**: `CB4VZAT2U3UC6XFK3N23SKRF2NDCMP3QHJYMCHHFMZO7MRQO6DQ2EMYG`

## After Adding Secrets

1. Push any change to `main` branch to trigger deployment
2. Check **Actions** tab in GitHub to see deployment progress
3. Visit your app URL to verify: https://geotrust-avc5e4gvhrd8acdr.westus-01.azurewebsites.net

## Note

These secrets are used during the **build** process. You also need to set the same environment variables in **Azure Portal** → **Configuration** → **Application settings** for the app to run correctly.
