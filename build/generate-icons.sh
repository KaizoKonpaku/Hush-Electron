#!/bin/bash

# Generate icon assets for macOS
echo "Generating icon assets for macOS..."

# Step 1: Convert SVG to PNG
echo "Converting SVG to PNG..."
node build/create-png.js

# Step 2: Create ICNS file (macOS icon format)
echo "Creating ICNS file..."
chmod +x build/create-icns.sh
./build/create-icns.sh

echo "Icon generation complete. Icon files created:"
echo "- build/icon.png (1024x1024)"
echo "- build/icon.icns (macOS format)" 