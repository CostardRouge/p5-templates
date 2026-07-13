/**
 * URL codec for embeddable sketches.
 *
 * The embed route (`/embed/[engine]/[...sketch]`) is fully stateless: the
 * sketch parameters that differ from the template defaults travel in the URL
 * fragment, never the query string, so they never reach the server, survive a
 * static host, and carry no privacy footprint. There is no database, no preset
 * id, no round-trip.
 *
 * Wire format — everything lives in the hash:
 *
 *   /embed/p5/noise-strips/noise-strips-v1#o=<base64url>&c=noise.seed,grid.rows
 *
 *   o  base64url( JSON( sketch-params delta ) ) — merged over the template's
 *      `formValues` defaults at mount. Only the changed values need to be
 *      encoded, which keeps typical share URLs short; a full `sketch` object is
 *      equally valid (it just merges over defaults that already match).
 *   c  optional comma-separated whitelist of field paths to expose as live
 *      controls in the embed (consumed in a later phase — parsed here so the
 *      wire format is stable from the start).
 *
 * base64url (RFC 4648 §5) is used instead of raw `encodeURIComponent(JSON)` so
 * the payload never contains characters a CMS, markdown renderer, or copy-paste
 * step might mangle, and so it reads as one opaque token.
 */

export const EMBED_OPTIONS_HASH_KEY = "o";
export const EMBED_CONTROLS_HASH_KEY = "c";

export type EmbedHash = {
  /** Decoded sketch-params delta, or null when absent/undecodable. */
  options: Record<string, unknown> | null;
  /** Field paths to expose as controls, or null when unspecified. */
  controls: string[] | null;
};

/* ---- base64url ---------------------------------------------------- */

function bytesToBase64Url( bytes: Uint8Array ): string {
  let binary = "";

  for ( let i = 0; i < bytes.length; i++ ) {
    binary += String.fromCharCode( bytes[ i ] );
  }

  return btoa( binary )
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/,
      ""
    );
}

function base64UrlToBytes( value: string ): Uint8Array {
  const normalized = value
    .replace(
      /-/g,
      "+"
    )
    .replace(
      /_/g,
      "/"
    );
  const padded = normalized + "=".repeat( ( 4 - ( normalized.length % 4 ) ) % 4 );
  const binary = atob( padded );
  const bytes = new Uint8Array( binary.length );

  for ( let i = 0; i < binary.length; i++ ) {
    bytes[ i ] = binary.charCodeAt( i );
  }

  return bytes;
}

/* ---- encode / decode ---------------------------------------------- */

/**
 * Encode a sketch-params delta into the opaque `o=` token. Unicode-safe.
 */
export function encodeEmbedOptions( delta: Record<string, unknown> ): string {
  const json = JSON.stringify( delta ?? {} );

  return bytesToBase64Url( new TextEncoder().encode( json ) );
}

/**
 * Decode an `o=` token back into a plain object. Returns null on any malformed
 * input (bad base64, non-JSON, or a non-object payload) so a corrupted URL
 * degrades to "render the defaults" instead of throwing.
 */
export function decodeEmbedOptions( encoded: string ): Record<string, unknown> | null {
  try {
    const json = new TextDecoder().decode( base64UrlToBytes( encoded ) );
    const parsed = JSON.parse( json );

    if ( parsed && typeof parsed === "object" && !Array.isArray( parsed ) ) {
      return parsed as Record<string, unknown>;
    }

    return null;
  } catch {
    return null;
  }
}

/* ---- delta vs defaults -------------------------------------------- */

const UNCHANGED = Symbol( "unchanged" );

function isPlainObject( value: unknown ): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

function diffValue(
  current: unknown,
  base: unknown
): unknown | typeof UNCHANGED {
  if ( isPlainObject( current ) && isPlainObject( base ) ) {
    const out: Record<string, unknown> = {};

    for ( const key of Object.keys( current ) ) {
      const diff = diffValue(
        current[ key ],
        base[ key ]
      );

      if ( diff !== UNCHANGED ) {
        out[ key ] = diff;
      }
    }

    return Object.keys( out ).length > 0 ? out : UNCHANGED;
  }

  // Arrays and primitives compare whole (JSON): a changed array ships in full.
  return JSON.stringify( current ) === JSON.stringify( base ) ? UNCHANGED : current;
}

/**
 * Minimal delta of a sketch's current params against its template defaults —
 * only changed leaves survive, so a share URL stays short. Feed the result to
 * `encodeEmbedOptions` / `buildEmbedHash`. Keys present in defaults but dropped
 * from current are not represented (the embed merges onto defaults anyway).
 */
export function diffSketchOptions(
  current: Record<string, unknown> | undefined,
  defaults: Record<string, unknown> | undefined
): Record<string, unknown> {
  const diff = diffValue(
    current ?? {},
    defaults ?? {}
  );

  return diff === UNCHANGED || !isPlainObject( diff ) ? {} : diff;
}

/* ---- hash parsing ------------------------------------------------- */

/**
 * Parse an embed URL fragment (with or without the leading `#`) into its
 * decoded options delta and control whitelist.
 */
export function parseEmbedHash( hash: string ): EmbedHash {
  const params = new URLSearchParams( hash.replace(
    /^#/,
    ""
  ) );
  const rawOptions = params.get( EMBED_OPTIONS_HASH_KEY );
  const rawControls = params.get( EMBED_CONTROLS_HASH_KEY );

  return {
    options: rawOptions ? decodeEmbedOptions( rawOptions ) : null,
    controls: rawControls
      ? rawControls
        .split( "," )
        .map( ( path ) => path.trim() )
        .filter( Boolean )
      : null
  };
}

/**
 * Build the embed URL fragment from a sketch-params delta and an optional
 * control whitelist. Inverse of `parseEmbedHash`. Returns "" when there is
 * nothing to encode (so a default share produces a clean, hashless URL).
 */
export function buildEmbedHash(
  delta: Record<string, unknown>,
  controls?: string[]
): string {
  const params = new URLSearchParams();
  const hasDelta = delta && Object.keys( delta ).length > 0;

  if ( hasDelta ) {
    params.set(
      EMBED_OPTIONS_HASH_KEY,
      encodeEmbedOptions( delta )
    );
  }

  if ( controls && controls.length > 0 ) {
    params.set(
      EMBED_CONTROLS_HASH_KEY,
      controls.join( "," )
    );
  }

  const query = params.toString();

  return query ? `#${ query }` : "";
}
