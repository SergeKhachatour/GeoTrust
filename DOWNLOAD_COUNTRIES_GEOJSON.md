# Download Complete Countries GeoJSON

The current `countries.geojson` file only contains the United States. You need to download a complete world countries GeoJSON file.

## Option 1: Natural Earth Data (Recommended)

1. Go to: https://github.com/holtzy/D3-graph-gallery/blob/master/DATA/world.geojson
2. Or download from: https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson
3. Save as `public/countries.geojson`

**Note**: This file may not have `ISO_NUMERIC` property. You may need to add it.

## Option 2: Use Mapbox Countries (Built-in)

Mapbox has built-in country boundaries. We can use their vector tiles instead of loading a GeoJSON file.

## Option 3: Custom GeoJSON with ISO_NUMERIC

Download from: https://github.com/datasets/geo-countries

Or use this script to convert:

```bash
# Download world countries GeoJSON
curl -o public/countries.geojson https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson
```

Then add `ISO_NUMERIC` property to each feature based on `ISO_A2` or `NAME` field.

## Quick Fix: Use Mapbox Vector Tiles

Instead of loading a GeoJSON file, we can use Mapbox's built-in country boundaries which already have proper ISO codes.

Would you like me to update the code to use Mapbox vector tiles instead?
