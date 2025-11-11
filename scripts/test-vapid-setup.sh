#!/bin/bash

# Test script to verify VAPID key setup for Docker deployment
# This simulates what happens in the Docker container

set -e

echo "🧪 Testing VAPID Key Setup"
echo "============================"
echo ""

# Test 1: Check if script exists and is executable
echo "Test 1: Checking script files..."
if [ -f "scripts/generate-vapid-keys.mjs" ]; then
  echo "✅ generate-vapid-keys.mjs exists"
else
  echo "❌ generate-vapid-keys.mjs not found"
  exit 1
fi

if [ -x "scripts/generate-vapid-keys.mjs" ]; then
  echo "✅ generate-vapid-keys.mjs is executable"
else
  echo "⚠️  generate-vapid-keys.mjs not executable (fixing...)"
  chmod +x scripts/generate-vapid-keys.mjs
fi

# Test 2: Check if web-push is installed
echo ""
echo "Test 2: Checking dependencies..."
if node -e "require('web-push')" 2>/dev/null; then
  echo "✅ web-push module is installed"
else
  echo "❌ web-push module not found"
  echo "   Run: npm install"
  exit 1
fi

# Test 3: Test key generation (without environment)
echo ""
echo "Test 3: Testing key generation logic..."
TEST_OUTPUT=$(node -e "
  const webpush = require('web-push');
  const keys = webpush.generateVAPIDKeys();
  console.log(JSON.stringify(keys));
" 2>&1)

if echo "$TEST_OUTPUT" | grep -q "publicKey"; then
  echo "✅ Key generation works"
  PUBLIC_KEY=$(echo $TEST_OUTPUT | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    console.log(data.publicKey);
  ")
  echo "   Sample public key: ${PUBLIC_KEY:0:20}..."
else
  echo "❌ Key generation failed"
  echo "   Output: $TEST_OUTPUT"
  exit 1
fi

# Test 4: Simulate Docker entrypoint logic
echo ""
echo "Test 4: Simulating Docker entrypoint..."
unset NEXT_PUBLIC_VAPID_PUBLIC_KEY
unset VAPID_PRIVATE_KEY

if [ -z "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
  echo "✅ Correctly detected missing keys"
  
  # Generate keys
  VAPID_OUTPUT=$(node -e "
    const webpush = require('web-push');
    const keys = webpush.generateVAPIDKeys();
    console.log(JSON.stringify(keys));
  ")
  
  TEST_PUBLIC=$(echo $VAPID_OUTPUT | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    console.log(data.publicKey);
  ")
  
  TEST_PRIVATE=$(echo $VAPID_OUTPUT | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    console.log(data.privateKey);
  ")
  
  if [ -n "$TEST_PUBLIC" ] && [ -n "$TEST_PRIVATE" ]; then
    echo "✅ Keys generated successfully in Docker simulation"
    echo "   Public: ${TEST_PUBLIC:0:30}..."
    echo "   Private: ${TEST_PRIVATE:0:30}..."
  else
    echo "❌ Failed to generate keys in Docker simulation"
    exit 1
  fi
else
  echo "❌ Keys should not be set in test environment"
  exit 1
fi

# Test 5: Check docker-entrypoint.sh
echo ""
echo "Test 5: Checking docker-entrypoint.sh..."
if [ -f "docker-entrypoint.sh" ]; then
  echo "✅ docker-entrypoint.sh exists"
  
  if grep -q "VAPID" docker-entrypoint.sh; then
    echo "✅ docker-entrypoint.sh contains VAPID logic"
  else
    echo "❌ docker-entrypoint.sh missing VAPID logic"
    exit 1
  fi
  
  if [ -x "docker-entrypoint.sh" ]; then
    echo "✅ docker-entrypoint.sh is executable"
  else
    echo "⚠️  docker-entrypoint.sh not executable (fixing...)"
    chmod +x docker-entrypoint.sh
  fi
else
  echo "❌ docker-entrypoint.sh not found"
  exit 1
fi

# Test 6: Check .env.example has VAPID keys
echo ""
echo "Test 6: Checking .env.example..."
if [ -f ".env.example" ]; then
  if grep -q "NEXT_PUBLIC_VAPID_PUBLIC_KEY" .env.example && grep -q "VAPID_PRIVATE_KEY" .env.example; then
    echo "✅ .env.example contains VAPID key placeholders"
  else
    echo "⚠️  .env.example missing VAPID keys (non-critical)"
  fi
else
  echo "⚠️  .env.example not found (non-critical)"
fi

# Test 7: Check package.json script
echo ""
echo "Test 7: Checking npm scripts..."
if grep -q "setup:notifications" package.json; then
  echo "✅ npm script 'setup:notifications' is configured"
else
  echo "❌ npm script 'setup:notifications' not found"
  exit 1
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║     ✅ ALL TESTS PASSED                                ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Your NAS deployment is ready!"
echo ""
echo "Next steps:"
echo "  1. Deploy to your NAS: docker-compose up -d --build"
echo "  2. Check logs: docker-compose logs app | grep VAPID"
echo "  3. To persist keys, add them to docker-compose.yml"
echo ""
echo "For more info, see: docs/NOTIFICATION_SETUP.md"
echo ""
