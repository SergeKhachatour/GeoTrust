# Building the Contract

## Quick Build

The contract has already been built! The WASM file is located at:

```
contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm
```

## To Rebuild

If you need to rebuild the contract:

```bash
cd contracts/geotrust-match
cargo build --target wasm32-unknown-unknown --release
```

## File Location

After building, you'll find:
- **WASM file**: `contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm`

This is the file you'll upload to Stellar Laboratory for deployment.

## Optional: Optimize WASM

To create a smaller optimized version (optional):

1. Install soroban-cli with opt feature:
   ```bash
   cargo install --locked soroban-cli --features opt
   ```

2. Optimize the WASM:
   ```bash
   soroban contract optimize \
     --wasm contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match.wasm \
     --wasm-out contracts/geotrust-match/target/wasm32-unknown-unknown/release/geotrust_match_optimized.wasm
   ```

3. Use the optimized file: `geotrust_match_optimized.wasm`

**Note**: The unoptimized WASM works fine for deployment. Optimization just reduces file size.
