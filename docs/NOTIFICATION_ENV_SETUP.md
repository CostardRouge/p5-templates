# Notification Environment Setup

## Quick Summary

Push notifications for recording completion are now controlled by the `BACKEND_RECORDING` environment variable.

## What Changed

### Updated Files

1. **`src/services/NotificationService.ts`**
   - Implemented database storage for push subscriptions
   - Added `BACKEND_RECORDING` check in `sendNotificationToAll()`
   - Automatic cleanup of invalid subscriptions

2. **`src/lib/recordSketch.ts`**
   - Added notification calls on recording completion
   - Added notification calls on recording failure
   - Uses `NotificationService.getInstance()`

3. **`prisma/schema.prisma`**
   - Added `PushSubscription` model with fields:
     - `id` (UUID)
     - `endpoint` (unique)
     - `p256dh` (encryption key)
     - `auth` (authentication key)
     - `createdAt`, `updatedAt`

### Existing Components (Already Working)

- `src/components/PushNotificationManager.tsx` - Bell icon in menu bar
- `src/app/actions/notifications.ts` - Server actions for subscriptions
- `public/sw.js` - Service worker with push notification handlers

## Setup Instructions

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_push_subscriptions
```

Or just generate the client:

```bash
npx prisma generate
```

### 2. Configure Environment

Ensure your `.env` file has:

```bash
# Enable notifications
BACKEND_RECORDING=true

# VAPID keys (already in .env.example)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBpPJLkutVoWuLUtHE3jwIBSIFWFW4bqcMNLVFm0Sj_KRWwPPnCjNgHcMdsZHrs6Oh0sSvN9zuF7dmd37aVwyLc
VAPID_PRIVATE_KEY=jxHckSlId2G0M9rtWUGdCWWSTm0FFpP99QFlio8DGhk
```

### 3. Test Notifications

1. Start your app: `npm run dev`
2. Click the bell icon in the menu bar
3. Grant notification permissions
4. Start a recording
5. Wait for completion - you should receive a notification!

## Disabling Notifications

To disable notifications, set in `.env`:

```bash
BACKEND_RECORDING=false
```

This will:
- ✅ Keep the subscription UI visible
- ✅ Allow users to subscribe/unsubscribe
- ❌ Prevent any notifications from being sent

## Architecture

```
User Action (Subscribe)
  ↓
PushNotificationManager.tsx
  ↓
actions/notifications.ts (subscribeUser)
  ↓
NotificationService.storeSubscription()
  ↓
Database (PushSubscription table)

Recording Complete
  ↓
recordSketch.ts
  ↓
NotificationService.sendJobCompletionNotification()
  ↓
Check BACKEND_RECORDING env
  ↓
sendNotificationToAll()
  ↓
Fetch subscriptions from DB
  ↓
Send via web-push
  ↓
Service Worker (sw.js)
  ↓
Browser Notification
```

## Troubleshooting

### No notifications received

1. Check `BACKEND_RECORDING=true` in `.env`
2. Check browser notification permissions
3. Check service worker is registered (DevTools > Application)
4. Check server logs for `[Notification]` messages

### Database errors

Run the migration:
```bash
npx prisma migrate dev
```

### VAPID key errors

Generate new keys:
```bash
npx web-push generate-vapid-keys
```

Then update `.env` with the new keys.
