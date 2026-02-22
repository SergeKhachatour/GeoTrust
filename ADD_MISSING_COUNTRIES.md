# Guide: Adding Missing Countries to countries.geojson

## Current Status
- **Current countries**: 177
- **Total UN-recognized countries**: 195
- **Missing**: ~18 countries

## Structure Requirements

Your GeoJSON file must maintain this exact structure for the border saving functionality to work:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Country Name"
      },
      "geometry": {
        "type": "Polygon" or "MultiPolygon",
        "coordinates": [[[lon, lat], ...]]
      },
      "id": "ISO3_CODE"
    }
  ]
}
```

## Important Notes

1. **`properties.name`**: Must match the country name (e.g., "USA", "United Kingdom")
2. **`id`**: Must be the ISO 3166-1 alpha-3 code (e.g., "USA", "GBR")
3. **`geometry`**: Must be valid GeoJSON geometry (Polygon or MultiPolygon)
4. **No additional properties**: Don't add ISO2, ISO_NUMERIC, etc. - the code extracts these automatically

## How to Add Missing Countries

### Option 1: Download from Natural Earth Data

1. Visit: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/
2. Download "Admin 0 – Countries" GeoJSON
3. Extract the countries you need
4. Convert to match your structure:
   - Keep only `properties.NAME` → rename to `properties.name`
   - Keep `geometry` as-is
   - Use `properties.ISO_A3` → set as `id`

### Option 2: Use OpenStreetMap Data

1. Visit: https://geojson.xyz/
2. Search for the country
3. Download the GeoJSON
4. Transform to match your structure

### Option 3: Manual Addition

For each missing country, add a feature like this:

```json
{
  "type": "Feature",
  "properties": {
    "name": "Country Name"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lon1, lat1], [lon2, lat2], ...]]
  },
  "id": "ISO3"
}
```

## Common Missing Countries

Based on standard country lists, these might be missing:
- Vatican City (VAT)
- Monaco (MCO)
- San Marino (SMR)
- Liechtenstein (LIE)
- Andorra (AND)
- Nauru (NRU)
- Tuvalu (TUV)
- Palau (PLW)
- Marshall Islands (MHL)
- Micronesia (FSM)
- Kiribati (KIR)
- Saint Kitts and Nevis (KNA)
- Dominica (DMA)
- Grenada (GRD)
- Saint Vincent and the Grenadines (VCT)
- Antigua and Barbuda (ATG)
- Saint Lucia (LCA)
- Seychelles (SYC)
- Maldives (MDV)
- Malta (MLT)
- Cyprus (CYP)

## Verification

After adding countries, verify:
1. JSON is valid (use a JSON validator)
2. All features have `properties.name`
3. All features have `id` (ISO3 code)
4. All geometries are valid
5. Country count matches expected

## Testing

1. Load the map - all countries should appear
2. Click on a newly added country - should open country profile
3. As admin, try to edit borders - should work
4. Check hover tooltip - should show country name and vault status

## Code Compatibility

The existing code will automatically:
- Extract ISO2 from ISO3 (`id` field) using `iso3ToIso2()`
- Extract country name from `properties.name`
- Convert to numeric code using `iso2ToNumeric()`
- Handle name variations (e.g., "USA" → "US")

No code changes needed - just add the countries to the GeoJSON file!
