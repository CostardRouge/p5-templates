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

# The database only serves the recording backend and push notifications. Without
# either, the app starts with no PostgreSQL at all (docker compose without the
# `backend` profile): skip the migrations instead of failing on a missing host.
if [ "$BACKEND_RECORDING" = "true" ] || [ "$NOTIFICATIONS" = "true" ]; then
  echo "Running database migrations..."
  # Run the isolated Prisma CLI (full dependency closure under prisma-cli/) via its
  # real entrypoint — not node_modules/.bin/prisma, whose symlink Docker
  # dereferences, which breaks __dirname-relative WASM loading.
  node /app/prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema /app/prisma/schema.prisma
else
  echo "Backend off (BACKEND_RECORDING and NOTIFICATIONS not true): no database, no migrations."
fi

echo "Starting application..."
exec node server.js
