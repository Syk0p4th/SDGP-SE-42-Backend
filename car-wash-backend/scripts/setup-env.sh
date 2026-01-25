#!/bin/bash

# Setup Firebase Functions Environment Variables
# This script configures environment variables for Firebase Functions

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ID="${FIREBASE_PROJECT_ID:-car-wash-app}"

echo -e "${GREEN}Setting up Firebase Functions environment variables...${NC}"
echo ""

# Check if .env file exists
if [ ! -f "./functions/.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found in functions directory${NC}"
    echo "Creating template .env file..."
    cat > ./functions/.env << EOL
NODE_ENV=production
SENTRY_DSN=your-sentry-dsn-here
SENTRY_RELEASE=car-wash-backend@1.0.0
EOL
    echo -e "${GREEN}Template .env file created. Please update with actual values.${NC}"
fi

# Set Firebase project
firebase use "$PROJECT_ID"

# Read from .env and set config
if [ -f "./functions/.env" ]; then
    # Load environment variables
    export $(cat ./functions/.env | grep -v '^#' | xargs)
    
    echo "Setting Firebase Functions config..."
    
    # Set Sentry DSN
    if [ -n "$SENTRY_DSN" ]; then
        firebase functions:config:set sentry.dsn="$SENTRY_DSN"
        echo -e "${GREEN}✓ Sentry DSN configured${NC}"
    fi
    
    # Set environment
    if [ -n "$NODE_ENV" ]; then
        firebase functions:config:set app.environment="$NODE_ENV"
        echo -e "${GREEN}✓ Environment configured${NC}"
    fi
    
    # Set release version
    if [ -n "$SENTRY_RELEASE" ]; then
        firebase functions:config:set sentry.release="$SENTRY_RELEASE"
        echo -e "${GREEN}✓ Release version configured${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Current Firebase Functions config:${NC}"
firebase functions:config:get

echo ""
echo -e "${GREEN}✓ Environment setup complete!${NC}"
