#!/bin/bash
# Generate app icons from SVG
# Requires: brew install imagemagick librsvg

cd "$(dirname "$0")/../assets"

# Check for required tools
if ! command -v rsvg-convert &> /dev/null; then
    echo "Installing librsvg..."
    brew install librsvg
fi

if ! command -v convert &> /dev/null; then
    echo "Installing imagemagick..."
    brew install imagemagick
fi

echo "Generating icons from icon.svg..."

# Main app icon (1024x1024)
rsvg-convert -w 1024 -h 1024 icon.svg > icon.png
echo "✅ Created icon.png (1024x1024)"

# Adaptive icon foreground (432x432, will be cropped to safe zone)
rsvg-convert -w 432 -h 432 icon.svg > adaptive-icon.png
echo "✅ Created adaptive-icon.png (432x432)"

# Splash icon
rsvg-convert -w 200 -h 200 icon.svg > splash-icon.png
echo "✅ Created splash-icon.png (200x200)"

# Favicon
rsvg-convert -w 48 -h 48 icon.svg > favicon.png
echo "✅ Created favicon.png (48x48)"

echo ""
echo "🎉 All icons generated!"
echo ""
echo "Next steps:"
echo "1. Run: cd mobile && eas login"
echo "2. Run: eas build:configure"
echo "3. Run: eas build --platform android --profile production"
