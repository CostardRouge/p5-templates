import * as oauth from "oauth4webapi";

import {
  CALLBACK_PATH, SCOPE, SESAME_CLIENT_ID, SESAME_ISSUER, STOCKAGE_URL
} from "./config";

/**
 * Signing in to Sésame from the TAB: Sketchbook is a static site with no
 * server of its own, so it is a PUBLIC client — authorization code + PKCE,
 * the code exchanged by the page itself (Sésame allows the token endpoint
 * from the origin of a public app's redirect address — its `clientBasedCORS`).
 * The protocol is `oauth4webapi`'s (panva, OpenID-certified), never written
 * here.
 *
 * The access token is for ONE resource, the store (RFC 8707): `resource` goes
 * on the authorization request AND on every token request — the code exchange
 * and each refresh — or Sésame hands back its opaque `/me` token instead.
 *
 * Kept in this browser's `localStorage` (`sketchbook.sesame.v1`), like the
 * Postiz key already is: the refresh token lasts Sésame's session (30 days)
 * and ROTATES on every use, so two tabs must never refresh at once — a reused
 * refresh token makes Sésame revoke the whole grant. Refreshing therefore
 * runs under a Web Lock and re-reads the stored tokens inside it.
 */

const KEY = "sketchbook.sesame.v1";
const PENDING_KEY = "sketchbook.sesame.pending";
const LOCK = "sketchbook-sesame-refresh";
/** Refresh a little before the hour is up, never in the last seconds of a request. */
const MARGIN_MS = 60_000;

export interface SesameSession {
  sub: string;
  name: string | null;
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
  refreshToken: string | null;
  signedInAt: number;
}

interface Pending {
  verifier: string;
  state: string;
  returnTo: string;
}

const client: oauth.Client = {
  client_id: SESAME_CLIENT_ID
};
const clientAuth = oauth.None();
const listeners = new Set<() => void>();
let server: Promise<oauth.AuthorizationServer> | null = null;
let cache: SesameSession | null | undefined;

function storage( kind: "local" | "session" ): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function notify(): void {
  for ( const listener of listeners ) {
    listener();
  }
}

/** A stored session read back, or null when it is not one. Pure. */
export function readSession( raw: unknown ): SesameSession | null {
  if ( !raw || typeof raw !== "object" ) {
    return null;
  }

  const r = raw as Record<string, unknown>;

  if ( typeof r.sub !== "string" || !r.sub || typeof r.accessToken !== "string" || typeof r.expiresAt !== "number" ) {
    return null;
  }

  return {
    sub: r.sub,
    name: typeof r.name === "string" ? r.name : null,
    accessToken: r.accessToken,
    expiresAt: r.expiresAt,
    refreshToken: typeof r.refreshToken === "string" ? r.refreshToken : null,
    signedInAt: typeof r.signedInAt === "number" ? r.signedInAt : 0
  };
}

function load(): SesameSession | null {
  try {
    return readSession( JSON.parse( storage( "local" )?.getItem( KEY ) ?? "null" ) );
  } catch {
    return null;
  }
}

function save( next: SesameSession | null ): void {
  cache = next;
  try {
    if ( next ) {
      storage( "local" )?.setItem(
        KEY,
        JSON.stringify( next )
      );
    } else {
      storage( "local" )?.removeItem( KEY );
    }
  } catch {
    // A private window keeps the session for this visit only.
  }
  notify();
}

export function getSession(): SesameSession | null {
  if ( cache === undefined ) {
    cache = load();
  }

  return cache;
}

export function subscribeSession( listener: () => void ): () => void {
  listeners.add( listener );

  // Another tab signing in or out.
  const onStorage = ( event: StorageEvent ) => {
    if ( event.key === KEY ) {
      cache = load();
      listener();
    }
  };

  window.addEventListener(
    "storage",
    onStorage
  );

  return () => {
    listeners.delete( listener );
    window.removeEventListener(
      "storage",
      onStorage
    );
  };
}

function authorizationServer(): Promise<oauth.AuthorizationServer> {
  if ( !server ) {
    const issuer = new URL( SESAME_ISSUER );

    server = oauth.discoveryRequest(
      issuer,
      {
        algorithm: "oidc"
      }
    ).then( ( response ) => oauth.processDiscoveryResponse(
      issuer,
      response
    ) );
    // A failed discovery (Sésame down) must not stick for the page's life.
    server.catch( () => {
      server = null;
    } );
  }

  return server;
}

function redirectUri(): string {
  return `${ window.location.origin }${ CALLBACK_PATH }`;
}

const resource = (): Record<string, string> => ( {
  resource: STOCKAGE_URL
} );

function sessionFrom(
  tokens: oauth.TokenEndpointResponse, previous: SesameSession | null
): SesameSession {
  const claims = oauth.getValidatedIdTokenClaims( tokens );
  const sub = claims?.sub ?? previous?.sub;

  if ( !sub ) {
    throw new Error( "Sésame answered without saying who signed in" );
  }

  const name = typeof claims?.name === "string" ? claims.name : previous?.name ?? null;

  return {
    sub,
    name,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + ( tokens.expires_in ?? 3600 ) * 1000,
    // A refresh that sends no new one keeps the old (rotation is Sésame's call).
    refreshToken: tokens.refresh_token ?? previous?.refreshToken ?? null,
    signedInAt: previous?.signedInAt ?? Date.now()
  };
}

/** Leave for Sésame; it sends the person back to `CALLBACK_PATH`, then to `returnTo`. */
export async function signIn( returnTo: string = window.location.pathname + window.location.search ): Promise<void> {
  const as = await authorizationServer();
  const verifier = oauth.generateRandomCodeVerifier();
  const state = oauth.generateRandomState();
  const endpoint = as.authorization_endpoint;

  if ( !endpoint ) {
    throw new Error( "Sésame does not say where to sign in" );
  }

  const pending: Pending = {
    verifier,
    state,
    returnTo
  };

  storage( "session" )?.setItem(
    PENDING_KEY,
    JSON.stringify( pending )
  );

  const url = new URL( endpoint );

  url.search = new URLSearchParams( {
    client_id: SESAME_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    ...resource(),
    code_challenge: await oauth.calculatePKCECodeChallenge( verifier ),
    code_challenge_method: "S256",
    state,
    // Sésame grants offline_access (the refresh token) only when consent is asked.
    prompt: "consent"
  } ).toString();
  window.location.assign( url.toString() );
}

/** On the callback page: finish the sign-in, answer where to go back to. */
export async function completeSignIn( current: URL ): Promise<string> {
  let pending: Pending | null = null;

  try {
    pending = JSON.parse( storage( "session" )?.getItem( PENDING_KEY ) ?? "null" ) as Pending | null;
  } catch {
    pending = null;
  }
  storage( "session" )?.removeItem( PENDING_KEY );
  if ( !pending?.verifier || !pending.state ) {
    throw new Error( "This sign-in was not started from this tab — start it again from the menu" );
  }

  const as = await authorizationServer();
  const params = oauth.validateAuthResponse(
    as,
    client,
    current,
    pending.state
  );
  const response = await oauth.authorizationCodeGrantRequest(
    as,
    client,
    clientAuth,
    params,
    redirectUri(),
    pending.verifier,
    {
      additionalParameters: resource()
    }
  );
  const tokens = await oauth.processAuthorizationCodeResponse(
    as,
    client,
    response
  );

  save( sessionFrom(
    tokens,
    null
  ) );

  // Only a path of this site, never another origin handed in the state.
  return pending.returnTo.startsWith( "/" ) && !pending.returnTo.startsWith( "//" ) ? pending.returnTo : "/";
}

async function refresh(): Promise<SesameSession | null> {
  // Re-read inside the lock: another tab may have refreshed while this one waited.
  const stored = load();

  if ( !stored ) {
    save( null );

    return null;
  }
  if ( stored.expiresAt - MARGIN_MS > Date.now() ) {
    cache = stored;

    return stored;
  }
  if ( !stored.refreshToken ) {
    save( null );

    return null;
  }

  const as = await authorizationServer();
  const response = await oauth.refreshTokenGrantRequest(
    as,
    client,
    clientAuth,
    stored.refreshToken,
    {
      additionalParameters: resource()
    }
  );

  try {
    const next = sessionFrom(
      await oauth.processRefreshTokenResponse(
        as,
        client,
        response
      ),
      stored
    );

    save( next );

    return next;
  } catch( error ) {
    // Sésame refused the refresh (signed out there, membership removed, grant revoked): signed out here too.
    if ( error instanceof oauth.ResponseBodyError ) {
      save( null );

      return null;
    }
    throw error;
  }
}

let refreshing: Promise<SesameSession | null> | null = null;

/** A valid access token for the store, refreshed when needed; null when signed out. */
export async function accessToken(): Promise<string | null> {
  const current = getSession();

  if ( !current ) {
    return null;
  }
  if ( current.expiresAt - MARGIN_MS > Date.now() ) {
    return current.accessToken;
  }
  if ( !refreshing ) {
    const run = () => refresh();

    refreshing = ( typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(
        LOCK,
        run
      )
      : run() ).finally( () => {
      refreshing = null;
    } );
  }

  return ( await refreshing )?.accessToken ?? null;
}

/** Forget the session here, and ask Sésame to forget its refresh token. Sésame's own sign-in stays. */
export async function signOut(): Promise<void> {
  const current = getSession();

  save( null );
  if ( current?.refreshToken ) {
    try {
      const as = await authorizationServer();

      await oauth.processRevocationResponse( await oauth.revocationRequest(
        as,
        client,
        clientAuth,
        current.refreshToken
      ) );
    } catch {
      // Signed out here all the same; the token dies with Sésame's session.
    }
  }
}
