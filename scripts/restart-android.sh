#!/bin/bash

# TripAgent - Restart Android App Script
# Uses dedicated ports so it can run in parallel with restart-ios.sh
#   API: port 3001 | Metro: port 8081

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"
PID_FILE="/tmp/tripagent-android.pids"
API_LOG="/tmp/tripagent-android-api.log"
EXPO_LOG="/tmp/tripagent-android-expo.log"
API_PORT=3001
METRO_PORT=8081

# Set Android SDK path
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

# Get local IP for Expo URL
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")

echo "🔄 Restarting TripAgent (Android)..."
echo "=============================="
echo "   API port: $API_PORT | Metro port: $METRO_PORT"

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
    echo "🛑 Shutting down Android..."
    stop_own_processes
    exit 0
}
trap cleanup SIGINT SIGTERM

# Stop previous Android session
echo "🛑 Stopping previous Android session..."
stop_own_processes
sleep 1

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

# Start Expo with dedicated Metro port and API URL
echo ""
echo "📱 Starting Expo (Metro port $METRO_PORT)..."
cd "$MOBILE_DIR"

EXPO_PUBLIC_API_URL="http://$LOCAL_IP:$API_PORT" npx expo start --port $METRO_PORT --clear > "$EXPO_LOG" 2>&1 &
EXPO_PID=$!
echo "$EXPO_PID" >> "$PID_FILE"
echo "   Expo PID: $EXPO_PID"
echo "   Log: $EXPO_LOG"

# Wait for Metro bundler to be ready
echo "   Waiting for Metro bundler..."
for i in {1..30}; do
    if grep -q "Logs for your project" "$EXPO_LOG" 2>/dev/null || \
       grep -q "Metro waiting" "$EXPO_LOG" 2>/dev/null || \
       grep -q "Starting Metro Bundler" "$EXPO_LOG" 2>/dev/null; then
        echo "✅ Metro bundler ready"
        break
    fi
    sleep 1
done

sleep 2

# Launch on Android emulator
echo ""
echo "🚀 Launching app on emulator..."
adb shell am start -a android.intent.action.VIEW -d "exp://$LOCAL_IP:$METRO_PORT" 2>/dev/null

# Wait for bundle to complete
echo "   Waiting for bundle to complete..."
for i in {1..60}; do
    if grep -q "Bundled" "$EXPO_LOG" 2>/dev/null; then
        echo "✅ Bundle complete!"
        break
    fi
    sleep 1
done

echo ""
echo "=============================="
echo "✅ TripAgent is running on Android!"
echo ""
echo "📱 Check the emulator for the app"
echo "📡 API: http://localhost:$API_PORT"
echo "📱 Metro: http://localhost:$METRO_PORT"
echo "🌐 Local IP: $LOCAL_IP"
echo ""
echo "📋 Logs:"
echo "   API:   tail -f $API_LOG"
echo "   Expo:  tail -f $EXPO_LOG"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Keep script running and tail expo logs
tail -f "$EXPO_LOG"
