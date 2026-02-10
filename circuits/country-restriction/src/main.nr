use dep::std;

fn main(
    country: u16,
    restricted_list: [u16; 10],
    restricted_list_len: u16,
) -> pub bool {
    // Check if country is NOT in restricted list
    let mut is_restricted = false;
    
    for i in 0..restricted_list_len {
        if country == restricted_list[i] {
            is_restricted = true;
            break;
        }
    }
    
    // Return true if country is NOT restricted (allowed)
    !is_restricted
}
