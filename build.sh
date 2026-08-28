#!/bin/bash
set -e

echo "Installing Python packages..."
python3 -m pip install --upgrade pip
python3 -m pip install python-docx

echo "Installing Node packages..."
npm install

echo "Installing functions packages..."
cd functions
npm install
cd ..

echo "Build complete!"
