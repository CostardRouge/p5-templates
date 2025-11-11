#!/bin/sh
set -e

echo "Checking VAPID keys for push notifications..."
if [ -z "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
  echo "⚠️  VAPID keys not found in environment. Generating new keys..."
  
  # Generate VAPID keys using web-push
  VAPID_OUTPUT=$(node -e "
    const webpush = require('web-push');
    const keys = webpush.generateVAPIDKeys();
    console.log(JSON.stringify(keys));
  ")
  
  export NEXT_PUBLIC_VAPID_PUBLIC_KEY=$(echo $VAPID_OUTPUT | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    console.log(data.publicKey);
  ")
  
  export VAPID_PRIVATE_KEY=$(echo $VAPID_OUTPUT | node -e "
    const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    console.log(data.privateKey);
  ")
  
  echo "✅ Generated new VAPID keys:"
  echo "   Public: $NEXT_PUBLIC_VAPID_PUBLIC_KEY"
  echo "   Private: $VAPID_PRIVATE_KEY"
  echo ""
  echo "⚠️  IMPORTANT: Save these keys to your .env file or docker-compose.yml"
  echo "   to persist them across container restarts!"
else
  echo "✅ VAPID keys found in environment"
fi

echo "Running database migrations..."
npx prisma generate
npx prisma migrate deploy

echo "Starting application..."
exec npm run start
