/**
 * ZK Proof generation for location privacy
 * 
 * This module handles generating ZK proofs that prove a cell_id is correctly
 * derived from lat/lon without revealing the exact coordinates.
 */

export interface LocationProofData {
  proof: Uint8Array;
  publicInputs: {
    cellId: number;
    gridSize: number; // scaled by 1e6 (e.g., 1000000 for 1.0 degree)
  };
}

/**
 * Generate a ZK proof for location
 * 
 * Private inputs: latitude, longitude (scaled by 1e6)
 * Public inputs: cell_id, grid_size
 * 
 * @param latitude - Latitude in degrees (e.g., 40.0)
 * @param longitude - Longitude in degrees (e.g., -74.0)
 * @param gridSize - Grid size in degrees (default 1.0)
 * @returns Proof data including proof bytes and public inputs
 */
export async function generateLocationProof(
  latitude: number,
  longitude: number,
  gridSize: number = 1.0
): Promise<LocationProofData> {
  // Scale coordinates by 1e6 to work with integers in ZK circuit
  // Note: For MVP, we use mock proofs. In production, these scaled values would be used
  const gridSizeScaled = Math.floor(gridSize * 1e6);

  // Calculate cell_id (same as frontend calculation)
  const cellId = calculateCellId(latitude, longitude, gridSize);

  // For MVP: Return mock proof structure
  // In production, this would call Noir to generate actual proof
  // Example using nargo or noir-wasm:
  // const proof = await noirProve({
  //   latitude: latScaled,
  //   longitude: lngScaled,
  //   cell_id: cellId,
  //   grid_size: gridSizeScaled,
  // });

  // Mock proof for MVP - replace with actual Noir proof generation
  const mockProof = new Uint8Array(64); // Actual proof size depends on proof system
  
  return {
    proof: mockProof,
    publicInputs: {
      cellId,
      gridSize: gridSizeScaled,
    },
  };
}

/**
 * Calculate cell_id from lat/lon (same logic as ZK circuit)
 */
function calculateCellId(lat: number, lng: number, gridSize: number): number {
  const cellX = Math.floor((lng + 180) / gridSize);
  const cellY = Math.floor((lat + 90) / gridSize);
  const cellsPerRow = Math.floor(360 / gridSize);
  return cellY * cellsPerRow + cellX;
}

/**
 * Verify a location proof (client-side verification for testing)
 * 
 * In production, this would be done on-chain via verifier contract
 */
export async function verifyLocationProof(
  proof: Uint8Array,
  publicInputs: { cellId: number; gridSize: number },
  expectedCellId: number
): Promise<boolean> {
  // For MVP: Basic validation
  if (publicInputs.cellId !== expectedCellId) {
    return false;
  }

  // In production: Call verifier contract or use Noir verify
  // const isValid = await noirVerify(proof, publicInputs);
  
  return true;
}
