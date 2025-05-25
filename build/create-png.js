const fs = require('fs')
const path = require('path')
const svg2img = require('svg2img')

// Read the SVG file
const svgData = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8')

// Convert to PNG with high quality
svg2img(svgData, { 
  width: 1024, 
  height: 1024,
  preserveAspectRatio: true,
  quality: 100 
}, function (error, buffer) {
  if (error) {
    console.error('Error converting SVG to PNG:', error)
    return
  }

  // Write the PNG file
  fs.writeFileSync(path.join(__dirname, 'icon.png'), buffer)
  console.log('Successfully converted SVG to PNG')
})
