"use client";

import {
  useEffect, useState
} from "react";
import {
  RefreshCw, X
} from "lucide-react";
import clsx from "clsx";

export default function ServiceWorkerUpdateNotifier() {
  const [
    updating,
    setUpdating
  ] = useState( false );
  const [
    showUpdatePrompt,
    setShowUpdatePrompt
  ] = useState( false );
  const [
    registration,
    setRegistration
  ] = useState<ServiceWorkerRegistration | null>( null );

  useEffect(
    () => {
      if ( typeof window === "undefined" || !( "serviceWorker" in navigator ) ) {
        return;
      }

      // Get the service worker registration
      navigator.serviceWorker.ready.then( ( reg ) => {
        setRegistration( reg );
      } );

      // Listen for service worker updates (less aggressive - only on natural updates)
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          console.log( "[SW] Controller changed - new version activated" );
        }
      );

      // Check if there's a waiting service worker on load
      navigator.serviceWorker.getRegistration().then( ( reg ) => {
        if ( reg?.waiting ) {
          console.log( "[SW] Update available on page load" );
          setShowUpdatePrompt( true );
        }
      } );
    },
    [
    ]
  );

  const handleUpdate = () => {
    setUpdating( true );

    if ( registration?.waiting ) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage( {
        type: "SKIP_WAITING"
      } );

      // Listen for the controller change before reloading
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          window.location.reload();
        }
      );
    } else {
      // If no waiting worker, just reload
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdatePrompt( false );
  };

  if ( !showUpdatePrompt ) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md mx-auto">
      <div className="glass border border-border rounded-lg shadow-md shadow-active/5 flex items-center gap-3 max-w-md px-4 py-3">
        <RefreshCw className={
          clsx(
            "w-5 h-5 flex-shrink-0 text-foreground",
            {
              "animate-spin": updating,
            }
          )
        } />

        <div className="flex-1">
          <p className="font-medium text-sm text-foreground">Update available</p>
          <p className="text-xs text-label">A new version of the app is ready</p>
        </div>

        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-foreground text-background rounded-md font-medium text-sm hover:bg-foreground/90 active:bg-active transition-colors"
        >
          Reload
        </button>

        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-hover rounded transition-colors text-foreground"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
