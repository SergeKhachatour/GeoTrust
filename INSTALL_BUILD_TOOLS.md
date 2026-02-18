# Installing Visual Studio Build Tools for Cargo Scout Audit

## Step-by-Step Instructions

### Step 1: Download Build Tools

1. Go to: https://visualstudio.microsoft.com/downloads/
2. Scroll down to the **"Tools for Visual Studio"** section (NOT the main Visual Studio IDE section)
3. Find **"Build Tools for Visual Studio 2026"** (or 2022 if 2026 isn't available)
4. Click the **"Download"** button under the EXE option
5. This will download a small installer (usually named something like `vs_buildtools.exe`)

### Step 2: Run the Installer

1. Run the downloaded `vs_buildtools.exe` file
2. You may see a User Account Control prompt - click "Yes"
3. The Visual Studio Installer will launch

### Step 3: Select the C++ Workload

1. In the Visual Studio Installer, you'll see a list of workloads
2. Look for **"Desktop development with C++"**
3. **Check the box** next to "Desktop development with C++"
4. This will automatically select the necessary components including:
   - MSVC compiler
   - Windows SDK
   - C++ build tools
   - Linker (link.exe)

### Step 4: Install

1. Click the **"Install"** or **"Modify"** button (depending on if you have VS installed)
2. Wait for the installation to complete (this may take 10-30 minutes depending on your internet speed)
3. You may be prompted to restart your computer - do so if asked

### Step 5: Verify Installation

After installation and restart (if needed), open a **new** PowerShell window and verify:

```powershell
# Check if link.exe is available
where.exe link.exe

# Should show something like:
# C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.xx.xxxxx\bin\Hostx64\x64\link.exe
```

### Step 6: Set Rust to Use MSVC Toolchain

```powershell
rustup default stable-x86_64-pc-windows-msvc
rustc --version  # Should show 1.93.1 or higher
```

### Step 7: Install Cargo Scout Audit

```powershell
cargo install cargo-scout-audit
```

This should now work without errors!

## Troubleshooting

### If "Desktop development with C++" doesn't appear:
- Make sure you downloaded **Build Tools**, not the full Visual Studio IDE
- Try downloading "Build Tools for Visual Studio 2022" instead if 2026 isn't working

### If link.exe still not found after installation:
- Make sure you opened a **new** PowerShell window (environment variables need to refresh)
- Try restarting your computer
- Check that the installation completed successfully in the Visual Studio Installer

### If you already have Visual Studio installed:
- You can use the existing installation
- Just make sure the "Desktop development with C++" workload is installed
- Open Visual Studio Installer → Modify → Check "Desktop development with C++" → Modify

## What You're Installing

The "Desktop development with C++" workload includes:
- **MSVC v143 - VS 2022 C++ x64/x86 build tools** (the compiler)
- **Windows 10/11 SDK** (for Windows APIs)
- **C++ CMake tools** (optional but useful)
- **Testing tools** (optional)

The total download size is typically 2-4 GB.
