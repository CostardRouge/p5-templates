import webpush from 'web-push';
import {
  prisma
} from "@/lib/connections/prisma";

// Initialize VAPID details
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@social-templates.com',
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
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Store a push subscription in the database
   */
  async storeSubscription(subscription: PushSubscriptionData): Promise<void> {
    try {
      // Store in database - you'll need to create a PushSubscription model in Prisma
      // For now, we'll just log it
      console.log('[Notification] Subscription stored:', subscription.endpoint);
      
      // TODO: Implement database storage
      // await prisma.pushSubscription.upsert({
      //   where: { endpoint: subscription.endpoint },
      //   update: subscription,
      //   create: subscription,
      // });
    } catch (error) {
      console.error('[Notification] Error storing subscription:', error);
      throw error;
    }
  }

  /**
   * Remove a push subscription from the database
   */
  async removeSubscription(endpoint: string): Promise<void> {
    try {
      console.log('[Notification] Subscription removed:', endpoint);
      
      // TODO: Implement database removal
      // await prisma.pushSubscription.delete({
      //   where: { endpoint },
      // });
    } catch (error) {
      console.error('[Notification] Error removing subscription:', error);
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
        JSON.stringify(payload)
      );
      console.log('[Notification] Sent successfully to:', subscription.endpoint);
      return true;
    } catch (error) {
      console.error('[Notification] Error sending notification:', error);
      return false;
    }
  }

  /**
   * Send a notification to all stored subscriptions
   */
  async sendNotificationToAll(payload: {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    jobId?: string;
  }): Promise<void> {
    try {
      // TODO: Fetch all subscriptions from database
      // const subscriptions = await prisma.pushSubscription.findMany();
      
      // For now, we'll just log
      console.log('[Notification] Would send to all subscriptions:', payload);
      
      // await Promise.all(
      //   subscriptions.map(sub => this.sendNotification(sub, payload))
      // );
    } catch (error) {
      console.error('[Notification] Error sending notifications to all:', error);
      throw error;
    }
  }

  /**
   * Send a job completion notification
   */
  async sendJobCompletionNotification(jobId: string, jobName?: string): Promise<void> {
    const payload = {
      title: 'Job Completed! 🎉',
      body: jobName 
        ? `Your job "${jobName}" has finished processing.`
        : 'Your recording job has finished processing.',
      icon: '/icon-192x192.png',
      url: `/recordings/${jobId}`,
      jobId,
    };

    await this.sendNotificationToAll(payload);
  }

  /**
   * Send a job failure notification
   */
  async sendJobFailureNotification(jobId: string, jobName?: string): Promise<void> {
    const payload = {
      title: 'Job Failed ❌',
      body: jobName
        ? `Your job "${jobName}" has failed.`
        : 'Your recording job has failed.',
      icon: '/icon-192x192.png',
      url: `/recordings/${jobId}`,
      jobId,
    };

    await this.sendNotificationToAll(payload);
  }
}
