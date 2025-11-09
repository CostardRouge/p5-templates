// Cache version - updated on each deployment
// This will be automatically replaced during build
const CACHE_VERSION = '__CACHE_VERSION__'
const CACHE_NAME = `social-templates-v${CACHE_VERSION}`

// Assets to cache (optional - for offline support)
const STATIC_ASSETS = [
  // Add critical assets here if you want offline support
  // '/icon-192x192.png',
  // '/icon-512x512.png',
]

// Push notification handler
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.jobId || '1',
        url: data.url || '/',
      },
      actions: data.actions || [],
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

// Notification click handler
self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.')
  event.notification.close()
  
  const urlToOpen = event.notification.data?.url || '/'
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnmatched: true }).then(function (clientList) {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus()
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen)
      }
    })
  )
})

// Install event - cache resources and skip waiting
self.addEventListener('install', function (event) {
  console.log(`[SW] Installing version ${CACHE_VERSION}`)
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    }).then(function () {
      // Force the waiting service worker to become the active service worker
      return self.skipWaiting()
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', function (event) {
  console.log(`[SW] Activating version ${CACHE_VERSION}`)
  
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          // Delete all caches that don't match the current version
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    }).then(function () {
      // Take control of all clients immediately
      return self.clients.claim()
    }).then(function () {
      // Notify all clients that a new version is active
      return self.clients.matchAll().then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION
          })
        })
      })
    })
  )
})

// Fetch event - network first, then cache fallback (optional)
self.addEventListener('fetch', function (event) {
  // For now, we'll use network-first strategy
  // This ensures users always get the latest content
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Only cache GET requests (Cache API doesn't support POST, PUT, etc.)
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch(function () {
        // Fallback to cache if network fails (only works for GET requests)
        return caches.match(event.request)
      })
  )
})

// Listen for skip waiting message from client
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message')
    self.skipWaiting()
  }
})
