# PowerShell script for upgrading both GeoTrust contracts on Windows

param(
    [Parameter(Mandatory=$false)]
    [string]$GeoTrustContractId = $env:CONTRACT_ID,
    
    [Parameter(Mandatory=$false)]
    [string]$ZkVerifierContractId = $env:ZK_VERIFIER_CONTRACT_ID,
    
    [Parameter(Mandatory=$false)]
    [string]$Network = $env:NETWORK,
    
    [Parameter(Mandatory=$false)]
    [string]$AdminIdentity = "admin"
)

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Question {
    param([string]$Message)
    Write-Host "[?] $Message" -ForegroundColor Magenta
}

Write-Info "=== Upgrading Both Contracts ==="
Write-Host ""

# Get script directory and project root
if ($PSScriptRoot) {
    $ScriptDir = $PSScriptRoot
} else {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$ProjectRoot = Split-Path -Parent $ScriptDir

# Try to load defaults from .env.local file
$envLocalPath = Join-Path $ProjectRoot "contracts\geotrust-match\.env.local"
$defaultGeoTrustId = $null
$defaultZkVerifierId = $null

if (Test-Path $envLocalPath) {
    Write-Info "Loading defaults from .env.local file..."
    $envContent = Get-Content $envLocalPath
    foreach ($line in $envContent) {
        if ($line -match '^\s*REACT_APP_CONTRACT_ID=(.+)$') {
            $defaultGeoTrustId = $matches[1].Trim()
        }
        elseif ($line -match '^\s*REACT_APP_VERIFIER_ID=(.+)$') {
            $defaultZkVerifierId = $matches[1].Trim()
        }
    }
    if ($defaultGeoTrustId) {
        Write-Info "  Found default GeoTrust Contract ID: $defaultGeoTrustId"
    }
    if ($defaultZkVerifierId) {
        Write-Info "  Found default ZK Verifier Contract ID: $defaultZkVerifierId"
    }
}

# Use defaults from .env.local if not set via parameter or environment variable
if ([string]::IsNullOrEmpty($GeoTrustContractId)) {
    $GeoTrustContractId = $defaultGeoTrustId
}

if ([string]::IsNullOrEmpty($ZkVerifierContractId)) {
    $ZkVerifierContractId = $defaultZkVerifierId
}

# Interactive prompts for missing values (with defaults shown)
if ([string]::IsNullOrEmpty($GeoTrustContractId)) {
    Write-Question "GeoTrust Match Contract ID not set. Please enter your contract ID:"
    Write-Host "  (It should start with C and be 56 characters long)" -ForegroundColor Gray
    $GeoTrustContractId = Read-Host "GeoTrust Match Contract ID"
    if ([string]::IsNullOrEmpty($GeoTrustContractId)) {
        Write-Error "Contract ID is required!"
        exit 1
    }
} else {
    Write-Question "GeoTrust Match Contract ID:"
    Write-Host "  Default: $GeoTrustContractId" -ForegroundColor Gray
    Write-Host "  (Press Enter to use default, or type a new value)" -ForegroundColor Gray
    $input = Read-Host "GeoTrust Match Contract ID"
    if (-not [string]::IsNullOrEmpty($input)) {
        $GeoTrustContractId = $input
    }
}

if ([string]::IsNullOrEmpty($ZkVerifierContractId)) {
    Write-Question "ZK Verifier Contract ID not set. Please enter your ZK Verifier contract ID:"
    Write-Host "  (It should start with C and be 56 characters long)" -ForegroundColor Gray
    Write-Host "  (Press Enter to skip ZK Verifier upgrade)" -ForegroundColor Gray
    $input = Read-Host "ZK Verifier Contract ID"
    if (-not [string]::IsNullOrEmpty($input)) {
        $ZkVerifierContractId = $input
    }
    # If empty, $ZkVerifierContractId remains empty/null (will skip upgrade)
} else {
    Write-Question "ZK Verifier Contract ID:"
    Write-Host "  Default: $ZkVerifierContractId" -ForegroundColor Gray
    Write-Host "  (Press Enter to use default, type a new value, or type 'skip' to skip)" -ForegroundColor Gray
    $input = Read-Host "ZK Verifier Contract ID"
    if ($input -eq "skip" -or $input -eq "SKIP") {
        $ZkVerifierContractId = $null
    } elseif (-not [string]::IsNullOrEmpty($input)) {
        $ZkVerifierContractId = $input
    }
    # If empty, keep the default (already set)
}

if ([string]::IsNullOrEmpty($Network)) {
    Write-Question "Network not specified. Which network?"
    Write-Host "  1) testnet (default)"
    Write-Host "  2) mainnet"
    Write-Host "  3) futurenet"
    $networkChoice = Read-Host "Enter choice [1-3] or press Enter for testnet"
    switch ($networkChoice) {
        "2" { $Network = "mainnet" }
        "3" { $Network = "futurenet" }
        default { $Network = "testnet" }
    }
}

Write-Host ""
Write-Info "Configuration:"
Write-Host "  GeoTrust Match Contract: $GeoTrustContractId"
if (-not [string]::IsNullOrEmpty($ZkVerifierContractId)) {
    Write-Host "  ZK Verifier Contract: $ZkVerifierContractId"
} else {
    Write-Host "  ZK Verifier Contract: (skipping)"
}
Write-Host "  Network: $Network"
Write-Host "  Admin Identity: $AdminIdentity"
Write-Host ""

$confirm = Read-Host "Continue with upgrades? [y/N]"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Info "Upgrade cancelled by user"
    exit 0
}

Write-Host ""

# Check if admin identity exists and get source account
$SourceAccount = $null
Write-Info "Checking for Soroban identity $AdminIdentity..."
$identityList = soroban keys list 2>&1
if ($LASTEXITCODE -eq 0 -and $identityList -match $AdminIdentity) {
    Write-Success "Identity $AdminIdentity found"
    $SourceAccount = $AdminIdentity
} else {
    Write-Warning "Identity $AdminIdentity not found in Soroban CLI"
    Write-Host ""
    Write-Question "How would you like to proceed?"
    Write-Host "  1) Create a new identity named $AdminIdentity"
    Write-Host "  2) Use an existing identity (enter name)"
    Write-Host "  3) Enter secret key directly"
    $authChoice = Read-Host "Enter choice [1-3]"
    
    switch ($authChoice) {
        "1" {
            Write-Info "Creating new identity $AdminIdentity..."
            Write-Host "You will be prompted to enter a secret key." -ForegroundColor Yellow
            soroban keys add $AdminIdentity
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to create identity!"
                exit 1
            }
            Write-Success "Identity $AdminIdentity created"
            $SourceAccount = $AdminIdentity
        }
        "2" {
            $existingIdentity = Read-Host "Enter existing identity name"
            $SourceAccount = $existingIdentity
        }
        "3" {
            Write-Question "Enter your admin secret key (starts with 'S'):"
            Write-Host "  (This will be added as a temporary identity for signing)" -ForegroundColor Gray
            $secretKey = Read-Host "Secret Key" -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretKey)
            $rawSecretKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
            $rawSecretKey = $rawSecretKey.Trim()
            if (-not $rawSecretKey.StartsWith("S")) {
                Write-Error "Invalid secret key format. Secret keys must start with 'S'."
                exit 1
            }
            $tempIdentity = "temp_upgrade_$(Get-Random)"
            Write-Info "Adding secret key as temporary identity '$tempIdentity'..."
            $env:SOROBAN_SECRET_KEY = $rawSecretKey
            $addOutput = soroban keys add $tempIdentity --secret-key 2>&1
            $addSuccess = $LASTEXITCODE -eq 0
            Remove-Item Env:\SOROBAN_SECRET_KEY -ErrorAction SilentlyContinue
            
            if ($addSuccess) {
                Start-Sleep -Milliseconds 500
                $identityListOutput = soroban keys ls 2>&1
                $identityListString = $identityListOutput -join " "
                if ($identityListString -match [regex]::Escape($tempIdentity)) {
                    $SourceAccount = $tempIdentity
                    Write-Success "Temporary identity '$tempIdentity' created and verified"
                    $identityAddress = soroban keys address $tempIdentity 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-Info "Identity address: $($identityAddress.Trim())"
                    }
                    Write-Info "Note: This identity will remain in your Soroban CLI. You can remove it later with: soroban keys rm $tempIdentity"
                } else {
                    Write-Warning "Identity created but not found in key list. Trying to use secret key directly..."
                    $SourceAccount = $rawSecretKey
                }
            } else {
                Write-Error "Failed to add secret key as identity!"
                Write-Host "Error output: $($addOutput -join "`n")"
                Write-Info "Trying to use secret key directly (may not work)..."
                $SourceAccount = $rawSecretKey
            }
        }
        default {
            Write-Error "Invalid choice!"
            exit 1
        }
    }
}

Write-Host ""
Write-Info "Using source account: $SourceAccount"
Write-Host ""

# ============================================
# Upgrade GeoTrust Match Contract
# ============================================
Write-Info "=== Upgrading GeoTrust Match Contract ==="
Write-Host ""

$ContractDir = Join-Path $ProjectRoot "contracts\geotrust-match"
# Define both possible target directories
$Wasm32v1Dir = Join-Path $ContractDir "target\wasm32v1-none\release"
$Wasm32UnknownDir = Join-Path $ContractDir "target\wasm32-unknown-unknown\release"
$WasmFileV1 = Join-Path $Wasm32v1Dir "geotrust_match.wasm"
$WasmFileUnknown = Join-Path $Wasm32UnknownDir "geotrust_match.wasm"

# Variables will be set after build based on which directory has the file
$BuildDir = $null
$WasmFile = $null
$WasmOptimized = $null

# Step 1: Build the contract
Write-Info "Step 1: Building GeoTrust Match contract..."
Push-Location $ContractDir
try {
    soroban contract build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Contract build failed!"
        exit 1
    }
    Write-Success "Contract built successfully"
} finally {
    Pop-Location
}
Write-Host ""

# After build, check which directory actually has the WASM file
if (Test-Path $WasmFileV1) {
    $BuildDir = $Wasm32v1Dir
    $WasmFile = $WasmFileV1
    $WasmOptimized = Join-Path $Wasm32v1Dir "geotrust_match_optimized.wasm"
} elseif (Test-Path $WasmFileUnknown) {
    $BuildDir = $Wasm32UnknownDir
    $WasmFile = $WasmFileUnknown
    $WasmOptimized = Join-Path $Wasm32UnknownDir "geotrust_match_optimized.wasm"
} else {
    Write-Error "WASM file not found after build!"
    Write-Error "  Checked: $WasmFileV1"
    Write-Error "  Checked: $WasmFileUnknown"
    exit 1
}

# Step 2: Check if optimization is available
$WasmToUse = $WasmFile
Write-Info "Step 2: Checking for WASM optimization..."
try {
    $null = soroban contract optimize --help 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Optimizing WASM..."
        soroban contract optimize --wasm $WasmFile --wasm-out $WasmOptimized 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $WasmToUse = $WasmOptimized
            Write-Success "WASM optimized successfully"
        } else {
            Write-Warning "Optimization failed, using unoptimized WASM"
        }
    }
} catch {
    Write-Warning "Optimization not available, using unoptimized WASM"
}
Write-Host ""

# Step 3: Calculate WASM hash from file
Write-Info "Step 3: Calculating WASM hash from file..."
$GeoTrustWasmToUseAbsolute = (Resolve-Path $WasmToUse).Path
$geoTrustFileHash = Get-FileHash -Path $GeoTrustWasmToUseAbsolute -Algorithm SHA256
$geoTrustRawHash = $geoTrustFileHash.Hash.ToLower()
if ($geoTrustRawHash.Length -ne 64) {
    Write-Error "Hash calculation error! Expected 64 characters, got $($geoTrustRawHash.Length)"
    exit 1
}
$GeoTrustWasmHash = $geoTrustRawHash.Substring(0, 64)
if ($GeoTrustWasmHash.Length -ne 64) {
    Write-Error "Hash copy error! Expected 64 characters, got $($GeoTrustWasmHash.Length)"
    exit 1
}
Write-Success "WASM Hash: $GeoTrustWasmHash"
Write-Host ""

# Step 4: Install WASM to ledger
Write-Info "Step 4: Installing WASM to ledger..."
if (-not (Test-Path $WasmToUse)) {
    Write-Error "WASM file not found: $WasmToUse"
    exit 1
}

Write-Info "Installing WASM file: $GeoTrustWasmToUseAbsolute"

# Use --source-account (works for both identities and secret keys)
if ($SourceAccount.StartsWith("S")) {
    $installOutput = soroban contract install `
        --wasm $GeoTrustWasmToUseAbsolute `
        --source-account $SourceAccount `
        --network $Network `
        2>&1
} else {
    $installOutput = soroban contract install `
        --wasm $GeoTrustWasmToUseAbsolute `
        --source-account $SourceAccount `
        --network $Network `
        2>&1
}

if ($LASTEXITCODE -ne 0) {
    Write-Warning "WASM installation had issues, but continuing with upgrade..."
    Write-Info "Note: If WASM is already on ledger, upgrade should still work"
}
Write-Host ""

# Step 5: Upgrade the contract
Write-Info "Step 5: Upgrading GeoTrust Match contract..."
Write-Warning "This will update the contract WASM. You may be prompted for your secret key."

# Ensure hash is properly formatted (using unique variable name)
$geoTrustHashForUpgrade = $GeoTrustWasmHash.Substring(0, 64)
if ($geoTrustHashForUpgrade.Length -ne 64) {
    Write-Error "Hash length mismatch! Expected 64, got $($geoTrustHashForUpgrade.Length)"
    exit 1
}
if ($geoTrustHashForUpgrade -notmatch '^[0-9a-f]{64}$') {
    Write-Error "Hash format invalid! Must be 64 lowercase hex characters"
    exit 1
}
Write-Info "Invoking upgrade with WASM hash (first 20 chars): $($geoTrustHashForUpgrade.Substring(0, 20))..."

# Use backtick format - this works reliably in PowerShell
$invokeOutput = soroban contract invoke `
    --id $GeoTrustContractId `
    --source-account $SourceAccount `
    --network $Network `
    -- `
    upgrade `
    --new_wasm_hash "$geoTrustHashForUpgrade" `
    2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Success "GeoTrust Match contract upgraded successfully!"
} else {
    Write-Error "Contract upgrade failed!"
    Write-Host "Error output:"
    Write-Host $invokeOutput
    exit 1
}
Write-Host ""

# ============================================
# Upgrade ZK Verifier Contract (if provided)
# ============================================
if (-not [string]::IsNullOrEmpty($ZkVerifierContractId)) {
    Write-Info "=== Upgrading ZK Verifier Contract ==="
    Write-Host ""

    $ContractDir = Join-Path $ProjectRoot "contracts\zk-verifier"
    # Define both possible target directories
    $Wasm32v1Dir = Join-Path $ContractDir "target\wasm32v1-none\release"
    $Wasm32UnknownDir = Join-Path $ContractDir "target\wasm32-unknown-unknown\release"
    $WasmFileV1 = Join-Path $Wasm32v1Dir "zk_verifier.wasm"
    $WasmFileUnknown = Join-Path $Wasm32UnknownDir "zk_verifier.wasm"
    
    # Variables will be set after build based on which directory has the file
    $BuildDir = $null
    $WasmFile = $null
    $WasmOptimized = $null

    # Step 1: Build the contract
    Write-Info "Step 1: Building ZK Verifier contract..."
    Push-Location $ContractDir
    try {
        soroban contract build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Contract build failed!"
            exit 1
        }
        Write-Success "Contract built successfully"
    } finally {
        Pop-Location
    }
    Write-Host ""

    # After build, check which directory actually has the WASM file
    if (Test-Path $WasmFileV1) {
        $BuildDir = $Wasm32v1Dir
        $WasmFile = $WasmFileV1
        $WasmOptimized = Join-Path $Wasm32v1Dir "zk_verifier_optimized.wasm"
    } elseif (Test-Path $WasmFileUnknown) {
        $BuildDir = $Wasm32UnknownDir
        $WasmFile = $WasmFileUnknown
        $WasmOptimized = Join-Path $Wasm32UnknownDir "zk_verifier_optimized.wasm"
    } else {
        Write-Error "WASM file not found after build!"
        Write-Error "  Checked: $WasmFileV1"
        Write-Error "  Checked: $WasmFileUnknown"
        exit 1
    }

    # Step 2: Check if optimization is available
    $WasmToUse = $WasmFile
    Write-Info "Step 2: Checking for WASM optimization..."
    try {
        $null = soroban contract optimize --help 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Optimizing WASM..."
            soroban contract optimize --wasm $WasmFile --wasm-out $WasmOptimized 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $WasmToUse = $WasmOptimized
                Write-Success "WASM optimized successfully"
            } else {
                Write-Warning "Optimization failed, using unoptimized WASM"
            }
        }
    } catch {
        Write-Warning "Optimization not available, using unoptimized WASM"
    }
    Write-Host ""

    # Step 3: Calculate WASM hash from file
    Write-Info "Step 3: Calculating WASM hash from file..."
    $ZkVerifierWasmToUseAbsolute = (Resolve-Path $WasmToUse).Path
    $zkVerifierFileHash = Get-FileHash -Path $ZkVerifierWasmToUseAbsolute -Algorithm SHA256
    $zkVerifierRawHash = $zkVerifierFileHash.Hash.ToLower()
    if ($zkVerifierRawHash.Length -ne 64) {
        Write-Error "Hash calculation error! Expected 64 characters, got $($zkVerifierRawHash.Length)"
        exit 1
    }
    $ZkVerifierWasmHash = $zkVerifierRawHash.Substring(0, 64)
    if ($ZkVerifierWasmHash.Length -ne 64) {
        Write-Error "Hash copy error! Expected 64 characters, got $($ZkVerifierWasmHash.Length)"
        exit 1
    }
    Write-Success "WASM Hash: $ZkVerifierWasmHash"
    Write-Host ""

    # Step 4: Install WASM to ledger
    Write-Info "Step 4: Installing WASM to ledger..."
    if (-not (Test-Path $WasmToUse)) {
        Write-Error "WASM file not found: $WasmToUse"
        exit 1
    }

    Write-Info "Installing WASM file: $ZkVerifierWasmToUseAbsolute"

    $installOutput = soroban contract install `
        --wasm $ZkVerifierWasmToUseAbsolute `
        --source-account $SourceAccount `
        --network $Network `
        2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Warning "WASM installation had issues, but continuing with upgrade..."
        Write-Info "Note: If WASM is already on ledger, upgrade should still work"
    }
    Write-Host ""

    # Step 5: Check if contract supports upgrade function
    Write-Info "Step 5: Checking if ZK Verifier contract supports upgrade..."
    $helpOutput = soroban contract invoke --id $ZkVerifierContractId --source-account $SourceAccount --network $Network -- --help 2>&1
    # Check for "upgrade" as a command in the Commands section (must be listed as a command, not just mentioned in text)
    # Look for "upgrade" followed by whitespace (indicating it's a command name, not part of another word)
    $hasUpgradeFunction = ($helpOutput -match "(?m)^\s+upgrade\s+") -or ($helpOutput -match "(?m)^\s+upgrade$")
    
    # Also check if it's in the Commands section specifically
    if ($hasUpgradeFunction) {
        $commandsSection = ($helpOutput | Select-String -Pattern "Commands:" -Context 0,20).Context.PostContext
        $hasUpgradeFunction = $commandsSection -match "(?m)^\s+upgrade"
    }
    
    if (-not $hasUpgradeFunction) {
        Write-Warning "ZK Verifier contract does not have an 'upgrade' function!"
        Write-Warning "This means the deployed contract is an older version that doesn't support upgrades."
        Write-Host ""
        Write-Info "To fix this, you need to:"
        Write-Host "  1. Deploy a new version of the ZK Verifier contract (not upgrade the existing one)"
        Write-Host "  2. The new deployment will include the upgrade function"
        Write-Host "  3. After that, you can use this script to upgrade it in the future"
        Write-Host ""
        Write-Question "Would you like to skip the ZK Verifier upgrade for now? [y/N]"
        $skipChoice = Read-Host
        if ($skipChoice -eq "y" -or $skipChoice -eq "Y") {
            Write-Info "Skipping ZK Verifier upgrade"
            Write-Host ""
        } else {
            Write-Error "Cannot upgrade ZK Verifier contract - it doesn't have the upgrade function."
            Write-Info "Please deploy a new version of the contract first."
            exit 1
        }
    } else {
        Write-Info "ZK Verifier contract supports upgrade function. Proceeding with upgrade..."
        Write-Warning "This will update the contract WASM. You may be prompted for your secret key."

        # Ensure hash is properly formatted (using unique variable name)
        $zkVerifierHashForUpgrade = $ZkVerifierWasmHash.Substring(0, 64)
        if ($zkVerifierHashForUpgrade.Length -ne 64) {
            Write-Error "Hash length mismatch! Expected 64, got $($zkVerifierHashForUpgrade.Length)"
            exit 1
        }
        if ($zkVerifierHashForUpgrade -notmatch '^[0-9a-f]{64}$') {
            Write-Error "Hash format invalid! Must be 64 lowercase hex characters"
            exit 1
        }
        Write-Info "Invoking upgrade with WASM hash (first 20 chars): $($zkVerifierHashForUpgrade.Substring(0, 20))..."
        
        # Use exact same backtick format as the working GeoTrust upgrade
        $invokeOutput = soroban contract invoke `
            --id $ZkVerifierContractId `
            --source-account $SourceAccount `
            --network $Network `
            -- `
            upgrade `
            --new_wasm_hash "$zkVerifierHashForUpgrade" `
            2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Success "ZK Verifier contract upgraded successfully!"
        } else {
            Write-Error "Contract upgrade failed!"
            Write-Host "Error output:"
            Write-Host $invokeOutput
            exit 1
        }
    }
    Write-Host ""
} else {
    Write-Info "Skipping ZK Verifier upgrade (no contract ID provided)"
    Write-Host ""
}

# ============================================
# Summary
# ============================================
Write-Success "=== All Upgrades Complete ==="
Write-Host ""
Write-Host "Upgraded Contracts:"
Write-Host "  [OK] GeoTrust Match: $GeoTrustContractId"
if (-not [string]::IsNullOrEmpty($ZkVerifierContractId)) {
    Write-Host "  [OK] ZK Verifier: $ZkVerifierContractId"
}
Write-Host ""
Write-Info "New features available:"
Write-Host "  - Country-specific admin management"
Write-Host "  - Enhanced security (overflow checks, safe error handling)"
Write-Host "  - Improved performance and reliability"
Write-Host ""
