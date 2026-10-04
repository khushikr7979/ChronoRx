#!/bin/bash
echo "==================================================="
echo "  Starting ChronoRx Tech Frontend Dev Server"
echo "==================================================="
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi
echo "Launching Vite dev server on http://localhost:5173..."
npm run dev
