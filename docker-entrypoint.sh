#!/bin/sh
set -e

# VAPID keys are required for web-push notifications. They MUST be provided via
# the environment (.env / compose) and kept stable — generating a fresh pair on
# every container start would silently invalidate every existing subscription.
if [ -z "$NEXT_PUBLIC_VAPID_PUBLIC_KEY" ] || [ -z "$VAPID_PRIVATE_KEY" ]; then
  echo "⚠️  VAPID keys not set — push notifications are disabled."
  echo "    Generate a persistent pair once and store it in your .env:"
  echo "      npx web-push generate-vapid-keys"
else
  echo "✅ VAPID keys found in environment"
fi

echo "Running database migrations..."
# Run the isolated Prisma CLI (full dependency closure under prisma-cli/) via its
# real entrypoint — not node_modules/.bin/prisma, whose symlink Docker
# dereferences, which breaks __dirname-relative WASM loading.
node /app/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema /app/prisma/schema.prisma

echo "Starting application..."
exec node server.js
