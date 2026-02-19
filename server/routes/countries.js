const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path to countries.geojson file
// In development, it's in the project root's public directory
// In production, it might be in build/public or build directory
function getGeoJsonPath() {
  const projectRoot = path.join(__dirname, '..', '..');
  const possiblePaths = [
    path.join(projectRoot, 'public', 'countries.geojson'),
    path.join(projectRoot, 'build', 'countries.geojson'),
    path.join(projectRoot, 'build', 'public', 'countries.geojson'),
  ];
  
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      return testPath;
    }
  }
  
  // Default to public directory
  return path.join(projectRoot, 'public', 'countries.geojson');
}

// GET /api/countries - Get countries.geojson with ETag
router.get('/', (req, res) => {
  try {
    const geojsonPath = getGeoJsonPath();
    
    if (!fs.existsSync(geojsonPath)) {
      return res.status(404).json({ error: 'countries.geojson file not found' });
    }
    
    const content = fs.readFileSync(geojsonPath, 'utf8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    
    res.setHeader('ETag', `"${hash}"`);
    res.setHeader('Cache-Control', 'no-cache'); // Allow revalidation
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
  } catch (error) {
    console.error('Error reading countries.geojson:', error);
    res.status(500).json({ error: 'Failed to read countries.geojson', message: error.message });
  }
});

// POST /api/countries/update - Update country borders
router.post('/update', (req, res) => {
  try {
    const { countryCode, geometry, fullGeoJson } = req.body;
    
    if (!countryCode || !geometry || !fullGeoJson) {
      return res.status(400).json({ error: 'Missing required fields: countryCode, geometry, fullGeoJson' });
    }

    const geojsonPath = getGeoJsonPath();
    
    // Check if file exists
    if (!fs.existsSync(geojsonPath)) {
      return res.status(404).json({ error: 'countries.geojson file not found' });
    }

    // Read current file
    const currentContent = fs.readFileSync(geojsonPath, 'utf8');
    const currentGeoJson = JSON.parse(currentContent);
    
    // Check ETag if provided (for conflict detection)
    const ifMatch = req.headers['if-match'];
    if (ifMatch) {
      const currentHash = crypto.createHash('md5').update(currentContent).digest('hex');
      if (currentHash !== ifMatch.replace(/"/g, '')) {
        return res.status(412).json({ error: 'File was modified by another user' });
      }
    }

    // Write the updated GeoJSON
    const updatedContent = JSON.stringify(fullGeoJson, null, 2);
    fs.writeFileSync(geojsonPath, updatedContent, 'utf8');
    
    // Calculate new ETag
    const newHash = crypto.createHash('md5').update(updatedContent).digest('hex');
    
    res.setHeader('ETag', `"${newHash}"`);
    res.json({ 
      success: true, 
      message: 'Country borders updated successfully',
      countryCode 
    });
  } catch (error) {
    console.error('Error updating countries.geojson:', error);
    res.status(500).json({ 
      error: 'Failed to update file', 
      message: error.message 
    });
  }
});

module.exports = router;
