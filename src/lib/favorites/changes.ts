/**
 * The favourites editor's batch (`docs/memory/sketches.md`): which sketches
 * gain or lose their star, keyed `<engine>/<name>` as the publish store and
 * the planner key a sketch. Checked as if the caller were hostile — the route
 * that takes it writes files. Pure.
 */

const KEY = /^(p5|gsap|threejs|html)\/[a-z0-9][a-z0-9-]{0,119}$/;

/** More than the catalogue will hold for a while; a batch past it is not the editor's. */
export const MAX_CHANGES = 600;

export function isSketchKey( key: unknown ): key is string {
  return typeof key === "string" && KEY.test( key );
}

/** The request body, checked: `{ changes: { "<engine>/<name>": boolean } }`. Throws with the reason. */
export function parseFavoriteChanges( body: unknown ): Map<string, boolean> {
  const changes = ( body as { changes?: unknown } | null )?.changes;

  if ( !changes || typeof changes !== "object" || Array.isArray( changes ) ) {
    throw new Error( "expected { changes: { \"engine/name\": boolean } }" );
  }

  const out = new Map<string, boolean>();

  for ( const [
    key,
    value
  ] of Object.entries( changes ) ) {
    if ( !isSketchKey( key ) ) {
      throw new Error( `not a sketch: ${ JSON.stringify( key ).slice(
        0,
        60
      ) }` );
    }
    if ( typeof value !== "boolean" ) {
      throw new Error( `${ key }: expected true or false` );
    }
    out.set(
      key,
      value
    );
  }

  if ( out.size === 0 || out.size > MAX_CHANGES ) {
    throw new Error( `expected 1 to ${ MAX_CHANGES } changes` );
  }

  return out;
}

/** `/sketches/p5/materials/materials-v1-flame` → `p5/materials-v1-flame`; null for anything else. */
export function sketchKeyOfHref( href: string ): string | null {
  const parts = href.split( "/" ).filter( Boolean );

  if ( parts[ 0 ] !== "sketches" || parts.length < 3 || parts.length > 4 ) {
    return null;
  }

  const key = `${ parts[ 1 ] }/${ parts[ parts.length - 1 ] }`;

  return isSketchKey( key ) ? key : null;
}

/** True when the request comes from this machine and from this site's own page. */
export function localSameOrigin(
  host: string | null, origin: string | null
): boolean {
  const name = ( host ?? "" ).replace(
    /:\d+$/,
    ""
  );

  if ( ![
    "localhost",
    "127.0.0.1",
    "[::1]"
  ].includes( name ) ) {
    return false;
  }
  if ( origin === null ) {
    return true;
  }

  try {
    return new URL( origin ).host === host;
  } catch {
    return false;
  }
}
