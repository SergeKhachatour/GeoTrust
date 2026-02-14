# PowerShell script for upgrading the GeoTrust Match contract on Windows

param(
    [Parameter(Mandatory=$false)]
    [string]$ContractId = $env:CONTRACT_ID,
    
    [Parameter(Mandatory=$false)]
    [string]$Network = $env:NETWORK,
    
    [Parameter(Mandatory=$false)]
    [string]$AdminIdentity = "admin"
)

# Colors for output (PowerShell 5.1+ compatible)
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Question {
    param([string]$Message)
    Write-Host "? $Message" -ForegroundColor Magenta
}

# Interactive prompts for missing values
if ([string]::IsNullOrEmpty($ContractId)) {
    Write-Question "Contract ID not set. Please enter your contract ID:"
    Write-Host '  (It should start with C and be 56 characters long)' -ForegroundColor Gray
    $ContractId = Read-Host "Contract ID"
    if ([string]::IsNullOrEmpty($ContractId)) {
        Write-Error "Contract ID is required!"
        exit 1
    }
    if (-not $ContractId.StartsWith("C")) {
        Write-Warning 'Contract ID should start with C. Continuing anyway...'
    }
}

if ([string]::IsNullOrEmpty($Network)) {
    Write-Question "Network not specified. Which network?"
    Write-Host '  1) testnet (default)'
    Write-Host '  2) mainnet'
    Write-Host '  3) futurenet'
    $networkChoice = Read-Host "Enter choice [1-3] or press Enter for testnet"
    switch ($networkChoice) {
        "2" { $Network = "mainnet" }
        "3" { $Network = "futurenet" }
        default { $Network = "testnet" }
    }
}

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
    Write-Host '  1) Create a new identity named' -NoNewline
    Write-Host " $AdminIdentity"
    Write-Host '  2) Use an existing identity (enter name)'
    Write-Host '  3) Enter secret key directly'
    $authChoice = Read-Host "Enter choice [1-3]"
    
    switch ($authChoice) {
        "1" {
            Write-Info "Creating new identity $AdminIdentity..."
            Write-Host 'You will be prompted to enter a secret key.' -ForegroundColor Yellow
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
            # Trim any whitespace
            $rawSecretKey = $rawSecretKey.Trim()
            if (-not $rawSecretKey.StartsWith("S")) {
                Write-Error "Invalid secret key format. Secret keys must start with 'S'."
                exit 1
            }
            # Create a temporary identity for this session
            $tempIdentity = "temp_upgrade_$(Get-Random)"
            Write-Info "Adding secret key as temporary identity '$tempIdentity'..."
            # Use environment variable method to add the secret key
            $env:SOROBAN_SECRET_KEY = $rawSecretKey
            $addOutput = soroban keys add $tempIdentity --secret-key 2>&1
            $addSuccess = $LASTEXITCODE -eq 0
            Remove-Item Env:\SOROBAN_SECRET_KEY -ErrorAction SilentlyContinue
            
            if ($addSuccess) {
                # Verify the identity was added correctly by checking the key list
                Start-Sleep -Milliseconds 500  # Give it a moment to be written
                $identityListOutput = soroban keys ls 2>&1
                # Convert to string and check if identity name appears (handle both single line and multi-line output)
                $identityListString = $identityListOutput -join " "
                if ($identityListString -match [regex]::Escape($tempIdentity)) {
                    $SourceAccount = $tempIdentity
                    Write-Success "Temporary identity '$tempIdentity' created and verified"
                    # Get the address for confirmation
                    $identityAddress = soroban keys address $tempIdentity 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-Info "Identity address: $($identityAddress.Trim())"
                    }
                    Write-Info "Note: This identity will remain in your Soroban CLI. You can remove it later with: soroban keys rm $tempIdentity"
                } else {
                    Write-Warning "Identity created but not found in key list."
                    Write-Host "Add output: $($addOutput -join "`n")"
                    Write-Host "Key list: $identityListString"
                    Write-Info "Trying to use secret key directly..."
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

Write-Info "Starting contract upgrade process..."
Write-Host ""
Write-Info "Contract ID: $ContractId"
Write-Info "Network: $Network"
Write-Info "Admin Identity: $AdminIdentity"
Write-Host ""
Write-Host "⚠️  IMPORTANT: Make sure you have enough XLM in your account for transaction fees!" -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "Continue with upgrade? [y/N]"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Info "Upgrade cancelled by user"
    exit 0
}
Write-Host ""

# Configuration - Get script directory and resolve to project root
if ($PSScriptRoot) {
    $ScriptDir = $PSScriptRoot
} else {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$ProjectRoot = Split-Path -Parent $ScriptDir
$ContractDir = Join-Path $ProjectRoot "contracts\geotrust-match"
$BuildDir = Join-Path $ContractDir "target\wasm32-unknown-unknown\release"
$WasmFile = Join-Path $BuildDir "geotrust_match.wasm"
$WasmOptimized = Join-Path $BuildDir "geotrust_match_optimized.wasm"

# Step 1: Build the contract
Write-Info "Step 1: Building contract..."
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

# Step 3: Install WASM to ledger (required before upgrade)
Write-Info "Step 3: Installing WASM to ledger..."
if (-not (Test-Path $WasmToUse)) {
    Write-Error "WASM file not found: $WasmToUse"
    exit 1
}

Write-Info "Installing WASM to ledger (this stores it so it can be referenced for upgrade)..."
Write-Warning "This will cost XLM for the transaction fee."

# Convert path to absolute path to avoid any path issues
$WasmToUseAbsolute = (Resolve-Path $WasmToUse).Path

Write-Info "Installing WASM file: $WasmToUseAbsolute"
# Use --source-account instead of --source for secret keys
if ($SourceAccount.StartsWith("S")) {
    $installOutput = soroban contract install `
        --wasm $WasmToUseAbsolute `
        --source-account $SourceAccount `
        --network $Network `
        2>&1
} else {
    $installOutput = soroban contract install `
        --wasm $WasmToUseAbsolute `
        --source-account $SourceAccount `
        --network $Network `
        2>&1
}

# Calculate hash from file - this is the most reliable method
# The install command doesn't reliably return the hash, so we calculate it ourselves
Write-Info "Calculating WASM hash from file..."
$fileHash = Get-FileHash -Path $WasmToUseAbsolute -Algorithm SHA256
$rawHash = $fileHash.Hash.ToLower()
# Immediately validate and create a clean copy
if ($rawHash.Length -ne 64) {
    Write-Error "Hash calculation error! Expected 64 characters, got $($rawHash.Length)"
    Write-Info "Hash value: '$rawHash'"
    exit 1
}
# Create a clean string copy to prevent any corruption - use Substring to ensure exact length
$WasmHash = $rawHash.Substring(0, 64)
# Verify the copy is correct
if ($WasmHash.Length -ne 64) {
    Write-Error "Hash copy error! Expected 64 characters, got $($WasmHash.Length)"
    exit 1
}
Write-Info "Calculated hash from file (first 20 chars): $($WasmHash.Substring(0, 20))..."
Write-Info "Hash length verified: $($WasmHash.Length) characters"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install WASM to ledger!"
    Write-Host "Error output:"
    Write-Host $installOutput
    Write-Host ""
    Write-Warning "Note: If the WASM was already installed, you can skip this step and proceed with upgrade."
    Write-Question "Do you want to continue with upgrade anyway? (y/N)"
    $continue = Read-Host
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
    Write-Info "Continuing with upgrade (assuming WASM is already on ledger)..."
    # If install failed but we have a hash, we can still try to upgrade
    if (-not $WasmHash) {
        Write-Info "Calculating hash from file as fallback..."
        $fileHash = Get-FileHash -Path $WasmToUseAbsolute -Algorithm SHA256
        $rawHash = $fileHash.Hash.ToLower()
        $WasmHash = $rawHash.Substring(0, 64)
    }
} else {
    # Installation succeeded - wait a moment for it to propagate
    Write-Info "Waiting 2 seconds for WASM installation to propagate on ledger..."
    Start-Sleep -Seconds 2
}

# Ensure hash is exactly 64 hex characters (32 bytes)
# This validation happens AFTER extraction/calculation to ensure we have a valid hash
if ($WasmHash.Length -ne 64) {
    Write-Error "Invalid hash length! Expected 64 hex characters, got $($WasmHash.Length)"
    Write-Info "Hash value: '$WasmHash'"
    Write-Info "Hash bytes: $([System.Text.Encoding]::UTF8.GetBytes($WasmHash).Length)"
    exit 1
}
# Verify it's valid hex
if ($WasmHash -notmatch '^[0-9a-f]{64}$') {
    Write-Error "Invalid hash format! Hash must be 64 lowercase hex characters"
    Write-Info "Hash value: '$WasmHash'"
    exit 1
}
# Store the hash in a way that prevents any corruption - create a fresh copy
$WasmHash = [string]$WasmHash.Trim()
# Double-check after trimming
if ($WasmHash.Length -ne 64) {
    Write-Error "Hash corrupted after processing! Length changed from 64 to $($WasmHash.Length)"
    exit 1
}
if ($LASTEXITCODE -eq 0) {
    Write-Success "WASM installed to ledger"
} else {
    Write-Warning "WASM installation had issues, but continuing with upgrade..."
    Write-Info "Note: If WASM is already on ledger, upgrade should still work"
}
Write-Success "WASM Hash: $WasmHash"
Write-Info "Hash format verified: 64 hex characters (32 bytes)"
Write-Host ""

# Step 4: Verify contract exists and get actual admin
Write-Info "Step 4: Verifying contract and checking admin..."
$actualAdmin = $null
try {
    $adminOutput = soroban contract invoke --id $ContractId --source-account $SourceAccount --network $Network -- get_admin 2>&1
    if ($LASTEXITCODE -eq 0) {
        # Extract admin address from output (usually in format like "G...")
        $adminOutputString = $adminOutput -join " "
        if ($adminOutputString -match 'G[A-Z0-9]{55}') {
            $actualAdmin = $Matches[0]
            Write-Success "Contract admin verified: $actualAdmin"
            
            # Get the address of the source account we're using
            $sourceAddress = $null
            if (-not $SourceAccount.StartsWith("S") -and -not $SourceAccount.StartsWith("G")) {
                $addrOutput = soroban keys address $SourceAccount 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $sourceAddress = $addrOutput.Trim()
                }
            } elseif ($SourceAccount.StartsWith("G")) {
                $sourceAddress = $SourceAccount
            }
            
            # Check if the source account matches the admin
            if ($sourceAddress -and $sourceAddress -ne $actualAdmin) {
                Write-Warning "⚠️  WARNING: The account you're using ($sourceAddress) is NOT the contract admin!"
                Write-Warning "The contract admin is: $actualAdmin"
                Write-Warning "You need to use the admin account's secret key to upgrade the contract."
                Write-Host ""
                Write-Question "Do you want to continue anyway? (This will likely fail) [y/N]"
                $continue = Read-Host
                if ($continue -ne "y" -and $continue -ne "Y") {
                    Write-Info "Upgrade cancelled. Please use the admin account's secret key."
                    exit 0
                }
            } else {
                Write-Success "Source account matches contract admin"
            }
        } else {
            Write-Success "Contract and admin access verified"
        }
    } else {
        Write-Warning 'Could not verify admin access (this is okay, continuing...)'
        Write-Warning "Make sure your account has admin permissions"
    }
} catch {
    Write-Warning 'Could not verify admin access (this is okay, continuing...)'
    Write-Warning "Make sure your account has admin permissions"
}
Write-Host ""

# Step 5: Upgrade the contract
Write-Info "Step 5: Upgrading contract..."
Write-Warning 'This will update the contract WASM. You may be prompted for your secret key.'
Write-Warning 'Press Ctrl+C to cancel...'
Start-Sleep -Seconds 2

Write-Host ""
Write-Info "Invoking upgrade function..."
Write-Info "Using source account: $SourceAccount"
# Verify identity exists if it's not a secret key or address
if (-not $SourceAccount.StartsWith("S") -and -not $SourceAccount.StartsWith("G")) {
    Write-Info "Verifying identity '$SourceAccount' exists..."
    $identityListOutput = soroban keys ls 2>&1
    # Filter out error messages and empty lines, then join
    # Convert to string first to handle ErrorRecord objects, then trim
    $identityListClean = $identityListOutput | Where-Object { $_ } | ForEach-Object { 
        $str = $_.ToString()
        if ($str -and $str -notmatch "error|Error|ERROR") {
            $str.Trim()
        }
    } | Where-Object { $_ }
    $identityListString = $identityListClean -join " "
    Write-Info "Identity list: $identityListString"
    # Use regex escape to handle special characters in identity name
    $escapedIdentity = [regex]::Escape($SourceAccount)
    if ($identityListString -notmatch $escapedIdentity) {
        Write-Error "Identity '$SourceAccount' not found in Soroban CLI!"
        Write-Info "Available identities:"
        Write-Host $identityListOutput
        Write-Error "Cannot proceed - identity was not properly created."
        exit 1
    }
    Write-Success "Identity verified"
}
# Use --source-account (works for both identities and secret keys)
# Create a fresh copy of the hash using Substring to ensure exact length
$hashForUpgrade = $WasmHash.Substring(0, 64)
Write-Info "Invoking upgrade with WASM hash (first 20 chars): $($hashForUpgrade.Substring(0, 20))..."
Write-Info "Hash length: $($hashForUpgrade.Length) characters"
# Verify hash before passing it - final check
if ($hashForUpgrade.Length -ne 64) {
    Write-Error "Hash length mismatch! Expected 64, got $($hashForUpgrade.Length)"
    Write-Info "Original hash was: $WasmHash (length: $($WasmHash.Length))"
    exit 1
}
if ($hashForUpgrade -notmatch '^[0-9a-f]{64}$') {
    Write-Error "Hash format invalid! Must be 64 lowercase hex characters"
    Write-Info "Hash value: '$hashForUpgrade'"
    exit 1
}
# Use the hash with quotes (matching the bash script format)
$invokeOutput = soroban contract invoke `
    --id $ContractId `
    --source-account $SourceAccount `
    --network $Network `
    -- `
    upgrade `
    --new_wasm_hash "$hashForUpgrade" `
    2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "Contract upgrade failed!"
    Write-Host ""
    Write-Host "Full error output:"
    Write-Host $invokeOutput
    Write-Host ""
    # Check if the error is about missing signing key
    $errorOutput = $invokeOutput -join "`n"
    # Check for XDR processing error specifically
    if ($errorOutput -match "xdr processing error") {
        Write-Warning "XDR processing error detected. This might be due to:"
        Write-Host "  1. CLI version incompatibility (you're on 21.5.3, latest is 25.1.0)"
        Write-Host "  2. Hash format issue (though hash appears correct)"
        Write-Host "  3. The WASM might need to be installed differently"
        Write-Host ""
        Write-Info "Try upgrading your Soroban CLI to the latest version:"
        Write-Host "  cargo install --locked --force stellar-cli"
        Write-Host ""
        Write-Info "Or try using Stellar Laboratory to upgrade manually:"
        Write-Host "  https://laboratory.stellar.org/ (Soroban tab)"
        Write-Host ""
    }
    if ($errorOutput -match "Missing signing key for account (G[A-Z0-9]{55})") {
        $requiredAccount = $Matches[1]
        Write-Warning "The upgrade requires the signing key for account: $requiredAccount"
        Write-Host ""
        Write-Info "This account is likely the contract admin."
        Write-Info "You need to use the secret key for this account to upgrade the contract."
        Write-Host ""
        Write-Question "Would you like to enter the secret key for this account now? [y/N]"
        $useAdminKey = Read-Host
        if ($useAdminKey -eq "y" -or $useAdminKey -eq "Y") {
            Write-Question "Enter the secret key for account $requiredAccount (starts with 'S'):"
            $adminSecretKey = Read-Host "Secret Key" -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecretKey)
            $rawAdminKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
            $rawAdminKey = $rawAdminKey.Trim()
            
            if ($rawAdminKey.StartsWith("S")) {
                # Create temporary identity for admin account
                $adminTempIdentity = "temp_admin_$(Get-Random)"
                Write-Info "Adding admin secret key as temporary identity '$adminTempIdentity'..."
                $env:SOROBAN_SECRET_KEY = $rawAdminKey
                $addAdminOutput = soroban keys add $adminTempIdentity --secret-key 2>&1
                $addAdminSuccess = $LASTEXITCODE -eq 0
                Remove-Item Env:\SOROBAN_SECRET_KEY -ErrorAction SilentlyContinue
                
                if ($addAdminSuccess) {
                    $SourceAccount = $adminTempIdentity
                    Write-Success "Admin identity created. Retrying upgrade..."
                    Write-Host ""
                    # Retry the upgrade with the admin account
                    soroban contract invoke `
                        --id $ContractId `
                        --source-account $SourceAccount `
                        --network $Network `
                        -- `
                        upgrade `
                        --new_wasm_hash $WasmHash
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Success "Contract upgraded successfully with admin account!"
                    } else {
                        Write-Error "Upgrade still failed. Please check the error above."
                        exit 1
                    }
                } else {
                    Write-Error "Failed to add admin secret key as identity!"
                    exit 1
                }
            } else {
                Write-Error "Invalid secret key format!"
                exit 1
            }
        } else {
            Write-Info "Upgrade cancelled. Please use the admin account's secret key to upgrade."
            exit 1
        }
    } else {
        Write-Warning "Common issues:"
        Write-Host "  1. The account you're using is not the contract admin"
        Write-Host "  2. The account doesn't have enough XLM for transaction fees"
        Write-Host "  3. The WASM hash doesn't match an installed WASM on the ledger"
        Write-Host "  4. XDR format error - the hash format might be incorrect"
        if ($errorOutput -match "xdr processing error") {
            Write-Host ""
            Write-Info "XDR processing error detected. This usually means:"
            Write-Host "  - The hash format is incorrect (should be 64 hex characters)"
            Write-Host "  - The hash doesn't match a WASM installed on the ledger"
            Write-Host "  - There's a version mismatch in the Soroban CLI"
            Write-Host ""
            Write-Info "Current hash: $WasmHash"
            Write-Info "Hash length: $($WasmHash.Length) characters"
            Write-Info "Try reinstalling the WASM to ensure it's on the ledger with this exact hash"
        }
        exit 1
    }
}
Write-Success 'Contract upgraded successfully!'
Write-Host ""

# Step 6: Verify the upgrade
Write-Info "Step 6: Verifying upgrade..."
Start-Sleep -Seconds 2

try {
    soroban contract invoke --id $ContractId --source-account $SourceAccount --network $Network -- get_game_hub 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success 'Upgrade verified! New functions are available.'
    } else {
        Write-Warning 'Could not verify new functions (they may not be available yet or contract may not have Game Hub set)'
    }
} catch {
    Write-Warning 'Could not verify new functions (they may not be available yet)'
}
Write-Host ""

# Summary
Write-Success 'Upgrade process completed!'
Write-Host ""
Write-Info 'Summary:'
Write-Host "  Contract ID: $ContractId"
Write-Host "  Network: $Network"
Write-Host "  WASM Hash: $WasmHash"
Write-Host "  WASM File: $WasmToUse"
Write-Host ""
Write-Info 'The contract has been upgraded with the latest changes:'
Write-Host '  - Added get_game_hub function'
Write-Host '  - Enhanced Game Hub verification'
Write-Host '  - Improved logging for start_game/end_game calls'
Write-Host ""
Write-Info 'Next steps:'
Write-Host '  1. The frontend will automatically detect the new get_game_hub function'
Write-Host '  2. Check the browser console for Game Hub verification messages'
Write-Host '  3. Test by creating a session and verifying start_game is called'
Write-Host '  4. Test by resolving a match and verifying end_game is called'
Write-Host ""
