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
      
      // Reload the page to activate the new service worker
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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md">
        <RefreshCw className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">Update Available</p>
          <p className="text-xs opacity-90">A new version of the app is ready</p>
        </div>
        <button
          onClick={handleUpdate}
          className="px-3 py-1.5 bg-white text-blue-500 rounded font-medium text-sm hover:bg-blue-50 transition-colors"
        >
          Reload
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-blue-600 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
