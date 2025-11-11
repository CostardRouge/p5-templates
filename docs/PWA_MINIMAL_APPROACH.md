# Minimal PWA Approach

## Overview

This app uses a **minimal PWA implementation** focused solely on:
1. **App Installation** - Users can install the app icon on their devices
2. **Push Notifications** - Receive notifications for job completion/failure

## What We DON'T Do

- ❌ **No Caching** - All requests go directly to the network
- ❌ **No Offline Support** - App requires internet connection
- ❌ **No Cache Management** - No cache versioning or invalidation needed

## Why This Approach?

The aggressive caching in traditional PWAs can cause issues:
- Users see stale content after deployments
- Cache invalidation complexity
- Debugging difficulties
- Storage management overhead

By skipping caching entirely, we get:
- ✅ Always fresh content
- ✅ Simpler deployment (no cache busting)
- ✅ Easier debugging
- ✅ Still get PWA benefits (installation + notifications)

## Service Worker (`public/sw.js`)

The service worker is minimal and only handles:

```javascript
// Push notification events
self.addEventListener('push', ...)
self.addEventListener('notificationclick', ...)

// Installation (no caching)
self.addEventListener('install', ...)

// Activation (cleans up any old caches)
self.addEventListener('activate', ...)

// NO fetch event handler = all requests go to network
```

## Manifest (`src/app/manifest.ts`)

Defines app metadata for installation:
- App name and description
- Icons for home screen
- Display mode (standalone)
- Theme colors

## Benefits

1. **Installation**: Users can add app to home screen
2. **Notifications**: Background push notifications work
3. **Fresh Content**: Always get latest version
4. **Simple**: No cache management complexity

## Trade-offs

- Requires internet connection (no offline mode)
- Slightly slower than cached content
- More network requests

For most web apps, this is the right balance between PWA features and simplicity.
