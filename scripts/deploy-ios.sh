#!/bin/bash
# TripAgent - iOS Deployment Script
# Usage: ./scripts/deploy-ios.sh [major|minor|hotfix] [--rc] [--validate-links]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
BUMP_TYPE=""
RC_BUILD=false
VALIDATE_LINKS=false

for arg in "$@"; do
    case $arg in
        --rc)
            RC_BUILD=true
            ;;
        --validate-links)
            VALIDATE_LINKS=true
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
    echo "Usage: ./scripts/deploy-ios.sh [major|minor|hotfix] [--rc] [--validate-links]"
    echo "  major           - Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor           - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  hotfix          - Bump patch version (1.0.0 -> 1.0.1)"
    echo "  --rc            - Build as Release Candidate for closed testing"
    echo "  --validate-links - Run NPS link validation before build (requires NPS_API_KEY)"
    exit 1
fi

echo -e "${GREEN}🍎 TripAgent iOS Deployment${NC}"
echo "=================================="
echo -e "Bump type: ${YELLOW}$BUMP_TYPE${NC}"
if [ "$RC_BUILD" = true ]; then
    echo -e "Build type: ${YELLOW}Release Candidate (closed testing)${NC}"
    BUILD_PROFILE="closed"
else
    echo -e "Build type: ${YELLOW}Production${NC}"
    BUILD_PROFILE="production"
fi
if [ "$VALIDATE_LINKS" = true ]; then
    echo -e "Link validation: ${YELLOW}Enabled${NC}"
fi
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

# Run link validation if requested
if [ "$VALIDATE_LINKS" = true ]; then
    echo -e "\n${GREEN}🔗 Running NPS Link Validation...${NC}"
    if [ -z "$NPS_API_KEY" ]; then
        echo -e "${RED}Error: NPS_API_KEY environment variable is required for link validation${NC}"
        echo "Get a free API key at: https://www.nps.gov/subjects/developer/get-started.htm"
        exit 1
    fi
    npm run validate-links
    echo -e "${GREEN}✅ Link validation complete${NC}\n"
fi

# Read current version from app.config.js
CURRENT_VERSION=$(grep 'version:' mobile/app.config.js | head -1 | sed 's/.*version: "\([^"]*\)".*/\1/')
CURRENT_BUILD_NUMBER=$(grep 'buildNumber:' mobile/app.config.js | head -1 | sed 's/.*buildNumber: "\([^"]*\)".*/\1/')

echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC} (buildNumber: $CURRENT_BUILD_NUMBER)"

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

# Always increment buildNumber
NEW_BUILD_NUMBER=$((CURRENT_BUILD_NUMBER + 1))

echo -e "New version: ${GREEN}$NEW_VERSION${NC} (buildNumber: $NEW_BUILD_NUMBER)"
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
sed -i '' "s/buildNumber: \"$CURRENT_BUILD_NUMBER\"/buildNumber: \"$NEW_BUILD_NUMBER\"/" mobile/app.config.js

# Update app.json
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" mobile/app.json
sed -i '' "s/\"buildNumber\": \"$CURRENT_BUILD_NUMBER\"/\"buildNumber\": \"$NEW_BUILD_NUMBER\"/" mobile/app.json

echo -e "${GREEN}✅ Version files updated${NC}"

# Git commit and push
echo ""
echo -e "${YELLOW}📤 Committing and pushing changes...${NC}"
git add -A
git commit -m "Bump iOS version to $NEW_VERSION (buildNumber: $NEW_BUILD_NUMBER)"
git push origin main

echo -e "${GREEN}✅ Changes pushed to GitHub${NC}"

# Start EAS build
echo ""
echo -e "${YELLOW}🏗️  Starting EAS Build...${NC}"
echo "This may take 10-15 minutes on the free tier."
echo ""

cd mobile
eas build --platform ios --profile $BUILD_PROFILE

echo ""
echo -e "${GREEN}🎉 iOS Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Build will be automatically submitted to App Store Connect"
echo "2. Go to https://appstoreconnect.apple.com"
echo "3. Select Adventure Agent"
echo "4. Submit for TestFlight or App Store review"
