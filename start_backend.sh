#!/bin/bash
echo "==================================================="
echo "  Starting ChronoRx Tech Backend API Server"
echo "==================================================="
cd backend
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "Installing/verifying dependencies..."
pip install -r requirements.txt
echo "Launching FastAPI server..."
python run.py
