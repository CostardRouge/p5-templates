import webpush from "web-push";
import {
  prisma
} from "@/lib/connections/prisma";

// Initialize VAPID details. The subject is configurable so deployments are
// not tied to the historical social-templates.com address.
if ( process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:sketchbook@steevepommier.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class NotificationService {
  private static instance: NotificationService | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if ( !NotificationService.instance ) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Store a push subscription in the database
   */
  async storeSubscription( subscription: PushSubscriptionData ): Promise<void> {
    try {
      await prisma.pushSubscription.upsert( {
        where: {
          endpoint: subscription.endpoint
        },
        update: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        },
        create: {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      } );
      console.log(
        "[Notification] Subscription stored:",
        subscription.endpoint
      );
    } catch( error ) {
      console.error(
        "[Notification] Error storing subscription:",
        error
      );
      throw error;
    }
  }

  /**
   * Remove a push subscription from the database
   */
  async removeSubscription( endpoint: string ): Promise<void> {
    try {
      await prisma.pushSubscription.deleteMany( {
        where: {
          endpoint
        }
      } );
      console.log(
        "[Notification] Subscription removed:",
        endpoint
      );
    } catch( error ) {
      console.error(
        "[Notification] Error removing subscription:",
        error
      );
      throw error;
    }
  }

  /**
   * Send a notification to a specific subscription
   */
  async sendNotification(
    subscription: PushSubscriptionData,
    payload: {
      title: string;
      body: string;
      icon?: string;
      url?: string;
      jobId?: string;
    }
  ): Promise<boolean> {
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify( payload )
      );
      console.log(
        "[Notification] Sent successfully to:",
        subscription.endpoint
      );
      return true;
    } catch( error ) {
      console.error(
        "[Notification] Error sending notification:",
        error
      );
      return false;
    }
  }

  /**
   * Send a notification to all stored subscriptions
   */
  async sendNotificationToAll( payload: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    jobId?: string;
  } ): Promise<void> {
    // Only send notifications if backend recording is enabled
    if ( process.env.BACKEND_RECORDING !== "true" ) {
      console.log( "[Notification] Notifications disabled (BACKEND_RECORDING=false)" );
      return;
    }

    try {
      const subscriptions = await prisma.pushSubscription.findMany();

      if ( subscriptions.length === 0 ) {
        console.log( "[Notification] No subscriptions found" );
        return;
      }

      console.log(
        `[Notification] Sending to ${ subscriptions.length } subscriptions:`,
        payload
      );

      const results = await Promise.allSettled( subscriptions.map( async( sub ) => {
        try {
          await this.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
              }
            },
            payload
          );
        } catch( error: any ) {
          // If subscription is invalid (410 Gone), remove it
          if ( error.statusCode === 410 ) {
            console.log( `[Notification] Removing invalid subscription ${ sub.id }` );
            await prisma.pushSubscription.delete( {
              where: {
                id: sub.id
              }
            } );
          } else {
            throw error;
          }
        }
      } ) );

      const successful = results.filter( ( r ) => r.status === "fulfilled" ).length;

      console.log( `[Notification] Sent ${ successful }/${ subscriptions.length } notifications` );
    } catch( error ) {
      console.error(
        "[Notification] Error sending notifications to all:",
        error
      );
      throw error;
    }
  }

  /**
   * Send a job completion notification
   */
  async sendJobCompletionNotification(
    jobId: string,
    jobName?: string
  ): Promise<void> {
    const payload = {
      title: "Job Completed! 🎉",
      body: jobName
        ? `Your job "${ jobName }" has finished processing.`
        : "Your recording job has finished processing.",
      icon: "/assets/images/icon-192x192.png",
      url: `/recordings/${ jobId }`,
      jobId
    };

    await this.sendNotificationToAll( payload );
  }

  /**
   * Send a job failure notification
   */
  async sendJobFailureNotification(
    jobId: string,
    jobName?: string
  ): Promise<void> {
    const payload = {
      title: "Job Failed ❌",
      body: jobName
        ? `Your job "${ jobName }" has failed.`
        : "Your recording job has failed.",
      icon: "/assets/images/icon-192x192.png",
      url: `/recordings/${ jobId }`,
      jobId
    };

    await this.sendNotificationToAll( payload );
  }
}
