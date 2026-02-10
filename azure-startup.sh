#!/bin/bash

# Azure startup script for Node.js React app
# This script is used when Azure needs to serve the built React app

# Install serve if not present
if ! command -v serve &> /dev/null; then
  npm install -g serve
fi

# Serve the built React app
# The build folder should already exist from the build process
serve -s build -l 8080
