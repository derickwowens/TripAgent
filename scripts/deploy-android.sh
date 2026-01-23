#!/bin/bash
# TripAgent - Android Deployment Script
# Usage: ./scripts/deploy-android.sh [major|minor|hotfix] [--rc] [--validate-links]

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
INCREMENT_VERSION=false

for arg in "$@"; do
    case $arg in
        --rc)
            RC_BUILD=true
            ;;
        --validate-links)
            VALIDATE_LINKS=true
            ;;
        -i|--increment)
            INCREMENT_VERSION=true
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
    echo "Usage: ./scripts/deploy-android.sh [major|minor|hotfix] [--rc] [--validate-links] [-i|--increment]"
    echo "  major           - Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor           - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  hotfix          - Bump patch version (1.0.0 -> 1.0.1)"
    echo "  --rc            - Build as Release Candidate for closed testing"
    echo "  --validate-links - Run NPS link validation before build (requires NPS_API_KEY)"
    echo "  -i, --increment - Increment version number (default: keep current version)"
    exit 1
fi

echo -e "${GREEN}🚀 TripAgent Android Deployment${NC}"
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
CURRENT_VERSION_CODE=$(grep 'versionCode:' mobile/app.config.js | head -1 | sed 's/.*versionCode: \([0-9]*\).*/\1/')

echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC} (versionCode: $CURRENT_VERSION_CODE)"

# Strip any existing platform suffix and parse version components
CLEAN_VERSION=$(echo "$CURRENT_VERSION" | sed 's/-ios$//' | sed 's/-android$//')
IFS='.' read -r MAJOR MINOR PATCH <<< "$CLEAN_VERSION"

# Calculate new version based on --increment flag
if [ "$INCREMENT_VERSION" = true ]; then
    case $BUMP_TYPE in
        major)
            NEW_MAJOR=$((MAJOR + 1))
            BASE_VERSION="$NEW_MAJOR.0.0"
            ;;
        minor)
            NEW_MINOR=$((MINOR + 1))
            BASE_VERSION="$MAJOR.$NEW_MINOR.0"
            ;;
        hotfix)
            NEW_PATCH=$((PATCH + 1))
            BASE_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
            ;;
    esac
    # Increment versionCode when incrementing version
    NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))
else
    # Keep current version, don't increment versionCode
    BASE_VERSION="$MAJOR.$MINOR.$PATCH"
    NEW_VERSION_CODE=$CURRENT_VERSION_CODE
fi

# Add Android suffix to differentiate from iOS builds in EAS
NEW_VERSION="${BASE_VERSION}-android"

echo -e "New version: ${GREEN}$NEW_VERSION${NC} (versionCode: $NEW_VERSION_CODE)"
if [ "$INCREMENT_VERSION" = false ]; then
    echo -e "${YELLOW}(Version not incremented - use -i to increment)${NC}"
fi
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
eas build --platform android --profile $BUILD_PROFILE

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Download the AAB from the EAS build URL above"
echo "2. Upload to Google Play Console"
echo "3. Roll out to testers"
