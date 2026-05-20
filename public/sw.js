// Service worker for PWA installation, push notifications, and thumbnail caching
// Caches thumbnail images for better performance on slow NAS storage

const SW_VERSION = "0.2.0-thumbnail-cache";
const THUMBNAIL_CACHE = "thumbnail-cache-v1";

// Push notification handler
self.addEventListener(
  "push",
  function( event ) {
    if ( event.data ) {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || "/assets/images/icon-192x192.png",
        badge: "/assets/images/icon-192x192.png",
        vibrate: [
          100,
          50,
          100
        ],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: data.jobId || "1",
          url: data.url || "/"
        },
        actions: data.actions || []
      };

      event.waitUntil( self.registration.showNotification(
        data.title,
        options
      ) );
    }
  }
);

// Notification click handler
self.addEventListener(
  "notificationclick",
  function( event ) {
    console.log( "Notification click received." );
    event.notification.close();

    const urlToOpen = event.notification.data?.url || "/";

    event.waitUntil( clients
      .matchAll( {
        type: "window",
        includeUnmatched: true
      } )
      .then( function( clientList ) {
        // Check if there's already a window open
        for ( let i = 0; i < clientList.length; i++ ) {
          const client = clientList[ i ];

          if ( client.url === urlToOpen && "focus" in client ) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if ( clients.openWindow ) {
          return clients.openWindow( urlToOpen );
        }
      } ) );
  }
);

// Install event - skip waiting to activate immediately
self.addEventListener(
  "install",
  function( event ) {
    console.log( `[SW] Installing version ${ SW_VERSION }` );
    // Immediately activate
    event.waitUntil( self.skipWaiting() );
  }
);

// Activate event - clean up old caches and take control
self.addEventListener(
  "activate",
  function( event ) {
    console.log( `[SW] Activating version ${ SW_VERSION }` );

    event.waitUntil(
    // Delete old caches but keep the current thumbnail cache
      caches
        .keys()
        .then( function( cacheNames ) {
          return Promise.all( cacheNames.map( function( cacheName ) {
            if ( cacheName !== THUMBNAIL_CACHE ) {
              console.log(
                "[SW] Deleting old cache:",
                cacheName
              );
              return caches.delete( cacheName );
            }
          } ) );
        } )
        .then( function() {
        // Take control of all clients immediately
          return self.clients.claim();
        } ) );
  }
);

// Helper function to check if URL is a thumbnail image
function isThumbnailImage( url ) {
  const urlObj = new URL( url );
  const pathname = urlObj.pathname;

  // Template thumbnails: assets/images/templates/**/*.{jpeg,jpg}
  if (
    pathname.startsWith( "/assets/images/templates/" ) &&
    ( pathname.endsWith( ".jpeg" ) || pathname.endsWith( ".jpg" ) )
  ) {
    return true;
  }

  // Recording thumbnail API: /api/recordings/[id]/thumbnail
  if ( pathname.match( /^\/api\/recordings\/[^/]+\/thumbnail$/ ) ) {
    return true;
  }

  // S3 signed URLs for thumbnails (from amazonaws.com)
  if (
    urlObj.hostname.includes( "amazonaws.com" ) &&
    ( pathname.includes( "/thumbnails/" ) || pathname.includes( "thumbnail" ) )
  ) {
    return true;
  }

  return false;
}

// Fetch event - cache thumbnail images
self.addEventListener(
  "fetch",
  function( event ) {
    const url = event.request.url;

    // Only handle GET requests for thumbnail images
    if ( event.request.method !== "GET" || !isThumbnailImage( url ) ) {
      return; // Let the request go to network
    }

    event.respondWith( caches.open( THUMBNAIL_CACHE ).then( function( cache ) {
      return cache.match( event.request ).then( function( cachedResponse ) {
        // Return cached response if available
        if ( cachedResponse ) {
          console.log(
            "[SW] Cache hit:",
            url
          );

          // Fetch in background to update cache (stale-while-revalidate)
          fetch( event.request )
            .then( function( networkResponse ) {
              if ( networkResponse && networkResponse.status === 200 ) {
                cache.put(
                  event.request,
                  networkResponse.clone()
                );
              }
            } )
            .catch( function() {
              // Ignore network errors during background update
            } );

          return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log(
          "[SW] Cache miss, fetching:",
          url
        );
        return fetch( event.request )
          .then( function( networkResponse ) {
            // Cache successful responses
            if ( networkResponse && networkResponse.status === 200 ) {
              // Clone the response before caching
              cache.put(
                event.request,
                networkResponse.clone()
              );
            }
            return networkResponse;
          } )
          .catch( function( error ) {
            console.error(
              "[SW] Fetch failed:",
              url,
              error
            );
            throw error;
          } );
      } );
    } ) );
  }
);
