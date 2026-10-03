import {
  isAllowedPushEndpoint,
  parsePushSubscription
} from "@/lib/pushSubscription";

const KEYS = {
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg"
};

describe(
  "isAllowedPushEndpoint",
  () => {
    it.each( [
      [
        "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH"
      ],
      [
        "https://android.googleapis.com/gcm/send/abc"
      ],
      [
        "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk"
      ],
      [
        "https://web.push.apple.com/QHn7oKlFpm1"
      ],
      [
        "https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB"
      ],
      [
        "https://fcm.googleapis.com:443/fcm/send/x"
      ]
    ] )(
      "accepts a browser push service: %s",
      ( endpoint ) => {
        expect( isAllowedPushEndpoint( endpoint ) ).toBe( true );
      }
    );

    it.each( [
      [
        "http://fcm.googleapis.com/fcm/send/x"
      ],
      [
        "https://fcm.googleapis.com:6379/x"
      ],
      [
        "https://minio:9000/recordings"
      ],
      [
        "https://localhost/x"
      ],
      [
        "https://10.0.0.1/x"
      ],
      [
        "https://169.254.169.254/latest/meta-data"
      ],
      [
        "https://attacker.example/collect"
      ],
      [
        "https://fcm.googleapis.com.attacker.example/x"
      ],
      [
        "https://evilfcm.googleapis.com/x"
      ],
      [
        "https://user:pass@fcm.googleapis.com/x"
      ],
      [
        "not a url"
      ],
      [
        42
      ]
    ] )(
      "refuses %j",
      ( endpoint ) => {
        expect( isAllowedPushEndpoint( endpoint ) ).toBe( false );
      }
    );
  }
);

describe(
  "parsePushSubscription",
  () => {
    it(
      "returns just endpoint and keys for a browser subscription",
      () => {
        expect( parsePushSubscription( {
          endpoint: "https://fcm.googleapis.com/fcm/send/x",
          expirationTime: null,
          keys: KEYS
        } ) ).toEqual( {
          endpoint: "https://fcm.googleapis.com/fcm/send/x",
          keys: KEYS
        } );
      }
    );

    it.each( [
      [
        "no keys",
        {
          endpoint: "https://fcm.googleapis.com/x"
        }
      ],
      [
        "a key outside base64url",
        {
          endpoint: "https://fcm.googleapis.com/x",
          keys: {
            ...KEYS,
            auth: "not base64!"
          }
        }
      ],
      [
        "an internal endpoint",
        {
          endpoint: "https://minio:9000/x",
          keys: KEYS
        }
      ],
      [
        "null",
        null
      ]
    ] )(
      "refuses %s",
      (
        _label, value
      ) => {
        expect( parsePushSubscription( value ) ).toBeNull();
      }
    );
  }
);
