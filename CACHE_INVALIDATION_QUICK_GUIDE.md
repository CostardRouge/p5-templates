# Cache Invalidation - Quick Guide

## What Was Implemented

Your PWA now automatically invalidates caches on every deployment. Users will always get the latest version!

## How It Works (Simple)

1. **You deploy** → New unique version generated
2. **User visits** → Browser detects update
3. **Notification shows** → "Update Available"
4. **User reloads** → Gets new version, old cache deleted

## Zero Configuration Needed

Just deploy as normal:
```bash
npm run build
npm start
```

The `prebuild` script automatically:
- Generates unique cache version
- Injects it into service worker
- Old caches will be deleted on activation

## What You'll See

### During Build:
```
[Build] Injecting cache version: 0.1.0-a3f2b1c4
[Build] ✓ Service worker updated
```

### In Browser (User):
- Blue notification banner: "Update Available"
- Click "Reload" → Instant update
- Old cache automatically deleted

### In DevTools Console:
```
[SW] Installing version 0.1.0-a3f2b1c4
[SW] Deleting old cache: social-templates-v0.1.0-old123
[SW] New version available
```

## Testing

### Quick Test:
```bash
# Build 1
npm run build
npm start

# Build 2
npm run build
npm start

# Visit site → Should see update notification
```

### Verify Version:
```bash
cat public/sw.js | grep "CACHE_VERSION"
# Should show actual version, not __CACHE_VERSION__
```

## Files Modified

- ✅ `public/sw.js` - Added versioning & cache cleanup
- ✅ `scripts/inject-sw-version.mjs` - Version injection script
- ✅ `src/components/ServiceWorkerUpdateNotifier.tsx` - Update UI
- ✅ `src/app/layout.tsx` - Added update notifier
- ✅ `package.json` - Added `prebuild` script

## That's It!

No manual cache clearing needed. Every deployment automatically:
- Creates new cache version
- Deletes old caches
- Notifies users of updates

For detailed information, see `CACHE_INVALIDATION.md`
