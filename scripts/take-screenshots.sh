#!/bin/bash
# TripAgent - iOS Simulator Screenshot Script
# Takes screenshots using xcrun simctl and saves to versioned directory

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIMCTL="xcrun simctl"

# Get current version from app.json
VERSION=$(node -e "console.log(require('$PROJECT_ROOT/mobile/app.json').expo.version)")
# Detect device type from simulator
DEVICE_TYPE=$($SIMCTL list devices booted | grep -E "iPhone|iPad" | head -1)
if echo "$DEVICE_TYPE" | grep -q "iPad"; then
    OUTPUT_DIR="$PROJECT_ROOT/screenshots/v$VERSION/ipad"
else
    OUTPUT_DIR="$PROJECT_ROOT/screenshots/v$VERSION/iphone"
fi

echo "📸 TripAgent Screenshot Tool"
echo "===================================="
echo "Version: $VERSION"
echo "Output:  $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if simulator is booted
BOOTED_DEVICE=$($SIMCTL list devices booted | grep -E "iPhone|iPad" | head -1 | sed 's/.*(\([^)]*\)).*/\1/' | head -1)

if [ -z "$BOOTED_DEVICE" ]; then
    echo "❌ No simulator is currently running."
    echo "   Start the simulator first with: ./scripts/restart-ios.sh"
    exit 1
fi

echo "📱 Using simulator: $BOOTED_DEVICE"
echo ""

# Screenshot counter
COUNT=1

take_screenshot() {
    local name=$1
    local filename=$(printf "%02d_%s.png" $COUNT "$name")
    local filepath="$OUTPUT_DIR/$filename"
    
    echo "📸 Taking screenshot: $filename"
    $SIMCTL io booted screenshot "$filepath"
    echo "   ✅ Saved to $filepath"
    echo ""
    
    ((COUNT++))
}

echo "Press ENTER to take a screenshot, or type a name for the screenshot."
echo "Type 'done' when finished, 'list' to see taken screenshots."
echo ""

while true; do
    read -p "Screenshot name (or ENTER for auto-name, 'done' to finish): " NAME
    
    if [ "$NAME" = "done" ] || [ "$NAME" = "quit" ] || [ "$NAME" = "exit" ]; then
        break
    fi
    
    if [ "$NAME" = "list" ]; then
        echo ""
        echo "Screenshots taken:"
        ls -la "$OUTPUT_DIR"/*.png 2>/dev/null || echo "  (none yet)"
        echo ""
        continue
    fi
    
    if [ -z "$NAME" ]; then
        NAME="screenshot_$COUNT"
    fi
    
    # Sanitize name
    NAME=$(echo "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_-')
    
    take_screenshot "$NAME"
done

echo ""
echo "===================================="
echo "📸 Screenshots saved to: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR"/*.png 2>/dev/null || echo "  (none taken)"
echo ""
echo "Next steps:"
echo "  1. Run: node mobile/scripts/create-ipad-screenshots.js"
echo "  2. Upload to App Store Connect"
