const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
// Load environment variables
// .env.local takes precedence over .env (similar to React's pattern)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // .env as fallback

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.mapbox.com", "https://*.mapbox.com", "https://horizon-testnet.stellar.org", "https://horizon.stellar.org", "https://soroban-testnet.stellar.org"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
      workerSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      fontSrc: ["'self'", "https://api.mapbox.com"]
    }
  }
}));
app.use(cors());
// Custom Morgan format - show more useful info, less verbose for contract readonly
app.use(morgan((tokens, req, res) => {
  const method = tokens.method(req, res);
  const url = tokens.url(req, res);
  const status = tokens.status(req, res);
  const responseTime = tokens['response-time'](req, res);
  
  // Skip detailed logging for contract readonly (we log it separately)
  if (url === '/api/contract/readonly') {
    return null; // Don't log via Morgan, we log it in the route handler
  }
  
  // For other routes, use standard format
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    '-',
    tokens['response-time'](req, res), 'ms',
    tokens.res(req, res, 'content-length'), 'bytes'
  ].join(' ');
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - more lenient for read-only contract operations
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // limit each IP to 1000 requests per minute
  skip: (req) => {
    // Skip general limiter for read-only contract operations
    return req.path === '/api/contract/readonly';
  }
});

// More lenient rate limiter for read-only contract operations
const readonlyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10000 // Allow more requests for read-only operations
});

// Apply general rate limiting to all routes (except /api/contract/readonly)
app.use(generalLimiter);

// Routes
app.use('/api/countries', require('./routes/countries'));
app.use('/api/soroban-rpc', require('./routes/soroban-rpc'));
// Apply more lenient rate limiting to contract readonly endpoint (before the route)
app.use('/api/contract/readonly', readonlyLimiter);
app.use('/api/contract', require('./routes/contract'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development'
  });
});

// Simple test route
app.get('/test', (req, res) => {
  res.json({ 
    message: 'GeoTrust Backend is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve React app in production
// Check multiple possible build locations
const possibleBuildPaths = [
  path.join(__dirname, '..', 'build'),           // Production build
  path.join(__dirname, '..', 'client', 'build'), // Alternative structure
];

let buildPath = null;
for (const testPath of possibleBuildPaths) {
  if (fs.existsSync(testPath)) {
    buildPath = testPath;
    break;
  }
}

if (buildPath) {
  console.log('✅ Serving React app from:', buildPath);
  
  // Serve static files with cache control
  app.use(express.static(buildPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Don't cache index.html - always fetch fresh
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      // Cache static assets (JS, CSS, images) for 1 year
      else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    // Serve index.html for all other routes
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  console.log('ℹ️  React build not found - API server only mode (development)');
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Add error handling for server startup
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GeoTrust Backend running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 Listening on: 0.0.0.0:${PORT}`);
}).on('error', (err) => {
  console.error('❌ Server startup error:', err);
  process.exit(1);
});
