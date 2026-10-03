/**
 * What a browser's `PushSubscription.toJSON()` hands over, and the check it
 * goes through before it is stored.
 *
 * A stored endpoint is a URL this server POSTs to every time a recording
 * ends, and anyone can store one (the subscribe server action has no auth,
 * see docs/memory/security.md). Unchecked, that is a standing request into
 * whatever the server can reach — `https://minio:9000/…`, the NAS's LAN, a
 * cloud metadata address. So only the browsers' push services are accepted,
 * over HTTPS on the default port.
 */

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const PUSH_SERVICE_HOSTS = [
  // Chrome and the Chromium family (Opera, Brave, Samsung Internet…)
  "fcm.googleapis.com",
  // Legacy GCM endpoints still held by old Chrome subscriptions
  "android.googleapis.com",
  // Firefox: updates.push.services.mozilla.com
  "push.services.mozilla.com",
  // Safari: web.push.apple.com
  "push.apple.com",
  // Edge on Windows: wns2-<region>.notify.windows.com
  "notify.windows.com"
];

export function isAllowedPushEndpoint( endpoint: unknown ): boolean {
  if ( typeof endpoint !== "string" || endpoint.length > 2048 ) {
    return false;
  }

  let url: URL;

  try {
    url = new URL( endpoint );
  } catch {
    return false;
  }

  if (
    url.protocol !== "https:" ||
    ( url.port !== "" && url.port !== "443" ) ||
    url.username !== "" ||
    url.password !== ""
  ) {
    return false;
  }

  const host = url.hostname.toLowerCase();

  return PUSH_SERVICE_HOSTS.some( ( service ) => host === service || host.endsWith( `.${ service }` ) );
}

// The two keys are base64url (RFC 8291): p256dh is a 65-byte point, auth a
// 16-byte secret, so anything long or outside the alphabet is not a key.
const PUSH_KEY = /^[A-Za-z0-9_-]{1,256}={0,2}$/;

export function parsePushSubscription( value: unknown ): PushSubscriptionData | null {
  if ( typeof value !== "object" || value === null ) {
    return null;
  }

  const {
    endpoint, keys
  } = value as {
    endpoint?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };

  if (
    !isAllowedPushEndpoint( endpoint ) ||
    typeof keys !== "object" ||
    keys === null ||
    typeof keys.p256dh !== "string" ||
    typeof keys.auth !== "string" ||
    !PUSH_KEY.test( keys.p256dh ) ||
    !PUSH_KEY.test( keys.auth )
  ) {
    return null;
  }

  return {
    endpoint: endpoint as string,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth
    }
  };
}
