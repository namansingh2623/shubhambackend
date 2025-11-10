#!/bin/bash
# Script to check which IAM user you're using
# Make sure AWS CLI is installed and configured

echo "Checking IAM user from your .env file..."
echo ""

# Read from .env file (if it exists)
if [ -f .env ]; then
    source .env
    echo "Access Key ID (first 8 chars): ${S3_ACCESS_ID:0:8}..."
    echo ""
    echo "To find the full user, you can:"
    echo "1. Go to AWS Console → IAM → Users"
    echo "2. Click on each user → Security credentials tab"
    echo "3. Find the Access key that matches: ${S3_ACCESS_ID:0:8}..."
    echo ""
    echo "Or use AWS CLI (if configured):"
    echo "aws iam list-access-keys --user-name YOUR_USER_NAME"
else
    echo ".env file not found. Please check your environment variables."
fi

