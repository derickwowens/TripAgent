#!/bin/bash

# TripAgent - Restart Android App Script
# Comprehensive restart with cache clearing and proper initialization

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"

# Set Android SDK path
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

echo "🔄 Restarting TripAgent..."
echo "=============================="

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
sleep 2

# Check emulator
echo ""
echo "📱 Checking emulator..."
if adb devices 2>/dev/null | grep -q "emulator"; then
    echo "✅ Emulator detected"
    EMULATOR_NAME=$(adb devices | grep emulator | cut -f1)
    echo "   Device: $EMULATOR_NAME"
else
    echo "⚠️  No emulator found. Please start one from Android Studio."
    echo "   Open Android Studio > Tools > Device Manager > Play button"
    exit 1
fi

# Clear Expo Go app data on emulator
echo ""
echo "🧹 Clearing Expo Go cache on emulator..."
adb shell pm clear host.exp.exponent 2>/dev/null || echo "   (Expo Go not installed yet, skipping)"

# Clear local metro cache
echo "🧹 Clearing Metro bundler cache..."
cd "$MOBILE_DIR"
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .expo 2>/dev/null || true

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

# Start Expo with clear cache
echo ""
echo "📱 Starting Expo..."
cd "$MOBILE_DIR"

# Start Expo in background and capture output
npx expo start --clear > /tmp/tripagent-expo.log 2>&1 &
EXPO_PID=$!
echo "   Expo PID: $EXPO_PID"
echo "   Log: /tmp/tripagent-expo.log"

# Wait for Metro bundler to be ready
echo "   Waiting for Metro bundler..."
for i in {1..30}; do
    if grep -q "Metro waiting" /tmp/tripagent-expo.log 2>/dev/null; then
        echo "✅ Metro bundler ready"
        break
    fi
    sleep 1
done

# Wait a bit more for full initialization
sleep 3

# Force open on Android emulator
echo ""
echo "🚀 Launching app on emulator..."
adb shell am start -a android.intent.action.VIEW -d "exp://192.168.1.109:8081" 2>/dev/null

# Wait for bundle to complete
echo "   Waiting for bundle to complete..."
for i in {1..60}; do
    if grep -q "Bundled" /tmp/tripagent-expo.log 2>/dev/null; then
        echo "✅ Bundle complete!"
        break
    fi
    sleep 1
done

echo ""
echo "=============================="
echo "✅ TripAgent is running!"
echo ""
echo "📱 Check the emulator for the app"
echo "📡 API: http://localhost:3000"
echo ""
echo "📋 Logs:"
echo "   API:   tail -f /tmp/tripagent-api.log"
echo "   Expo:  tail -f /tmp/tripagent-expo.log"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running and tail expo logs
tail -f /tmp/tripagent-expo.log
