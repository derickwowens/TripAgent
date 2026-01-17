#!/bin/bash
# TripAgent - Unified Deployment Script (Android + iOS)
# Usage: ./scripts/deploy-all.sh [major|minor|hotfix] [--rc] [--android-only|--ios-only]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
BUMP_TYPE=""
RC_BUILD=false
ANDROID_ONLY=false
IOS_ONLY=false

for arg in "$@"; do
    case $arg in
        --rc)
            RC_BUILD=true
            ;;
        --android-only)
            ANDROID_ONLY=true
            ;;
        --ios-only)
            IOS_ONLY=true
            ;;
        major|minor|hotfix)
            BUMP_TYPE=$arg
            ;;
    esac
done

# Default to minor if not specified
BUMP_TYPE=${BUMP_TYPE:-minor}

if [[ ! "$BUMP_TYPE" =~ ^(major|minor|hotfix)$ ]]; then
    echo -e "${RED}Error: Invalid bump type '$BUMP_TYPE'${NC}"
    echo "Usage: ./scripts/deploy-all.sh [major|minor|hotfix] [--rc] [--android-only|--ios-only]"
    echo "  major         - Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor         - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  hotfix        - Bump patch version (1.0.0 -> 1.0.1)"
    echo "  --rc          - Build as Release Candidate for closed testing"
    echo "  --android-only - Deploy only to Android"
    echo "  --ios-only    - Deploy only to iOS"
    exit 1
fi

# Determine which platforms to deploy
DEPLOY_ANDROID=true
DEPLOY_IOS=true

if [ "$ANDROID_ONLY" = true ]; then
    DEPLOY_IOS=false
fi

if [ "$IOS_ONLY" = true ]; then
    DEPLOY_ANDROID=false
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   TripAgent Multi-Platform Deploy     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "Bump type: ${YELLOW}$BUMP_TYPE${NC}"
if [ "$RC_BUILD" = true ]; then
    echo -e "Build type: ${YELLOW}Release Candidate (closed testing)${NC}"
    BUILD_PROFILE="closed"
else
    echo -e "Build type: ${YELLOW}Production${NC}"
    BUILD_PROFILE="production"
fi
echo ""
echo -e "Platforms:"
if [ "$DEPLOY_ANDROID" = true ]; then
    echo -e "  ${GREEN}✓${NC} Android"
fi
if [ "$DEPLOY_IOS" = true ]; then
    echo -e "  ${GREEN}✓${NC} iOS"
fi
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Read current version from app.config.js
CURRENT_VERSION=$(grep 'version:' mobile/app.config.js | head -1 | sed 's/.*version: "\([^"]*\)".*/\1/')
CURRENT_VERSION_CODE=$(grep 'versionCode:' mobile/app.config.js | head -1 | sed 's/.*versionCode: \([0-9]*\).*/\1/')
CURRENT_BUILD_NUMBER=$(grep 'buildNumber:' mobile/app.config.js | head -1 | sed 's/.*buildNumber: "\([^"]*\)".*/\1/' || echo "1")

echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"
echo -e "  Android versionCode: $CURRENT_VERSION_CODE"
echo -e "  iOS buildNumber: $CURRENT_BUILD_NUMBER"

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Calculate new version
case $BUMP_TYPE in
    major)
        NEW_MAJOR=$((MAJOR + 1))
        NEW_VERSION="$NEW_MAJOR.0.0"
        ;;
    minor)
        NEW_MINOR=$((MINOR + 1))
        NEW_VERSION="$MAJOR.$NEW_MINOR.0"
        ;;
    hotfix)
        NEW_PATCH=$((PATCH + 1))
        NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
        ;;
esac

# Always increment version codes
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
NEW_BUILD_NUMBER=$((CURRENT_BUILD_NUMBER + 1))

echo ""
echo -e "New version: ${GREEN}$NEW_VERSION${NC}"
echo -e "  Android versionCode: $NEW_VERSION_CODE"
echo -e "  iOS buildNumber: $NEW_BUILD_NUMBER"
echo ""

# Confirm with user
read -p "Proceed with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deployment cancelled${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📝 Updating version files...${NC}"

# Update app.config.js
sed -i '' "s/version: \"$CURRENT_VERSION\"/version: \"$NEW_VERSION\"/" mobile/app.config.js
sed -i '' "s/versionCode: $CURRENT_VERSION_CODE/versionCode: $NEW_VERSION_CODE/" mobile/app.config.js
if grep -q "buildNumber:" mobile/app.config.js; then
    sed -i '' "s/buildNumber: \"$CURRENT_BUILD_NUMBER\"/buildNumber: \"$NEW_BUILD_NUMBER\"/" mobile/app.config.js
else
    # Add buildNumber if it doesn't exist
    sed -i '' "/versionCode: $NEW_VERSION_CODE/a\\
      buildNumber: \"$NEW_BUILD_NUMBER\",
" mobile/app.config.js
fi

# Update app.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" mobile/app.json
sed -i '' "s/\"versionCode\": $CURRENT_VERSION_CODE/\"versionCode\": $NEW_VERSION_CODE/" mobile/app.json
if grep -q "\"buildNumber\":" mobile/app.json; then
    sed -i '' "s/\"buildNumber\": \"$CURRENT_BUILD_NUMBER\"/\"buildNumber\": \"$NEW_BUILD_NUMBER\"/" mobile/app.json
else
    # Add buildNumber to iOS section if it doesn't exist
    sed -i '' "/\"bundleIdentifier\":/a\\
      \"buildNumber\": \"$NEW_BUILD_NUMBER\",
" mobile/app.json
fi

echo -e "${GREEN}✅ Version files updated${NC}"

# Git commit and push
echo ""
echo -e "${YELLOW}📤 Committing and pushing changes...${NC}"
git add -A
git commit -m "Bump version to $NEW_VERSION (Android: $NEW_VERSION_CODE, iOS: $NEW_BUILD_NUMBER)"
git push origin main

echo -e "${GREEN}✅ Changes pushed to GitHub${NC}"

# Deploy to platforms
cd mobile

if [ "$DEPLOY_ANDROID" = true ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════${NC}"
    echo -e "${GREEN}   🤖 Building Android...${NC}"
    echo -e "${GREEN}═══════════════════════════════════${NC}"
    echo ""
    eas build --platform android --profile $BUILD_PROFILE --non-interactive
fi

if [ "$DEPLOY_IOS" = true ]; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════${NC}"
    echo -e "${GREEN}   🍎 Building iOS...${NC}"
    echo -e "${GREEN}═══════════════════════════════════${NC}"
    echo ""
    eas build --platform ios --profile $BUILD_PROFILE --non-interactive
fi

echo ""
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🎉 Deployment Complete!             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
if [ "$DEPLOY_ANDROID" = true ]; then
    echo -e "${GREEN}Android:${NC}"
    echo "  1. Download AAB from EAS build URL"
    echo "  2. Upload to Google Play Console"
    echo "  3. Roll out to testers/production"
    echo ""
fi
if [ "$DEPLOY_IOS" = true ]; then
    echo -e "${GREEN}iOS:${NC}"
    echo "  1. Go to https://appstoreconnect.apple.com"
    echo "  2. Select Adventure Agent"
    echo "  3. Submit for TestFlight or App Store review"
fi
