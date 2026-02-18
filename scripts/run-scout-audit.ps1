# Script to run cargo-scout-audit scans on all contracts
# Prerequisites: cargo-scout-audit must be installed
# Install with: cargo install cargo-scout-audit

param(
    [string]$OutputFormat = "md",  # Options: html, md, pdf, json, sarif
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

# Get script directory and project root
if ($PSScriptRoot) {
    $ScriptDir = $PSScriptRoot
} else {
    $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Info "=== Cargo Scout Audit Scan ==="
Write-Host ""

# Check if cargo-scout-audit is installed
Write-Info "Checking if cargo-scout-audit is installed..."
try {
    $null = cargo scout-audit --version 2>&1
    Write-Success "cargo-scout-audit is installed"
} catch {
    Write-Error "cargo-scout-audit is not installed!"
    Write-Host ""
    Write-Warning "To install cargo-scout-audit, you need:"
    Write-Host "  1. Visual Studio Build Tools (for MSVC) OR MinGW (for GNU)"
    Write-Host "  2. Then run: cargo install cargo-scout-audit"
    Write-Host ""
    Write-Host "For MSVC: Install 'Build Tools for Visual Studio' with C++ workload"
    Write-Host "For GNU: Install MinGW-w64 and ensure dlltool.exe is in PATH"
    exit 1
}

Write-Host ""

# List of contracts to scan
$Contracts = @(
    "geotrust-match",
    "zk-verifier"
)

$Results = @()

foreach ($Contract in $Contracts) {
    $ContractDir = Join-Path $ProjectRoot "contracts\$Contract"
    
    if (-not (Test-Path $ContractDir)) {
        Write-Warning "Contract directory not found: $ContractDir"
        continue
    }
    
    Write-Info "Scanning contract: $Contract"
    Write-Host "  Directory: $ContractDir"
    
    Push-Location $ContractDir
    try {
        # Create output directory for results
        $OutputDir = Join-Path $ProjectRoot "scout-audit-results"
        if (-not (Test-Path $OutputDir)) {
            New-Item -ItemType Directory -Path $OutputDir | Out-Null
        }
        
        $OutputFile = Join-Path $OutputDir "$Contract-scout-audit.$OutputFormat"
        
        # Run cargo scout-audit
        if ($Verbose) {
            cargo scout-audit --output-format $OutputFormat --output $OutputFile
        } else {
            cargo scout-audit --output-format $OutputFormat --output $OutputFile 2>&1 | Out-Null
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  ✓ Scan completed: $OutputFile"
            $Results += @{
                Contract = $Contract
                Status = "Success"
                OutputFile = $OutputFile
            }
        } else {
            Write-Warning "  ⚠ Scan completed with warnings/errors: $OutputFile"
            $Results += @{
                Contract = $Contract
                Status = "Warning"
                OutputFile = $OutputFile
            }
        }
    } catch {
        Write-Error "  ✗ Scan failed for $Contract"
        Write-Host "    Error: $_"
        $Results += @{
            Contract = $Contract
            Status = "Failed"
            OutputFile = $null
        }
    } finally {
        Pop-Location
    }
    Write-Host ""
}

# Summary
Write-Info "=== Scan Summary ==="
Write-Host ""
foreach ($Result in $Results) {
    $StatusColor = switch ($Result.Status) {
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Failed" { "Red" }
        default { "White" }
    }
    Write-Host "  $($Result.Contract): " -NoNewline
    Write-Host $Result.Status -ForegroundColor $StatusColor
    if ($Result.OutputFile) {
        Write-Host "    Output: $($Result.OutputFile)"
    }
}

Write-Host ""
Write-Success "All scans completed!"
Write-Host "Results saved in: $OutputDir"
