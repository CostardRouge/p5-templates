import {
  NotificationService,
  type PushSubscriptionData
} from "@/services/NotificationService";

/* Store a browser's push subscription (MenuBar, when notifications are on).
   A route rather than the server action it used to be: a server action cannot
   exist in the static export, and importing one from the MenuBar — which both
   builds render — broke that build. Full server only. */
export async function POST( request: Request ) {
  try {
    const subscription = await request.json() as PushSubscriptionData;

    await NotificationService.getInstance().storeSubscription( subscription );

    return Response.json( {
      success: true
    } );
  } catch( error ) {
    console.error(
      "Error subscribing user:",
      error
    );

    return Response.json(
      {
        success: false,
        error: "Failed to subscribe"
      },
      {
        status: 500
      }
    );
  }
}
