'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

export default function ServiceWorkerUpdateNotifier() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Check for service worker updates
    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg)

      // Check for updates periodically (every 60 seconds)
      const interval = setInterval(() => {
        reg.update()
      }, 60000)

      return () => clearInterval(interval)
    })

    // Listen for service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[SW] Controller changed - new version activated')
      // Optionally reload the page automatically
      // window.location.reload()
    })

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        console.log('[SW] New version available:', event.data.version)
        setShowUpdatePrompt(true)
      }
    })

    // Check if there's a waiting service worker on load
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        console.log('[SW] Update available on page load')
        setShowUpdatePrompt(true)
      }
    })
  }, [])

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      
      // Listen for the controller change before reloading
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    } else {
      // If no waiting worker, just reload
      window.location.reload()
    }
  }

  const handleDismiss = () => {
    setShowUpdatePrompt(false)
  }

  if (!showUpdatePrompt) {
    return null
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-pulse-soft">
      <div className="glass border border-border rounded-lg shadow-lg flex items-center gap-3 max-w-md px-4 py-3">
        <RefreshCw className="w-5 h-5 flex-shrink-0 text-foreground" />
        <div className="flex-1">
          <p className="font-medium text-sm text-foreground">Update Available</p>
          <p className="text-xs text-label">A new version of the app is ready</p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-foreground text-background rounded font-medium text-sm hover:bg-foreground/90 active:bg-active transition-colors"
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
  )
}
