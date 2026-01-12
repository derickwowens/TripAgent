#!/bin/bash
# TripAgent - Android Deployment Script
# Usage: ./scripts/deploy-android.sh [major|minor|hotfix]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the bump type from argument
BUMP_TYPE=${1:-minor}

if [[ ! "$BUMP_TYPE" =~ ^(major|minor|hotfix)$ ]]; then
    echo -e "${RED}Error: Invalid bump type '$BUMP_TYPE'${NC}"
    echo "Usage: ./scripts/deploy-android.sh [major|minor|hotfix]"
    echo "  major  - Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor  - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  hotfix - Bump patch version (1.0.0 -> 1.0.1)"
    exit 1
fi

echo -e "${GREEN}🚀 TripAgent Android Deployment${NC}"
echo "=================================="
echo -e "Bump type: ${YELLOW}$BUMP_TYPE${NC}"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Read current version from app.config.js
CURRENT_VERSION=$(grep 'version:' mobile/app.config.js | head -1 | sed 's/.*version: "\([^"]*\)".*/\1/')
CURRENT_VERSION_CODE=$(grep 'versionCode:' mobile/app.config.js | head -1 | sed 's/.*versionCode: \([0-9]*\).*/\1/')

echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC} (versionCode: $CURRENT_VERSION_CODE)"

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

# Always increment versionCode
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

echo -e "New version: ${GREEN}$NEW_VERSION${NC} (versionCode: $NEW_VERSION_CODE)"
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

# Update app.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" mobile/app.json
sed -i '' "s/\"versionCode\": $CURRENT_VERSION_CODE/\"versionCode\": $NEW_VERSION_CODE/" mobile/app.json

echo -e "${GREEN}✅ Version files updated${NC}"

# Git commit and push
echo ""
echo -e "${YELLOW}📤 Committing and pushing changes...${NC}"
git add -A
git commit -m "Bump version to $NEW_VERSION (versionCode: $NEW_VERSION_CODE)"
git push origin main

echo -e "${GREEN}✅ Changes pushed to GitHub${NC}"

# Start EAS build
echo ""
echo -e "${YELLOW}🏗️  Starting EAS Build...${NC}"
echo "This may take 10-15 minutes on the free tier."
echo ""

cd mobile
eas build --platform android --profile production

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Download the AAB from the EAS build URL above"
echo "2. Upload to Google Play Console"
echo "3. Roll out to testers"
