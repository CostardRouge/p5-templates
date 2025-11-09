'use client'

import { useState, useEffect } from 'react'
import { subscribeUser, unsubscribeUser, sendTestNotification } from '@/app/actions/notifications'
import { Bell, BellOff } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true)
      registerServiceWorker()
    }
  }, [])

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      })
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
    } catch (error) {
      console.error('Error registering service worker:', error)
    }
  }

  async function subscribeToPush() {
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      
      // Request notification permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Notification permission denied')
        setIsLoading(false)
        return
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!publicKey) {
        console.error('VAPID public key not found')
        alert('Push notifications are not configured. Please add VAPID keys to .env file.')
        setIsLoading(false)
        return
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      setSubscription(sub)
      const serializedSub = JSON.parse(JSON.stringify(sub))
      await subscribeUser(serializedSub)
      
      console.log('Successfully subscribed to push notifications')
    } catch (error) {
      console.error('Error subscribing to push:', error)
      alert('Failed to subscribe to notifications')
    } finally {
      setIsLoading(false)
    }
  }

  async function unsubscribeFromPush() {
    setIsLoading(true)
    try {
      if (subscription) {
        await subscription.unsubscribe()
        await unsubscribeUser(subscription.endpoint)
        setSubscription(null)
        console.log('Successfully unsubscribed from push notifications')
      }
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      alert('Failed to unsubscribe from notifications')
    } finally {
      setIsLoading(false)
    }
  }

  async function sendTest() {
    if (!subscription) return
    
    setIsLoading(true)
    try {
      const serializedSub = JSON.parse(JSON.stringify(subscription))
      await sendTestNotification(serializedSub, 'This is a test notification!')
      console.log('Test notification sent')
    } catch (error) {
      console.error('Error sending test notification:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {subscription ? (
        <>
          <button
            onClick={unsubscribeFromPush}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
            title="Notifications enabled"
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Notifications On</span>
          </button>
          <button
            onClick={sendTest}
            disabled={isLoading}
            className="px-3 py-2 text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            title="Send test notification"
          >
            Test
          </button>
        </>
      ) : (
        <button
          onClick={subscribeToPush}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-500/10 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-500/20 transition-colors disabled:opacity-50"
          title="Enable notifications"
        >
          <BellOff className="w-4 h-4" />
          <span className="hidden sm:inline">Enable Notifications</span>
        </button>
      )}
    </div>
  )
}
