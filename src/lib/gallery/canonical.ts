/**
 * What makes two documents "the same piece": a canonical JSON form (keys
 * sorted at every level, arrays in order) and a short hash of it. The root
 * `id` is left out — it is the job a document was loaded from, not what the
 * piece looks like.
 */

const VOLATILE_ROOT_KEYS = new Set( [
  "id"
] );

function isPlainObject( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

function canonical(
  value: unknown, root: boolean
): string {
  if ( Array.isArray( value ) ) {
    return `[${ value.map( ( item ) => canonical(
      item,
      false
    ) ).join( "," ) }]`;
  }

  if ( isPlainObject( value ) ) {
    const keys = Object.keys( value )
      .filter( ( key ) => value[ key ] !== undefined && !( root && VOLATILE_ROOT_KEYS.has( key ) ) )
      .sort();

    return `{${ keys.map( ( key ) => `${ JSON.stringify( key ) }:${ canonical(
      value[ key ],
      false
    ) }` ).join( "," ) }}`;
  }

  // JSON.stringify drops functions and symbols; a NaN becomes null, as it would in a file.
  return JSON.stringify( value ) ?? "null";
}

/** The document as one stable string: same content, same string, whatever the key order. */
export function canonicalDocument( options: unknown ): string {
  return canonical(
    options,
    true
  );
}

/** FNV-1a, 32 bits, over UTF-16 code units. */
function fnv1a(
  text: string, seed: number
): number {
  let hash = seed >>> 0;

  for ( let i = 0; i < text.length; i++ ) {
    hash ^= text.charCodeAt( i );
    hash = Math.imul(
      hash,
      0x01000193
    ) >>> 0;
  }

  return hash >>> 0;
}

/**
 * Two independent 32-bit FNV-1a digests of the canonical document plus its
 * length — 64 bits is plenty for "is this the entry I just kept", which only
 * ever compares against the last entry of the same sketch.
 */
export function fingerprintDocument( options: unknown ): string {
  const text = canonicalDocument( options );

  return `${ fnv1a(
    text,
    0x811c9dc5
  ).toString( 16 )
    .padStart(
      8,
      "0"
    ) }${ fnv1a(
    text,
    0x9747b28c
  ).toString( 16 )
    .padStart(
      8,
      "0"
    ) }-${ text.length.toString( 36 ) }`;
}

const ASSET_PATH_RE = /^(global|slide-\d+)\/(images|videos|audios|json)\//;

/**
 * True when the document names an uploaded file anywhere — a `global/…` or
 * `slide-N/…` path (`getScopeAssetPath`), the shape every picked file takes.
 * The gallery keeps no media, so a relaunch of such an entry shows the sketch
 * without them; the card says so.
 */
export function documentHasAssets( options: unknown ): boolean {
  if ( typeof options === "string" ) {
    return ASSET_PATH_RE.test( options );
  }

  if ( Array.isArray( options ) ) {
    return options.some( documentHasAssets );
  }

  if ( isPlainObject( options ) ) {
    return Object.values( options ).some( documentHasAssets );
  }

  return false;
}
