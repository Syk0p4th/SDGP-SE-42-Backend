#!/bin/bash

# Rollback Firebase Functions Deployment
# This script rolls back to the previous version

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ID="${FIREBASE_PROJECT_ID:-washxpress-19b94}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Firebase Functions Rollback${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Set Firebase project
firebase use "$PROJECT_ID"

# List recent deployments
echo -e "${YELLOW}Recent deployments:${NC}"
firebase functions:log --limit 5

echo ""
read -p "Are you sure you want to rollback? This will redeploy the previous version. (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Rolling back...${NC}"
    
    # Note: Firebase doesn't have a built-in rollback command
    # You need to checkout the previous commit and redeploy
    echo -e "${YELLOW}Please use one of these methods:${NC}"
    echo "1. Checkout previous git commit and run ./scripts/deploy.sh"
    echo "2. Manually redeploy from Firebase Console"
    echo ""
    echo "To rollback using git:"
    echo "  git log --oneline  # Find the commit to rollback to"
    echo "  git checkout <commit-hash>"
    echo "  ./scripts/deploy.sh"
    echo "  git checkout main  # Return to main branch"
    
else
    echo -e "${GREEN}Rollback cancelled${NC}"
fi
