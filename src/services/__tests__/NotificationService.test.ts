import webpush from "web-push";

import {
  NotificationService
} from "@/services/NotificationService";
import {
  prisma
} from "@/lib/connections/prisma";

jest.mock(
  "web-push",
  () => ( {
    __esModule: true,
    default: {
      setVapidDetails: jest.fn(),
      sendNotification: jest.fn()
    }
  } )
);

jest.mock(
  "@/lib/connections/prisma",
  () => ( {
    prisma: {
      pushSubscription: {
        upsert: jest.fn().mockResolvedValue( {} ),
        findMany: jest.fn(),
        delete: jest.fn().mockResolvedValue( {} ),
        deleteMany: jest.fn().mockResolvedValue( {} )
      }
    }
  } )
);

const mockedSend = webpush.sendNotification as jest.Mock;
const subscriptions = prisma.pushSubscription as unknown as Record<string, jest.Mock>;

const KEYS = {
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg"
};

function row(
  id: string, endpoint: string
) {
  return {
    id,
    endpoint,
    p256dh: KEYS.p256dh,
    auth: KEYS.auth
  };
}

describe(
  "NotificationService",
  () => {
    const service = NotificationService.getInstance();
    const backendRecording = process.env.BACKEND_RECORDING;

    beforeEach( () => {
      jest.clearAllMocks();
      process.env.BACKEND_RECORDING = "true";
      jest.spyOn(
        console,
        "log"
      ).mockImplementation( () => {} );
      jest.spyOn(
        console,
        "warn"
      ).mockImplementation( () => {} );
      jest.spyOn(
        console,
        "error"
      ).mockImplementation( () => {} );
    } );

    afterEach( () => {
      process.env.BACKEND_RECORDING = backendRecording;
      jest.restoreAllMocks();
    } );

    describe(
      "storeSubscription",
      () => {
        it(
          "stores a browser push-service subscription",
          async() => {
            await service.storeSubscription( {
              endpoint: "https://fcm.googleapis.com/fcm/send/x",
              keys: KEYS
            } );

            expect( subscriptions.upsert ).toHaveBeenCalledTimes( 1 );
          }
        );

        it.each( [
          [
            "https://minio:9000/recordings"
          ],
          [
            "https://10.0.0.1:6379/x"
          ],
          [
            "http://fcm.googleapis.com/fcm/send/x"
          ]
        ] )(
          "refuses %s without storing it — the server would POST there on every job",
          async( endpoint ) => {
            await expect( service.storeSubscription( {
              endpoint,
              keys: KEYS
            } ) ).rejects.toThrow( "Invalid push subscription" );
            expect( subscriptions.upsert ).not.toHaveBeenCalled();
          }
        );
      }
    );

    describe(
      "sendNotificationToAll",
      () => {
        it(
          "skips stored endpoints that are not push services, and deletes the ones the service says are gone",
          async() => {
            subscriptions.findMany.mockResolvedValue( [
              row(
                "ok",
                "https://fcm.googleapis.com/fcm/send/ok"
              ),
              row(
                "gone",
                "https://updates.push.services.mozilla.com/wpush/v2/gone"
              ),
              row(
                "internal",
                "https://minio:9000/x"
              )
            ] );
            mockedSend.mockImplementation( async( subscription: {
              endpoint: string;
            } ) => {
              if ( subscription.endpoint.endsWith( "/gone" ) ) {
                throw Object.assign(
                  new Error( "Received unexpected response code" ),
                  {
                    statusCode: 410
                  }
                );
              }

              return {
                statusCode: 201
              };
            } );

            await service.sendNotificationToAll( {
              title: "Done",
              body: "Recording finished"
            } );

            expect( mockedSend.mock.calls.map( ( call ) => call[ 0 ].endpoint ) ).toEqual( [
              "https://fcm.googleapis.com/fcm/send/ok",
              "https://updates.push.services.mozilla.com/wpush/v2/gone"
            ] );
            expect( mockedSend.mock.calls[ 0 ][ 2 ] ).toEqual( expect.objectContaining( {
              timeout: expect.any( Number )
            } ) );
            expect( subscriptions.delete ).toHaveBeenCalledWith( {
              where: {
                id: "gone"
              }
            } );
            expect( subscriptions.delete ).toHaveBeenCalledTimes( 1 );
          }
        );
      }
    );
  }
);
