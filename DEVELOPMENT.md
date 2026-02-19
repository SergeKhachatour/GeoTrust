# Development Guide

## Starting the Application

### Option 1: Run Both Servers Together (Recommended)

Run both the backend API server and React dev server simultaneously:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:8080` (API endpoints)
- React dev server on `http://localhost:3366` (Frontend with hot reload)

The React dev server automatically proxies `/api/*` requests to the backend.

### Option 2: Run Servers Separately

**Terminal 1 - Backend Server:**
```bash
npm run server:dev
```
Backend runs on `http://localhost:8080`

**Terminal 2 - Frontend:**
```bash
npm start
```
Frontend runs on `http://localhost:3366` and proxies API requests to backend

## First Time Setup

Install all dependencies (root + server):

```bash
npm run install-all
```

Or manually:
```bash
npm install
cd server && npm install
```

## Available Scripts

- `npm start` - Start React dev server only (port 3366)
- `npm run server` - Start backend server in production mode (port 8080)
- `npm run server:dev` - Start backend server with nodemon (auto-restart on changes)
- `npm run dev` - Start both servers concurrently
- `npm run build` - Build React app for production
- `npm run install-all` - Install dependencies for root and server

## API Endpoints

All API endpoints are available at `http://localhost:8080/api/`:

- `GET /api/countries` - Get countries.geojson with ETag
- `POST /api/countries/update` - Update country borders
- `POST /api/soroban-rpc` - Proxy Soroban RPC requests
- `GET /health` - Health check
- `GET /test` - Test endpoint

## Production

In production, the backend server serves both:
- API endpoints at `/api/*`
- React static files (from `build/` directory)

Just run:
```bash
npm run start:prod
```

Or in Azure:
```bash
npm run azure-start
```
