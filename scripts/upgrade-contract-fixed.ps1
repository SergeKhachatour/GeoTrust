# PowerShell script for upgrading the GeoTrust Match contract on Windows

param(
    [Parameter(Mandatory=$false)]
    [string]$ContractId = $env:CONTRACT_ID,
    
    [Parameter(Mandatory=$false)]
    [string]$Network = $env:NETWORK,
    
    [Parameter(Mandatory=$false)]
    [string]$AdminIdentity =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
)

# Colors for output (PowerShell 5.1+ compatible)
function Write-Info {
    param([string]$Message)
    Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  -ForegroundColor Red
}

function Write-Question {
    param([string]$Message)
    Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  -ForegroundColor Magenta
}

# Interactive prompts for missing values
if ([string]::IsNullOrEmpty($ContractId)) {
    Write-Question  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    Write-Host '  (It should start with C and be 56 characters long)' -ForegroundColor Gray
    $ContractId = Read-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    if ([string]::IsNullOrEmpty($ContractId)) {
        Write-Error  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        exit 1
    }
    if (-not $ContractId.StartsWith( param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } )) {
        Write-Warning 'Contract ID should start with C. Continuing anyway...'
    }
}

if ([string]::IsNullOrEmpty($Network)) {
    Write-Question  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    Write-Host '  1) testnet (default)'
    Write-Host '  2) mainnet'
    Write-Host '  3) futurenet'
    $networkChoice = Read-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    switch ($networkChoice) {
         param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  { $Network =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  }
         param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  { $Network =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  }
        default { $Network =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  }
    }
}

# Check if admin identity exists
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
$identityList = soroban keys list 2>&1
if ($LASTEXITCODE -ne 0 -or $identityList -notmatch $AdminIdentity) {
    Write-Warning  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    Write-Question  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    Write-Host '  1) Create a new identity named' -NoNewline
    Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    Write-Host '  2) Use an existing identity (enter name)'
    Write-Host '  3) Continue anyway (Soroban will prompt for secret key)'
    $authChoice = Read-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    
    switch ($authChoice) {
         param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  {
            Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
            Write-Host 'You will be prompted to enter a secret key.' -ForegroundColor Yellow
            soroban keys add $AdminIdentity
            if ($LASTEXITCODE -ne 0) {
                Write-Error  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
                exit 1
            }
            Write-Success  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        }
         param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  {
            $AdminIdentity = Read-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        }
         param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  {
            Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        }
        default {
            Write-Error  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
            exit 1
        }
    }
} else {
    Write-Success  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
}

Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  -ForegroundColor Yellow
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
$confirm = Read-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
if ($confirm -ne  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value }  -and $confirm -ne  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } ) {
    Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    exit 0
}
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Configuration
$ContractDir =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
$BuildDir =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
$WasmFile =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
$WasmOptimized =  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Step 1: Build the contract
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Push-Location $ContractDir
try {
    soroban contract build
    if ($LASTEXITCODE -ne 0) {
        Write-Error  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        exit 1
    }
    Write-Success  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
} finally {
    Pop-Location
}
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Step 2: Check if optimization is available
$WasmToUse = $WasmFile
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
try {
    $null = soroban contract optimize --help 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        soroban contract optimize --wasm $WasmFile --wasm-out $WasmOptimized 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $WasmToUse = $WasmOptimized
            Write-Success  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        } else {
            Write-Warning  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
        }
    }
} catch {
    Write-Warning  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
}
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Step 3: Get WASM hash
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
$WasmHash = soroban contract hash --wasm $WasmToUse
if ($LASTEXITCODE -ne 0) {
    Write-Error  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    exit 1
}
Write-Success  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Step 4: Verify contract exists
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
try {
    soroban contract invoke --id $ContractId --source $AdminIdentity --network $Network -- get_admin 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    } else {
        Write-Warning 'Could not verify admin access (this is okay, continuing...)'
        Write-Warning  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    }
} catch {
    Write-Warning 'Could not verify admin access (this is okay, continuing...)'
    Write-Warning  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
}
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Step 5: Upgrade the contract
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Warning  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Warning  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Start-Sleep -Seconds 2

Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
soroban contract invoke `
    --id $ContractId `
    --source $AdminIdentity `
    --network $Network `
    -- `
    upgrade `
    --new_wasm_hash $WasmHash

if ($LASTEXITCODE -ne 0) {
    Write-Error  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
    exit 1
}
Write-Success 'Contract upgraded successfully!'
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Step 6: Verify the upgrade
Write-Info  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Start-Sleep -Seconds 2

try {
    soroban contract invoke --id $ContractId --source $AdminIdentity --network $Network -- get_game_hub 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success 'Upgrade verified! New functions are available.'
    } else {
        Write-Warning 'Could not verify new functions (they may not be available yet or contract may not have Game Hub set)'
    }
} catch {
    Write-Warning 'Could not verify new functions (they may not be available yet)'
}
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

# Summary
Write-Success 'Upgrade process completed!'
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Info 'Summary:'
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Info 'The contract has been upgraded with the latest changes:'
Write-Host '  - Added get_game_hub function'
Write-Host '  - Enhanced Game Hub verification'
Write-Host '  - Improved logging for start_game/end_game calls'
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 
Write-Info 'Next steps:'
Write-Host '  1. The frontend will automatically detect the new get_game_hub function'
Write-Host '  2. Check the browser console for Game Hub verification messages'
Write-Host '  3. Test by creating a session and verifying start_game is called'
Write-Host '  4. Test by resolving a match and verifying end_game is called'
Write-Host  param($m) if ($m.Value -match '[()!]') { "'$($m.Groups[1].Value)'" } else { $m.Value } 

