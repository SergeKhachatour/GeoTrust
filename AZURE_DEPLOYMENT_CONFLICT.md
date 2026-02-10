# Azure Deployment 409 Conflict Error

## Problem
Getting `Conflict (CODE: 409)` error when deploying to Azure Web App. This typically means:
- Another deployment is already in progress
- The app is locked or in use
- Multiple deployments were triggered simultaneously

## Solutions

### Option 1: Wait and Retry (Recommended)
1. Wait 2-3 minutes for any ongoing deployment to complete
2. Go to **GitHub Actions** → **Actions** tab
3. Click on the failed workflow
4. Click **Re-run all jobs** or **Re-run failed jobs**

### Option 2: Check Azure Portal
1. Go to **Azure Portal** → **GeoTrust** → **Deployment Center**
2. Check if there's a deployment in progress
3. Wait for it to complete
4. Then retry the GitHub Actions deployment

### Option 3: Cancel Ongoing Deployments
1. Go to **Azure Portal** → **GeoTrust** → **Deployment Center**
2. If there's a deployment in progress, you can stop it
3. Then retry the GitHub Actions deployment

### Option 4: Manual Retry
1. Go to **GitHub Actions** → **Actions** tab
2. Find the failed workflow run
3. Click **Re-run all jobs**

## Prevention
The workflow has been updated to:
- Wait 30 seconds before deploying to allow ongoing deployments to complete
- Automatically retry once if deployment fails (waits 60 seconds before retry)
- Set a timeout of 10 minutes for the deployment step

## Common Causes
- Multiple pushes to `main` branch in quick succession
- Manual deployment triggered while GitHub Actions is deploying
- Azure Portal deployment running simultaneously with GitHub Actions

## Next Steps
After resolving the conflict:
1. Wait 2-3 minutes
2. Retry the deployment from GitHub Actions
3. The deployment should succeed
