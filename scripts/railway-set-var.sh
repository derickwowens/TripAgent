#!/bin/bash

# Railway Environment Variable Script
# Usage: ./railway-set-var.sh VAR_NAME VAR_VALUE
# Example: ./railway-set-var.sh UNSPLASH_ACCESS_KEY your_key_here

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo ""
    echo "Usage: $0 VAR_NAME VAR_VALUE"
    echo ""
    echo "Examples:"
    echo "  $0 UNSPLASH_ACCESS_KEY your_access_key"
    echo "  $0 ANTHROPIC_API_KEY sk-ant-xxx"
    echo "  $0 NPS_API_KEY your_nps_key"
    exit 1
fi

VAR_NAME="$1"
VAR_VALUE="$2"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Error: Railway CLI not installed${NC}"
    echo ""
    echo "Install with:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Then login with:"
    echo "  railway login"
    exit 1
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}Not logged in to Railway. Running login...${NC}"
    railway login
fi

echo -e "${YELLOW}Setting ${VAR_NAME} on Railway...${NC}"

# Set the variable
railway variables set "${VAR_NAME}=${VAR_VALUE}"

echo -e "${GREEN}✅ Successfully set ${VAR_NAME}${NC}"
echo ""
echo "Railway will automatically redeploy with the new variable."
