# PowerShell script for upgrading the GeoTrust Match contract on Windows

param(
    [Parameter(Mandatory=$false)]
    [string]$ContractId = $env:CONTRACT_ID,
    
    [Parameter(Mandatory=$false)]
    [string]$Network = "testnet"
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

# Check if CONTRACT_ID is set
if ([string]::IsNullOrEmpty($ContractId)) {
    Write-Error "CONTRACT_ID not set"
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  `$env:CONTRACT_ID = 'C...'"
    Write-Host "  .\scripts\upgrade-contract.ps1"
    Write-Host ""
    Write-Host "Or pass as parameter:"
    Write-Host "  .\scripts\upgrade-contract.ps1 -ContractId 'C...'"
    exit 1
}

Write-Info "Starting contract upgrade process..."
Write-Host ""
Write-Info "Contract ID: $ContractId"
Write-Info "Network: $Network"
Write-Host ""

# Configuration
$ContractDir = "contracts\geotrust-match"
$BuildDir = "$ContractDir\target\wasm32-unknown-unknown\release"
$WasmFile = "$BuildDir\geotrust_match.wasm"
$WasmOptimized = "$BuildDir\geotrust_match_optimized.wasm"

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

# Step 3: Get WASM hash
Write-Info "Step 3: Calculating WASM hash..."
$WasmHash = soroban contract hash --wasm $WasmToUse
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to get WASM hash!"
    exit 1
}
Write-Success "WASM Hash: $WasmHash"
Write-Host ""

# Step 4: Verify contract exists
Write-Info "Step 4: Verifying contract and admin access..."
try {
    soroban contract invoke --id $ContractId --source admin --network $Network -- get_admin 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Contract and admin access verified"
    } else {
        Write-Warning "Could not verify admin access (this is okay, continuing...)"
    }
} catch {
    Write-Warning "Could not verify admin access (this is okay, continuing...)"
}
Write-Host ""

# Step 5: Upgrade the contract
Write-Info "Step 5: Upgrading contract..."
Write-Warning "This will update the contract WASM. Press Ctrl+C to cancel..."
Start-Sleep -Seconds 2

soroban contract invoke `
    --id $ContractId `
    --source admin `
    --network $Network `
    -- `
    upgrade `
    --new_wasm_hash $WasmHash

if ($LASTEXITCODE -ne 0) {
    Write-Error "Contract upgrade failed!"
    exit 1
}
Write-Success "Contract upgraded successfully!"
Write-Host ""

# Step 6: Verify the upgrade
Write-Info "Step 6: Verifying upgrade..."
Start-Sleep -Seconds 2

try {
    soroban contract invoke --id $ContractId --source admin --network $Network -- get_game_hub 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Upgrade verified! New functions are available."
    } else {
        Write-Warning "Could not verify new functions (they may not be available yet or contract may not have Game Hub set)"
    }
} catch {
    Write-Warning "Could not verify new functions (they may not be available yet)"
}
Write-Host ""

# Summary
Write-Success "Upgrade process completed!"
Write-Host ""
Write-Info "Summary:"
Write-Host "  Contract ID: $ContractId"
Write-Host "  Network: $Network"
Write-Host "  WASM Hash: $WasmHash"
Write-Host "  WASM File: $WasmToUse"
Write-Host ""
Write-Info "The contract has been upgraded with the latest changes:"
Write-Host "  ✅ Added get_game_hub() function"
Write-Host "  ✅ Enhanced Game Hub verification"
Write-Host "  ✅ Improved logging for start_game/end_game calls"
Write-Host ""
Write-Info "Next steps:"
Write-Host "  1. The frontend will automatically detect the new get_game_hub function"
Write-Host "  2. Check the browser console for Game Hub verification messages"
Write-Host "  3. Test by creating a session and verifying start_game is called"
Write-Host "  4. Test by resolving a match and verifying end_game is called"
Write-Host ""
