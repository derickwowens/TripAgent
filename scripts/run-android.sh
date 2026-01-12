#!/bin/bash

# Travel Buddy - Android Emulator Launch Script
# This script starts the API server and launches the app on Android emulator

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_DIR="$PROJECT_ROOT/mobile"

echo "🚀 Travel Buddy Android Launch Script"
echo "======================================"

# Check if Android emulator is running
check_emulator() {
    if command -v adb &> /dev/null; then
        DEVICES=$(adb devices | grep -v "List" | grep -v "^$" | wc -l)
        if [ "$DEVICES" -eq 0 ]; then
            echo "⚠️  No Android device/emulator detected"
            echo ""
            echo "To start an emulator:"
            echo "  1. Open Android Studio"
            echo "  2. Tools > Device Manager"
            echo "  3. Click play on a virtual device"
            echo ""
            echo "Or run: emulator -avd <avd_name>"
            echo ""
            read -p "Continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            echo "✅ Android device detected"
        fi
    else
        echo "⚠️  ADB not found. Make sure Android SDK is installed."
    fi
}

# Start API server in background
start_api() {
    echo ""
    echo "📡 Starting API server..."
    cd "$PROJECT_ROOT"
    
    # Kill existing API server if running
    pkill -f "tsx src/api/server.ts" 2>/dev/null || true
    
    # Start API in background
    npm run api &
    API_PID=$!
    echo "   API PID: $API_PID"
    
    # Wait for API to be ready
    echo "   Waiting for API to start..."
    sleep 3
    
    # Check if API is running
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ API running at http://localhost:3000"
    else
        echo "⚠️  API may not be ready yet, continuing..."
    fi
}

# Start Expo and launch on Android
start_expo() {
    echo ""
    echo "📱 Starting Expo and launching on Android..."
    cd "$MOBILE_DIR"
    
    # Start Expo with Android flag
    npx expo start --android
}

# Cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    pkill -f "tsx src/api/server.ts" 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Main
echo ""
check_emulator
start_api
start_expo
