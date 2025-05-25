#!/bin/bash

# Create temporary iconset directory
mkdir -p build/icon.iconset

# Convert PNG to multiple sizes with high quality
for size in 16 32 64 128 256 512; do
  # Use higher quality scaling with sips
  sips -s format png --resampleHeightWidth $size $size build/icon.png --out build/icon.iconset/icon_${size}x${size}.png
  
  # Create retina versions (@2x)
  sips -s format png --resampleHeightWidth $((size*2)) $((size*2)) build/icon.png --out build/icon.iconset/icon_${size}x${size}@2x.png
done

# Add the 1024x1024 icon (no @2x needed for this size)
cp build/icon.png build/icon.iconset/icon_512x512@2x.png

# Create icns file
iconutil -c icns build/icon.iconset

# Cleanup
rm -rf build/icon.iconset 