use dep::std;

// Proves that a cell_id is correctly derived from lat/lon without revealing exact coordinates
// Private inputs: latitude, longitude
// Public inputs: cell_id, grid_size
fn main(
    // Private inputs
    latitude: Field,
    longitude: Field,
    // Public inputs
    cell_id: Field,
    grid_size: Field,
) -> pub bool {
    // Validate latitude range: -90 to 90
    assert(latitude >= -90000000); // -90.0 * 1e6 (scaled to avoid floats)
    assert(latitude <= 90000000);  // 90.0 * 1e6
    
    // Validate longitude range: -180 to 180
    assert(longitude >= -180000000); // -180.0 * 1e6
    assert(longitude <= 180000000);  // 180.0 * 1e6
    
    // Calculate cell coordinates
    // grid_size is in degrees * 1e6 (e.g., 1000000 for 1.0 degree)
    let grid_size_scaled = grid_size;
    
    // Calculate cell X: floor((longitude + 180) / grid_size)
    // We scale by 1e6 to work with integers
    let lng_offset = longitude + 180000000; // longitude + 180.0 * 1e6
    let cell_x = lng_offset / grid_size_scaled;
    
    // Calculate cell Y: floor((latitude + 90) / grid_size)
    let lat_offset = latitude + 90000000; // latitude + 90.0 * 1e6
    let cell_y = lat_offset / grid_size_scaled;
    
    // Calculate cell_id: cell_y * 360 + cell_x
    // For 1.0 degree grid: 360 cells in X direction
    let cells_per_row = 360000000 / grid_size_scaled; // 360 / grid_size, scaled
    let calculated_cell_id = cell_y * cells_per_row + cell_x;
    
    // Verify the provided cell_id matches the calculated one
    assert(calculated_cell_id == cell_id);
    
    true
}
