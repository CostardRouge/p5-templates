#!/bin/bash

# Setup script for push notification VAPID keys
# Run this script to generate and configure VAPID keys for your NAS deployment

set -e

echo "🔔 Push Notification Setup Script"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
  echo "📝 Creating .env file from .env.example..."
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ .env file created"
  else
    echo "❌ .env.example not found. Creating minimal .env file..."
    touch .env
  fi
  echo ""
fi

# Check if VAPID keys already exist
if grep -q "^NEXT_PUBLIC_VAPID_PUBLIC_KEY=" .env && grep -q "^VAPID_PRIVATE_KEY=" .env; then
  echo "ℹ️  VAPID keys already exist in .env file"
  echo ""
  read -p "Do you want to regenerate them? (y/N): " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Keeping existing keys. Exiting..."
    exit 0
  fi
fi

# Generate keys using Node.js
echo "🔑 Generating VAPID keys..."
node scripts/generate-vapid-keys.mjs

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps for NAS deployment:"
echo "   1. Copy your .env file to your NAS"
echo "   2. Or add the keys to your docker-compose.yml environment section"
echo "   3. Restart your Docker containers: docker-compose up -d --build"
echo ""
