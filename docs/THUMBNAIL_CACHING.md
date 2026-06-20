# Thumbnail Caching Strategy

## Overview

The PWA service worker now caches thumbnail images to improve loading performance, especially when accessing files from slow NAS storage.

## What Gets Cached

The service worker caches the following thumbnail images:

1. **Template Thumbnails**
   - Path: `/assets/images/templates/**/*.{webp,jpeg,jpg}`
   - Used in: Templates page (`/templates`)
   - Example: `/assets/images/templates/p5/sketch-name/thumbnail.webp`
   - Thumbnails are generated as WebP (quality 80) by sharp; `.jpeg`/`.jpg`
     remain matched for backwards compatibility with legacy stills.

2. **Recording Thumbnails**
   - API: `/api/recordings/[id]/thumbnail`
   - Used in: Recordings page (`/recordings`)
   - These redirect to S3 signed URLs which are also cached

3. **Video Poster Thumbnails**
   - Source: S3 signed URLs from `/api/recordings/[id]/media`
   - Used in: Video preview modal
   - Displayed as video poster images before playback

4. **Recording Slide Images**
   - Source: S3 signed URLs containing `/thumbnails/` in the path
   - Used in: Recording playback and preview

## Caching Strategy

The service worker uses a **stale-while-revalidate** strategy:

1. **Cache Hit**: Returns cached image immediately for fast loading
2. **Background Update**: Fetches fresh version from network to update cache
3. **Cache Miss**: Fetches from network and caches for future use

This ensures:
- Fast initial load from cache
- Fresh content is fetched in the background
- Graceful fallback if network fails

## Cache Management

- **Cache Name**: `thumbnail-cache-v1`
- **Cache Lifetime**: Persistent until service worker update
- **Cache Invalidation**: Old caches are cleared when service worker version changes
- **Storage**: Uses browser's Cache API (separate from localStorage)

## Benefits

- **Faster Loading**: Thumbnails load instantly from cache on repeat visits
- **Reduced NAS Load**: Fewer requests to slow NAS storage
- **Better UX**: Smooth browsing experience even with slow storage
- **Offline Support**: Cached thumbnails available even when network is slow

## Testing

To verify caching is working:

1. Open DevTools → Application → Cache Storage
2. Look for `thumbnail-cache-v1`
3. Browse templates or recordings pages
4. Check cache entries are being added
5. Reload page - thumbnails should load instantly

To clear cache:
1. DevTools → Application → Cache Storage
2. Right-click `thumbnail-cache-v1` → Delete
3. Or unregister service worker and re-register

## Service Worker Version

Current version: `0.3.0-thumbnail-cache-webp`

When updating the service worker, increment the version to trigger cache cleanup.
