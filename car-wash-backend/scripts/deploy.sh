#!/bin/bash

# Firebase Functions Deployment Script
# This script handles deployment with validation and error handling

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${FIREBASE_PROJECT_ID:-car-wash-app}"
ENVIRONMENT="${DEPLOY_ENV:-production}"
FUNCTIONS_DIR="./functions"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Firebase Functions Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Project ID: $PROJECT_ID"
echo "Environment: $ENVIRONMENT"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Error: Firebase CLI is not installed${NC}"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo -e "${YELLOW}You are not logged in to Firebase${NC}"
    echo "Running: firebase login"
    firebase login
fi

# Navigate to functions directory
cd "$FUNCTIONS_DIR" || exit 1

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm ci

# Run linter
echo -e "${YELLOW}Running linter...${NC}"
if ! npm run lint; then
    echo -e "${RED}Linting failed! Please fix linting errors before deploying.${NC}"
    exit 1
fi

# Run tests
echo -e "${YELLOW}Running tests...${NC}"
if ! npm test; then
    echo -e "${RED}Tests failed! Please fix failing tests before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-deployment checks passed${NC}"
echo ""

# Go back to project root
cd ..

# Set Firebase project
echo -e "${YELLOW}Setting Firebase project...${NC}"
firebase use "$PROJECT_ID"

# Deploy functions
echo -e "${YELLOW}Deploying functions...${NC}"
if firebase deploy --only functions; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Functions deployed to: https://us-central1-$PROJECT_ID.cloudfunctions.net"
    
    # List deployed functions
    echo ""
    echo -e "${YELLOW}Deployed functions:${NC}"
    firebase functions:list
    
    exit 0
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ Deployment failed!${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
