"use server";

import {
  NotificationService,
  PushSubscriptionData
} from "@/services/NotificationService";

const notificationService = NotificationService.getInstance();

/**
 * Subscribe a user to push notifications
 */
export async function subscribeUser( subscription: PushSubscriptionData ) {
  try {
    await notificationService.storeSubscription( subscription );
    return {
      success: true
    };
  } catch( error ) {
    console.error(
      "Error subscribing user:",
      error
    );
    return {
      success: false,
      error: "Failed to subscribe"
    };
  }
}

/**
 * Unsubscribe a user from push notifications
 */
export async function unsubscribeUser( endpoint: string ) {
  try {
    await notificationService.removeSubscription( endpoint );
    return {
      success: true
    };
  } catch( error ) {
    console.error(
      "Error unsubscribing user:",
      error
    );
    return {
      success: false,
      error: "Failed to unsubscribe"
    };
  }
}

/**
 * Send a test notification
 */
export async function sendTestNotification(
  subscription: PushSubscriptionData,
  message: string
) {
  try {
    const success = await notificationService.sendNotification(
      subscription,
      {
        title: "Test Notification",
        body: message,
        icon: "/icon-192x192.png"
      }
    );

    return {
      success
    };
  } catch( error ) {
    console.error(
      "Error sending test notification:",
      error
    );
    return {
      success: false,
      error: "Failed to send notification"
    };
  }
}
