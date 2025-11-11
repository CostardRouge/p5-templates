// Minimal service worker for PWA installation and push notifications only
// No caching - always fetch from network

const SW_VERSION = "0.1.0-minimal";

// Push notification handler
self.addEventListener(
  "push",
  function( event ) {
    if ( event.data ) {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || "/icon-192x192.png",
        badge: "/icon-192x192.png",
        vibrate: [
          100,
          50,
          100
        ],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: data.jobId || "1",
          url: data.url || "/",
        },
        actions: data.actions || [
        ],
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

    event.waitUntil( clients.matchAll( {
      type: "window",
      includeUnmatched: true
    } ).then( function( clientList ) {
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

// Install event - just skip waiting, no caching
self.addEventListener(
  "install",
  function( event ) {
    console.log( `[SW] Installing version ${ SW_VERSION } (no caching)` );
    // Immediately activate
    event.waitUntil( self.skipWaiting() );
  }
);

// Activate event - clean up any old caches and take control
self.addEventListener(
  "activate",
  function( event ) {
    console.log( `[SW] Activating version ${ SW_VERSION }` );

    event.waitUntil(
      // Delete ALL caches (clean slate)
      caches.keys().then( function( cacheNames ) {
        return Promise.all( cacheNames.map( function( cacheName ) {
          console.log( "[SW] Deleting cache:", cacheName );
          return caches.delete( cacheName );
        } ) );
      } )
        .then( function() {
          // Take control of all clients immediately
          return self.clients.claim();
        } )
    );
  }
);

// No fetch event handler - let all requests go directly to network
// This ensures no caching happens at all
