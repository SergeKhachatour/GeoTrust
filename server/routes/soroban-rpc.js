const express = require('express');
const router = express.Router();
const https = require('https');
const { URL } = require('url');

const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';

// Proxy Soroban RPC requests
router.post('/', (req, res) => {
  const url = new URL(SOROBAN_RPC_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'GeoTrust-Soroban-Proxy/1.0',
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    res.writeHead(proxyRes.statusCode, res.getHeaders());
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Soroban RPC Proxy error:', err);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: err.message 
    });
  });

  // Forward request body
  req.pipe(proxyReq);
});

module.exports = router;
