#!/bin/bash

# TripAgent - Restart iOS App Script
# Runs independently (not parallel with Android)
#   API: port 3001 | Metro: port 8081
# Usage: ./restart-ios.sh [device_name] [--fresh]
#   --fresh: Uninstall app from simulator for completely fresh start

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"
SIMCTL="/Applications/Xcode.app/Contents/Developer/usr/bin/simctl"
APP_BUNDLE_ID="com.tripagent.app"
PID_FILE="/tmp/tripagent-ios.pids"
API_LOG="/tmp/tripagent-ios-api.log"
EXPO_LOG="/tmp/tripagent-ios-expo.log"
API_PORT=3001
METRO_PORT=8081

# Get local IP for Expo URL
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")

# Parse arguments
DEVICE="iPhone 15 Pro Max"
FRESH_INSTALL=false

for arg in "$@"; do
    if [ "$arg" == "--fresh" ]; then
        FRESH_INSTALL=true
    elif [ "$arg" != "--fresh" ]; then
        DEVICE="$arg"
    fi
done

echo "🔄 Restarting TripAgent (iOS)..."
echo "=============================="
echo "   API port: $API_PORT | Metro port: $METRO_PORT"
if [ "$FRESH_INSTALL" = true ]; then
    echo "🆕 Fresh install mode enabled"
fi

# Stop only our own previous processes via PID file
stop_own_processes() {
    if [ -f "$PID_FILE" ]; then
        while IFS= read -r pid; do
            kill "$pid" 2>/dev/null || true
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    # Also free our specific ports in case PIDs are stale
    lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$METRO_PORT | xargs kill -9 2>/dev/null || true
}

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down iOS..."
    stop_own_processes
    exit 0
}
trap cleanup SIGINT SIGTERM

# Stop previous iOS session
echo "🛑 Stopping previous iOS session..."
stop_own_processes
sleep 1

echo ""
echo "📱 Using simulator: $DEVICE"

# Check if Xcode is available
if [ ! -f "$SIMCTL" ]; then
    echo "❌ Xcode simctl not found at $SIMCTL"
    echo "   Please install Xcode from the App Store"
    exit 1
fi

# Boot the specified simulator (don't shutdown all - Android might be running)
echo ""
echo "📱 Booting $DEVICE..."
# Shutdown only iOS simulators that are already booted, not Android
$SIMCTL shutdown "$DEVICE" 2>/dev/null || true
$SIMCTL boot "$DEVICE" 2>/dev/null || {
    echo "⚠️  Could not boot '$DEVICE'. Available devices:"
    $SIMCTL list devices available | grep -E "iPhone|iPad"
    exit 1
}

# Open Simulator app
echo "📱 Opening Simulator..."
open -a Simulator

# Wait for simulator to be ready
echo "   Waiting for simulator to boot..."
for i in {1..30}; do
    if $SIMCTL list devices | grep "$DEVICE" | grep -q "Booted"; then
        echo "✅ Simulator booted"
        break
    fi
    sleep 1
done

# Fresh install: uninstall app from simulator
if [ "$FRESH_INSTALL" = true ]; then
    echo ""
    echo "🗑️  Uninstalling app from simulator..."
    $SIMCTL uninstall booted "$APP_BUNDLE_ID" 2>/dev/null || true
    echo "✅ App uninstalled (if it existed)"
fi

# Clear local metro cache
echo ""
echo "🧹 Clearing Metro bundler cache..."
cd "$MOBILE_DIR"
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .expo 2>/dev/null || true

# Start API server on dedicated port
echo ""
echo "📡 Starting API server on port $API_PORT..."
cd "$PROJECT_ROOT"
PORT=$API_PORT npx tsx src/api/server.ts > "$API_LOG" 2>&1 &
API_PID=$!
echo "$API_PID" > "$PID_FILE"
echo "   API PID: $API_PID"
echo "   Log: $API_LOG"

# Wait for API to be ready
echo "   Waiting for API..."
for i in {1..15}; do
    if curl -s "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
        echo "✅ API running at http://localhost:$API_PORT"
        break
    fi
    sleep 1
done

# Verify API is actually running
if ! curl -s "http://localhost:$API_PORT/health" > /dev/null 2>&1; then
    echo "❌ API failed to start. Check $API_LOG"
    tail -20 "$API_LOG"
    exit 1
fi

# Start Expo with dedicated Metro port and iOS flag
echo ""
echo "📱 Starting Expo (Metro port $METRO_PORT)..."
cd "$MOBILE_DIR"

# Set API URL in .env.development for iOS simulator (localhost works directly)
echo "# Development environment variables" > .env.development
echo "EXPO_PUBLIC_API_URL=http://localhost:$API_PORT" >> .env.development
echo "   API URL set to: http://localhost:$API_PORT"

npx expo start --port $METRO_PORT --clear --ios > "$EXPO_LOG" 2>&1 &
EXPO_PID=$!
echo "$EXPO_PID" >> "$PID_FILE"
echo "   Expo PID: $EXPO_PID"
echo "   Log: $EXPO_LOG"

# Wait for Metro bundler to be ready
echo "   Waiting for Metro bundler..."
for i in {1..45}; do
    if grep -q "Logs for your project" "$EXPO_LOG" 2>/dev/null || \
       grep -q "Metro waiting" "$EXPO_LOG" 2>/dev/null || \
       grep -q "Starting Metro Bundler" "$EXPO_LOG" 2>/dev/null; then
        echo "✅ Metro bundler ready"
        break
    fi
    sleep 1
done

# Wait for bundle to complete (app launching on simulator)
echo "🚀 Waiting for app to launch..."
for i in {1..90}; do
    if grep -q "Bundled" "$EXPO_LOG" 2>/dev/null || \
       grep -q "Opening on iOS" "$EXPO_LOG" 2>/dev/null || \
       grep -q "iOS Bundled" "$EXPO_LOG" 2>/dev/null; then
        echo "✅ App launched!"
        break
    fi
    sleep 1
done

echo ""
echo "=============================="
echo "✅ TripAgent is running on iOS!"
echo ""
echo "📱 Check the simulator for the app"
echo "📡 API: http://localhost:$API_PORT"
echo "� Metro: http://localhost:$METRO_PORT"
echo "🌐 Local IP: $LOCAL_IP"
echo ""
echo "� Logs:"
echo "   API:   tail -f $API_LOG"
echo "   Expo:  tail -f $EXPO_LOG"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running and tail expo logs
tail -f "$EXPO_LOG"
