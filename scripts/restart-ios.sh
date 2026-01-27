#!/bin/bash

# TripAgent - Restart iOS App Script
# Comprehensive restart with cache clearing and proper initialization
# Usage: ./restart-ios.sh [device_name] [--fresh]
#   --fresh: Uninstall app from simulator for completely fresh start

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"
SIMCTL="/Applications/Xcode.app/Contents/Developer/usr/bin/simctl"
APP_BUNDLE_ID="com.tripagent.app"

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
if [ "$FRESH_INSTALL" = true ]; then
    echo "🆕 Fresh install mode enabled"
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    pkill -f "tsx src/api/server.ts" 2>/dev/null || true
    pkill -f "expo start" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

# Kill existing processes
echo "🛑 Stopping existing processes..."
pkill -f "tsx src/api/server.ts" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true
pkill -f "@expo/metro-runtime" 2>/dev/null || true
pkill -f "node.*metro" 2>/dev/null || true
pkill -f "react-native" 2>/dev/null || true

# Kill ports (including common Expo ports)
echo "🔌 Freeing up ports..."
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
lsof -ti:8082 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:19000 | xargs kill -9 2>/dev/null || true
lsof -ti:19001 | xargs kill -9 2>/dev/null || true
sleep 2

echo ""
echo "📱 Using simulator: $DEVICE"

# Check if Xcode is available
if [ ! -f "$SIMCTL" ]; then
    echo "❌ Xcode simctl not found at $SIMCTL"
    echo "   Please install Xcode from the App Store"
    exit 1
fi

# Shutdown all running simulators
echo ""
echo "📱 Shutting down running simulators..."
$SIMCTL shutdown all 2>/dev/null || true

# Boot the specified simulator
echo "📱 Booting $DEVICE..."
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

# Clear local metro cache (thorough)
echo ""
echo "🧹 Clearing Metro bundler cache..."
cd "$MOBILE_DIR"
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .expo 2>/dev/null || true
rm -rf "$TMPDIR/metro-*" 2>/dev/null || true
rm -rf "$TMPDIR/haste-map-*" 2>/dev/null || true
rm -rf "$TMPDIR/react-*" 2>/dev/null || true
rm -rf "$TMPDIR/expo-*" 2>/dev/null || true
rm -rf "$TMPDIR/hermes-*" 2>/dev/null || true

# Clear watchman
echo "🧹 Clearing Watchman cache..."
watchman watch-del-all 2>/dev/null || true

# Clear React Native cache
echo "🧹 Clearing React Native cache..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*TripAgent* 2>/dev/null || true
rm -rf ~/Library/Caches/com.facebook.ReactNativeBuild 2>/dev/null || true

# Start API server
echo ""
echo "📡 Starting API server..."
cd "$PROJECT_ROOT"
npm run api > /tmp/tripagent-api.log 2>&1 &
API_PID=$!
echo "   API PID: $API_PID"
echo "   Log: /tmp/tripagent-api.log"

# Wait for API to be ready
echo "   Waiting for API..."
for i in {1..10}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ API running at http://localhost:3000"
        break
    fi
    sleep 1
done

# Verify API is actually running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "❌ API failed to start. Check /tmp/tripagent-api.log"
    cat /tmp/tripagent-api.log | tail -20
    exit 1
fi

# Start Expo with clear cache and launch on iOS directly
echo ""
echo "📱 Starting Expo and launching on iOS simulator..."
cd "$MOBILE_DIR"

# Use --ios flag to automatically launch on simulator after bundler is ready
# The --clear flag ensures fresh cache
npx expo start --clear --ios 2>&1 | tee /tmp/tripagent-expo.log &
EXPO_PID=$!
echo "   Expo PID: $EXPO_PID"
echo "   Log: /tmp/tripagent-expo.log"

# Wait for Metro bundler to be ready
echo "   Waiting for Metro bundler..."
METRO_READY=false
for i in {1..45}; do
    if grep -q "Metro waiting" /tmp/tripagent-expo.log 2>/dev/null || \
       grep -q "Starting Metro Bundler" /tmp/tripagent-expo.log 2>/dev/null || \
       grep -q "Logs for your project" /tmp/tripagent-expo.log 2>/dev/null; then
        echo "✅ Metro bundler ready"
        METRO_READY=true
        break
    fi
    sleep 1
done

if [ "$METRO_READY" = false ]; then
    echo "⚠️  Metro bundler may not have started properly"
    echo "   Check /tmp/tripagent-expo.log for details"
fi

# Wait for bundle to complete (app launching on simulator)
echo "🚀 Waiting for app to launch..."
for i in {1..90}; do
    if grep -q "Bundled" /tmp/tripagent-expo.log 2>/dev/null || \
       grep -q "Opening on iOS" /tmp/tripagent-expo.log 2>/dev/null || \
       grep -q "iOS Bundled" /tmp/tripagent-expo.log 2>/dev/null; then
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
echo "📡 API: http://localhost:3000"
echo ""
echo "📋 Logs:"
echo "   API:   tail -f /tmp/tripagent-api.log"
echo "   Expo:  tail -f /tmp/tripagent-expo.log"
echo ""
echo "🔄 Usage examples:"
echo "   ./scripts/restart-ios.sh                           # Default device"
echo "   ./scripts/restart-ios.sh \"iPhone 15 Pro Max\"       # Specific device"
echo "   ./scripts/restart-ios.sh --fresh                   # Fresh install (clears app data)"
echo "   ./scripts/restart-ios.sh \"iPad Pro\" --fresh        # Both options"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running and tail expo logs
tail -f /tmp/tripagent-expo.log
