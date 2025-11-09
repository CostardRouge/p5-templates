# PWA Cache Invalidation Strategy

## Overview

Your PWA now has automatic cache invalidation that ensures users always get the latest version when you deploy updates. No more stale cache issues!

## How It Works

### 1. **Automatic Versioning**
Every build generates a unique cache version combining:
- App version from `package.json` (e.g., `0.1.0`)
- Build timestamp hash (e.g., `a3f2b1c4`)
- Result: `0.1.0-a3f2b1c4`

### 2. **Build-Time Injection**
The `prebuild` script (`inject-sw-version.mjs`) runs before every build:
```bash
npm run build
# Automatically runs: node scripts/inject-sw-version.mjs
# Then runs: next build
```

This replaces `__CACHE_VERSION__` in `sw.js` with the actual version.

### 3. **Service Worker Lifecycle**

#### On Install:
- New service worker installs with new cache version
- Creates new cache: `social-templates-v0.1.0-a3f2b1c4`
- Skips waiting to activate immediately

#### On Activate:
- Deletes ALL old caches (different versions)
- Takes control of all clients
- Notifies clients that update is available

### 4. **User Notification**
When a new version is detected:
- Blue notification banner appears at bottom of screen
- Shows "Update Available" message
- User can click "Reload" to get new version
- Or dismiss and continue with current version

### 5. **Automatic Update Checks**
- Checks for updates every 60 seconds
- Checks on page load
- Checks on page focus
- No manual intervention needed

## Cache Strategy

### Network-First Approach
```javascript
fetch(request) → Success? → Return & cache
                ↓ Fail?
            Cache fallback
```

This ensures:
- ✅ Users always get latest content when online
- ✅ Offline fallback if network fails
- ✅ No stale content issues

## Files Involved

### Core Files:
- **`public/sw.js`** - Service worker with cache management
- **`scripts/inject-sw-version.mjs`** - Version injection script
- **`src/components/ServiceWorkerUpdateNotifier.tsx`** - Update UI
- **`src/app/layout.tsx`** - Includes update notifier

### Configuration:
- **`package.json`** - Build scripts with `prebuild` hook
- **`next.config.ts`** - Service worker headers

## Deployment Workflow

### Development:
```bash
npm run dev
# Service worker uses placeholder version
# Hot reload works normally
```

### Production Build:
```bash
npm run build
# 1. prebuild: Injects unique version into sw.js
# 2. build: Next.js builds the app
# 3. Service worker deployed with new version
```

### What Happens on Deploy:

1. **New build deployed** with version `0.1.0-xyz123`
2. **User visits site** (still has old version `0.1.0-abc456`)
3. **Browser checks for SW updates** (automatic)
4. **New SW installs** in background
5. **New SW activates** and deletes old cache
6. **User sees notification**: "Update Available"
7. **User clicks "Reload"**: Gets new version instantly
8. **Old cache deleted**: No disk space wasted

## Testing Cache Invalidation

### Test 1: Verify Version Injection
```bash
npm run build
cat public/sw.js | grep "CACHE_VERSION"
# Should show: const CACHE_VERSION = '0.1.0-xxxxxxxx'
```

### Test 2: Simulate Deployment
```bash
# Build 1
npm run build
npm start
# Note the cache version in console

# Build 2 (change version in package.json)
npm run build
npm start
# New cache version should be different
# Old cache should be deleted
```

### Test 3: Check Browser Cache
1. Open DevTools → Application → Cache Storage
2. Should see: `social-templates-v0.1.0-xxxxxxxx`
3. Deploy new version
4. Reload page
5. Old cache deleted, new cache created

## Monitoring

### Browser Console Logs:
```
[SW] Installing version 0.1.0-a3f2b1c4
[SW] Caching static assets
[SW] Activating version 0.1.0-a3f2b1c4
[SW] Deleting old cache: social-templates-v0.1.0-old123
[SW] New version available: 0.1.0-a3f2b1c4
```

### Build Logs:
```
[Build] Injecting cache version: 0.1.0-a3f2b1c4
[Build] ✓ Service worker updated with version 0.1.0-a3f2b1c4
[Build] ✓ Old caches will be automatically cleared on activation
```

## Customization

### Change Update Check Frequency
Edit `ServiceWorkerUpdateNotifier.tsx`:
```typescript
// Check every 5 minutes instead of 60 seconds
const interval = setInterval(() => {
  reg.update()
}, 300000) // 5 minutes
```

### Auto-Reload on Update
Edit `ServiceWorkerUpdateNotifier.tsx`:
```typescript
navigator.serviceWorker.addEventListener('controllerchange', () => {
  window.location.reload() // Uncomment this line
})
```

### Add Assets to Cache
Edit `public/sw.js`:
```javascript
const STATIC_ASSETS = [
  '/icon-192x192.png',
  '/icon-512x512.png',
  // Add more assets here
]
```

## Troubleshooting

### Cache not clearing?
- Check browser console for SW errors
- Verify version is being injected: `cat public/sw.js | grep CACHE_VERSION`
- Try unregistering SW in DevTools → Application → Service Workers

### Update notification not showing?
- Check if service worker is registered
- Look for `[SW] New version available` in console
- Verify `ServiceWorkerUpdateNotifier` is in layout

### Users not getting updates?
- Ensure `prebuild` script runs before deployment
- Check that SW version changes between builds
- Verify service worker is not cached by CDN

## Best Practices

### ✅ DO:
- Increment version in `package.json` for major updates
- Test cache invalidation before production deploy
- Monitor service worker logs in production
- Keep update notification user-friendly

### ❌ DON'T:
- Don't cache API responses indefinitely
- Don't skip the `prebuild` script
- Don't manually edit version in `sw.js`
- Don't cache user-specific data

## Version Bumping

### Automatic (Recommended):
Every build gets a unique hash - no manual work needed!

### Manual (Optional):
Update version in `package.json`:
```json
{
  "version": "0.2.0"  // Bump for major releases
}
```

## Production Checklist

Before deploying:
- [ ] Run `npm run build` locally to test
- [ ] Verify new cache version in `public/sw.js`
- [ ] Test update notification in browser
- [ ] Check service worker logs
- [ ] Verify old caches are deleted

After deploying:
- [ ] Visit site and check for update notification
- [ ] Verify new version in DevTools → Application
- [ ] Check that old cache is deleted
- [ ] Test offline functionality (if enabled)

## Summary

Your PWA now has **automatic cache invalidation** that:
- ✅ Generates unique versions on every build
- ✅ Deletes old caches automatically
- ✅ Notifies users when updates are available
- ✅ Works seamlessly with your deployment pipeline
- ✅ Requires zero manual intervention

Users will always get the latest version of your app! 🎉
