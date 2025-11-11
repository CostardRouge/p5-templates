# Push Notifications

This guide explains how push notifications work for recording completion in your application.

## Overview

Push notifications are automatically sent when:
- A recording completes successfully ✅
- A recording fails ❌

**Notifications are only sent when `BACKEND_RECORDING=true`** in your environment variables.

## Prerequisites

1. VAPID keys configured in `.env`
2. Service worker registered (`public/sw.js`)
3. Database migration applied for `PushSubscription` model

## Environment Variables

The following environment variables control push notifications:

```bash
# Enable/disable backend recording and notifications
BACKEND_RECORDING=true

# VAPID keys for push notifications (already in .env.example)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BBpPJLkutVoWuLUtHE3jwIBSIFWFW4bqcMNLVFm0Sj_KRWwPPnCjNgHcMdsZHrs6Oh0sSvN9zuF7dmd37aVwyLc
VAPID_PRIVATE_KEY=jxHckSlId2G0M9rtWUGdCWWSTm0FFpP99QFlio8DGhk
```

## Database Setup

Run the Prisma migration to add the `PushSubscription` table:

```bash
npx prisma migrate dev --name add_push_subscriptions
```

Or generate the Prisma client:

```bash
npx prisma generate
```

## Usage

### Client-Side: Subscribe to Notifications

The `PushNotificationManager` component is already integrated in the MenuBar. Users can:
- Click the bell icon to enable/disable notifications
- Grant notification permissions when prompted
- Receive notifications even when the app is closed

The component is located at `src/components/PushNotificationManager.tsx` and is automatically shown in the menu bar.

### Server-Side: Send Notifications

Notifications are automatically sent when recordings complete or fail. The implementation is in:

- `src/services/NotificationService.ts` - Core notification service (singleton)
- `src/lib/recordSketch.ts` - Calls notification service after recording
- `src/app/actions/notifications.ts` - Server actions for subscription management

To manually send a notification:

```typescript
import { NotificationService } from "@/services/NotificationService";

const notificationService = NotificationService.getInstance();

// Send to all subscribed users
await notificationService.sendNotificationToAll({
  title: "Custom Notification",
  body: "Your message here",
  icon: "/icon-192x192.png",
  url: "/your-url",
  jobId: "optional-job-id",
});

// Or send job-specific notifications
await notificationService.sendJobCompletionNotification(jobId, jobName);
await notificationService.sendJobFailureNotification(jobId, jobName);
```

## How It Works

1. **User subscribes**: Client uses `PushNotificationManager` component to subscribe
2. **Server action**: `subscribeUser()` action stores subscription in database via `NotificationService`
3. **Recording completes**: `recordSketch.ts` calls `NotificationService.sendJobCompletionNotification()`
4. **Check env**: Service checks if `BACKEND_RECORDING=true`
5. **Send notification**: If enabled, sends push notification to all subscribed clients
6. **Service worker**: `public/sw.js` receives and displays the notification
7. **Cleanup**: Invalid subscriptions (410 Gone) are automatically removed

## Disabling Notifications

Set `BACKEND_RECORDING=false` in your `.env` file:

```bash
BACKEND_RECORDING=false
```

This will:
- Disable all push notifications
- Keep the subscription system intact
- Allow users to still subscribe (but won't receive notifications)

## Server Actions

- `subscribeUser(subscription)` - Subscribe to push notifications
- `unsubscribeUser(endpoint)` - Unsubscribe from push notifications
- `sendTestNotification(subscription, message)` - Send a test notification (dev only)

## Generating New VAPID Keys

If you need to generate new VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Update both `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in your `.env` file.

## Troubleshooting

### Notifications not appearing

1. Check browser permissions: Ensure notifications are allowed
2. Check service worker: Open DevTools > Application > Service Workers
3. Check env variable: Ensure `BACKEND_RECORDING=true`
4. Check logs: Look for `[Push]` prefixed logs in server console

### Subscription fails

1. Ensure VAPID keys are correctly set
2. Check that service worker is registered
3. Verify browser supports push notifications

### Invalid subscriptions

The system automatically removes invalid subscriptions (HTTP 410 responses) from the database.
