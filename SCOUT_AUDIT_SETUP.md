# Cargo Scout Audit Setup Guide

This guide will help you install and run `cargo-scout-audit` to scan your Soroban smart contracts for security issues.

## Prerequisites

`cargo-scout-audit` requires native build tools to compile. You need one of the following:

### Option 1: Visual Studio Build Tools (Recommended for Windows)

1. Download and install **Build Tools for Visual Studio**:
   - Visit: https://visualstudio.microsoft.com/downloads/
   - Scroll down to "All Downloads" → "Tools for Visual Studio"
   - Download "Build Tools for Visual Studio 2022"

2. During installation, select:
   - ✅ **Desktop development with C++** workload
   - This includes the MSVC compiler and linker

3. After installation, restart your terminal/PowerShell

4. Verify installation:
   ```powershell
   rustup default stable-x86_64-pc-windows-msvc
   rustc --version  # Should show 1.91 or higher
   ```

5. Install cargo-scout-audit:
   ```powershell
   cargo install cargo-scout-audit
   ```

### Option 2: MinGW-w64 (Alternative)

1. Install MinGW-w64:
   - Download from: https://www.mingw-w64.org/downloads/
   - Or use MSYS2: https://www.msys2.org/
   - Ensure `dlltool.exe` is in your PATH

2. Set Rust to use GNU toolchain:
   ```powershell
   rustup default stable-x86_64-pc-windows-gnu
   rustup update stable
   ```

3. Install cargo-scout-audit:
   ```powershell
   cargo install cargo-scout-audit
   ```

## Installation Steps

Once you have the build tools installed:

1. **Install dependencies** (if needed):
   ```powershell
   cargo install cargo-dylint dylint-link
   ```

2. **Install cargo-scout-audit**:
   ```powershell
   cargo install cargo-scout-audit
   ```

3. **Verify installation**:
   ```powershell
   cargo scout-audit --version
   ```

## Running Scans

### Using the Automated Script

We've created a PowerShell script to scan all contracts:

```powershell
# Basic scan (markdown output)
.\scripts\run-scout-audit.ps1

# HTML output
.\scripts\run-scout-audit.ps1 -OutputFormat html

# JSON output (for CI/CD)
.\scripts\run-scout-audit.ps1 -OutputFormat json

# Verbose output
.\scripts\run-scout-audit.ps1 -Verbose
```

### Manual Scanning

You can also run scans manually for each contract:

```powershell
# Scan geotrust-match contract
cd contracts\geotrust-match
cargo scout-audit --output-format md --output ..\..\scout-audit-results\geotrust-match.md

# Scan zk-verifier contract
cd ..\zk-verifier
cargo scout-audit --output-format md --output ..\..\scout-audit-results\zk-verifier.md
```

## Output Formats

Scout supports multiple output formats:

- `md` - Markdown (default, human-readable)
- `html` - HTML report (good for viewing in browser)
- `json` - JSON (for programmatic processing)
- `sarif` - SARIF format (for GitHub Security)
- `pdf` - PDF report

## What Scout Checks

Scout analyzes your Soroban contracts for:

- Common security vulnerabilities
- Best practice violations
- Potential bugs and issues
- Code quality issues

## Troubleshooting

### Error: "link.exe not found"
- **Solution**: Install Visual Studio Build Tools with C++ workload (Option 1)

### Error: "dlltool.exe not found"
- **Solution**: Install MinGW-w64 and ensure it's in PATH (Option 2)

### Error: "rustc 1.90.0 is not supported"
- **Solution**: Update Rust toolchain:
  ```powershell
  rustup update stable
  rustup default stable-x86_64-pc-windows-msvc
  ```

### Contract won't compile
- Scout requires contracts to compile successfully before scanning
- Fix any compilation errors first
- Ensure you can run `cargo check` in the contract directory

## Integration with CI/CD

You can integrate Scout into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run Scout Audit
  run: |
    cargo install cargo-scout-audit
    cargo scout-audit --output-format json --output scout-results.json
```

## Resources

- Scout Documentation: https://coinfabrik.github.io/scout/docs/intro
- Cargo Scout Audit on crates.io: https://crates.io/crates/cargo-scout-audit
- GitHub Repository: https://github.com/coinfabrik/scout
