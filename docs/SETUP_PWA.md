# PWA Setup Instructions

Your app has been configured as a Progressive Web App (PWA) with push notifications support.

## Required Setup Steps

### 1. Generate VAPID Keys

Run the following command to generate VAPID keys for push notifications:

```bash
node scripts/generate-vapid-keys.mjs
```

This will output two keys that you need to add to your `.env` file:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
```

### 2. Create App Icons

You need to create two icon files and place them in the `public/` directory:

- `public/icon-192x192.png` - 192x192 pixels
- `public/icon-512x512.png` - 512x512 pixels

You can use tools like:
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Favicon.io](https://favicon.io/)
- Any image editor to create PNG files

### 3. Database Schema (Optional but Recommended)

For production use, you should store push subscriptions in your database. Add this to your `prisma/schema.prisma`:

```prisma
model PushSubscription {
  id        String   @id @default(uuid())
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Then update the `NotificationService.ts` to use the database instead of in-memory storage.

### 4. Testing Locally

To test push notifications locally with HTTPS:

```bash
npm run dev -- --experimental-https
```

**Note:** You'll need to accept the self-signed certificate warning in your browser.

### 5. Browser Permissions

When you click "Enable Notifications" in the app:
1. Your browser will prompt you to allow notifications
2. Click "Allow" to enable push notifications
3. You can test notifications by clicking the "Test" button

## Features Implemented

### ✅ PWA Manifest
- Located at `/src/app/manifest.ts`
- Defines app name, icons, and display mode
- Enables "Add to Home Screen" functionality

### ✅ Service Worker
- Located at `/public/sw.js`
- Handles push notifications
- Manages notification clicks
- **No caching** - always uses network for fresh content

### ✅ Push Notifications
- Automatic notifications when jobs complete
- Automatic notifications when jobs fail
- Manual test notification feature
- Subscribe/unsubscribe functionality in the MenuBar

### ✅ Notification Service
- `NotificationService` class for sending notifications
- Server actions for managing subscriptions
- Integration with BullMQ job completion handlers

## How It Works

1. **User subscribes**: Click "Enable Notifications" in the MenuBar
2. **Job processing**: When a recording job completes or fails
3. **Notification sent**: Server sends push notification via Web Push API
4. **User receives**: Notification appears even if app is closed
5. **Click notification**: Opens the app to the relevant recording

## Browser Support

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)
- ✅ Safari 16+ (macOS 13+)
- ✅ iOS 16.4+ (when installed to home screen)

## Production Deployment

For production:
1. Ensure VAPID keys are set in environment variables
2. Use HTTPS (required for service workers)
3. Implement database storage for subscriptions
4. Consider adding user authentication to subscriptions
5. Add rate limiting for notification sending

## Troubleshooting

### Notifications not working?
- Check browser console for errors
- Verify VAPID keys are set correctly
- Ensure you're using HTTPS (or localhost)
- Check notification permissions in browser settings
- Try in an incognito window to reset permissions

### Service worker not registering?
- Clear browser cache
- Check `/sw.js` is accessible
- Verify no console errors
- Try unregistering old service workers in DevTools

### Icons not showing?
- Verify icon files exist in `public/` directory
- Check file names match manifest.ts
- Clear cache and reload
