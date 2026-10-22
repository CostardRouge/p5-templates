import webpush from "web-push";
import {
  prisma
} from "@/lib/connections/prisma";
import {
  isAllowedPushEndpoint,
  parsePushSubscription,
  type PushSubscriptionData
} from "@/lib/pushSubscription";

export type {
  PushSubscriptionData
};

// A push service that does not answer must not hold a worker's completion
// handler open indefinitely (web-push has no default timeout).
const PUSH_TIMEOUT_MS = 10_000;

type NotificationPayload = {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  jobId?: string;
};

// Initialize VAPID details. The subject is configurable so deployments are
// not tied to the historical social-templates.com address.
if ( process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:sketchbook@steevepommier.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
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
  async storeSubscription( input: PushSubscriptionData ): Promise<void> {
    // Comes straight from an unauthenticated server action, and the endpoint
    // is a URL this server will POST to on every job: push services only.
    const subscription = parsePushSubscription( input );

    if ( !subscription ) {
      throw new Error( "Invalid push subscription" );
    }

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
      // The endpoint URL is a bearer capability: log where, not what.
      console.log(
        "[Notification] Subscription stored:",
        new URL( subscription.endpoint ).hostname
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
    payload: NotificationPayload
  ): Promise<boolean> {
    try {
      await this.deliver(
        subscription,
        payload
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
  /**
   * Send one push and let the error through — `sendNotification` swallows
   * it into a boolean, which is why the 410 clean-up below never ran.
   */
  private async deliver(
    subscription: PushSubscriptionData,
    payload: NotificationPayload
  ): Promise<void> {
    if ( !isAllowedPushEndpoint( subscription.endpoint ) ) {
      throw new Error( "Refusing to send to an endpoint that is not a push service" );
    }

    await webpush.sendNotification(
      subscription,
      JSON.stringify( payload ),
      {
        timeout: PUSH_TIMEOUT_MS
      }
    );
    console.log(
      "[Notification] Sent successfully to:",
      new URL( subscription.endpoint ).hostname
    );
  }

  async sendNotificationToAll( payload: NotificationPayload ): Promise<void> {
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

      // A row stored before endpoints were checked can point anywhere; it is
      // skipped, not deleted, in case it is a push service the list misses.
      const deliverable = subscriptions.filter( ( sub ) => {
        if ( isAllowedPushEndpoint( sub.endpoint ) ) {
          return true;
        }

        console.warn( `[Notification] Skipping subscription ${ sub.id }: endpoint is not a known push service` );
        return false;
      } );

      const results = await Promise.allSettled( deliverable.map( async( sub ) => {
        try {
          await this.deliver(
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
          // The push service says this subscription no longer exists
          // (404 Not Found / 410 Gone): remove it so it is not retried forever.
          if ( error?.statusCode === 404 || error?.statusCode === 410 ) {
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

      console.log( `[Notification] Sent ${ successful }/${ deliverable.length } notifications` );
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
