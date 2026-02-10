# Troubleshooting Guide

## WASM Upload Errors

### Error: "reference-types not enabled: zero byte expected"

**Problem**: The WASM file was built incorrectly or doesn't have the proper optimization settings.

**Solution**:
1. **Ensure Cargo.toml has release profile settings**:
   - Check that `contracts/geotrust-match/Cargo.toml` includes the `[profile.release]` section
   - This section should have `opt-level = "z"`, `lto = true`, `panic = "abort"`, etc.

2. **Clean and rebuild using Soroban CLI**:
   ```bash
   cd contracts/geotrust-match
   cargo clean
   soroban contract build
   ```

3. **Verify the build**:
   - The WASM should be at: `target/wasm32-unknown-unknown/release/geotrust_match.wasm`
   - File size should be reasonable (typically under 64KB for Soroban)

4. **Try uploading again** in Stellar Lab

**Why this happens**: 
- Soroban requires WASM files in a specific format with size optimizations
- `cargo build` produces standard WASM that isn't Soroban-compatible
- `soroban contract build` with proper release profile ensures the WASM is optimized and in the correct format
- Missing release profile settings can cause WASM to be too large or improperly formatted

### Error: "HostError: Error(WasmVm, InvalidAction)"

This usually means:
- WASM file is corrupted
- Wrong WASM format (see above)
- Contract uses unsupported features

**Solution**: Rebuild with `soroban contract build`

## Contract Deployment Issues

### "Contract not found" after deployment

- Verify contract ID in `.env.local`
- Ensure you're on the same network (testnet/mainnet)
- Check Stellar Lab shows the contract as deployed

### "Country not allowed"

- Check country policy: Use `get_country_policy()` in Stellar Lab
- Allow your country via admin panel or `set_country_allowed`
- Verify you're using the correct ISO numeric code

### "Admin required" errors

- Ensure you're using the admin wallet
- Verify admin address: `get_admin()`
- Check you initialized the contract with your address

## Frontend Issues

### Mapbox token errors

- Verify `.env.local` has `REACT_APP_MAPBOX_TOKEN`
- Check token is valid and not expired
- Ensure token starts with `pk.`

### Wallet connection fails

- Install Freighter wallet extension
- Ensure wallet is unlocked
- Check network matches (testnet/mainnet)

### ZK proof generation fails

- For MVP: Mock proofs are used (this is expected)
- For production: Integrate Noir.js or proof service
- See `ZK_PROOF_GUIDE.md` for details

## Build Issues

### "soroban: command not found"

Install Soroban CLI:
```bash
cargo install --locked soroban-cli
```

### "opt feature not available"

Optimization is optional. The contract works without it:
```bash
# Install with opt feature (optional)
cargo install --locked soroban-cli --features opt
```

### Contract won't compile

- Check Rust version: `rustc --version` (should be 1.70+)
- Ensure wasm32 target: `rustup target add wasm32-unknown-unknown`
- Check Cargo.toml has correct soroban-sdk version

## Network Issues

### Wrong network

- Frontend defaults to testnet
- Contract must be on same network
- Check `src/contract.ts` for network settings

### RPC errors

- Verify RPC endpoint is accessible
- Check network connectivity
- Try different RPC endpoint if available

## Still Having Issues?

1. Check browser console for errors
2. Verify all environment variables are set
3. Ensure contract is deployed and initialized
4. Check Soroban CLI version: `soroban --version`
5. Review contract logs in Stellar Lab
