import {
  NotificationService
} from "@/services/NotificationService";

/* Forget a browser's push subscription, by endpoint (see ../subscribe). */
export async function POST( request: Request ) {
  try {
    const {
      endpoint
    } = await request.json() as { endpoint?: unknown };

    if ( typeof endpoint !== "string" || !endpoint ) {
      return Response.json(
        {
          success: false,
          error: "Missing endpoint"
        },
        {
          status: 400
        }
      );
    }

    await NotificationService.getInstance().removeSubscription( endpoint );

    return Response.json( {
      success: true
    } );
  } catch( error ) {
    console.error(
      "Error unsubscribing user:",
      error
    );

    return Response.json(
      {
        success: false,
        error: "Failed to unsubscribe"
      },
      {
        status: 500
      }
    );
  }
}
