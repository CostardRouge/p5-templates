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
 *      controls in the embed.
 *   a  optional autoplay policy: absent → "on" (default), "off" → never
 *      autoplay, "desktop" → autoplay on desktop only (off on touch/mobile).
 *      `prefers-reduced-motion` always wins over this at runtime.
 *   s  optional canvas resolution: `<width>x<height>` pins the sketch to that
 *      size, `fill` sizes the canvas to the iframe itself (and re-sizes it as
 *      the frame resizes). Absent → the sketch's own stored size.
 *   m  optional margin: `1` insets the sketch from the frame edges (the studio
 *      viewport's padded fit). Absent → edge-to-edge, no gutter.
 *
 * `o` is live — swapping it re-parameterises the running sketch. `s` and `m`
 * shape the canvas itself and are read once, at load.
 *
 * base64url (RFC 4648 §5) is used instead of raw `encodeURIComponent(JSON)` so
 * the payload never contains characters a CMS, markdown renderer, or copy-paste
 * step might mangle, and so it reads as one opaque token.
 */

export const EMBED_OPTIONS_HASH_KEY = "o";
export const EMBED_CONTROLS_HASH_KEY = "c";
export const EMBED_AUTOPLAY_HASH_KEY = "a";
export const EMBED_SIZE_HASH_KEY = "s";
export const EMBED_MARGIN_HASH_KEY = "m";

/** Token used by the `s=` key to mean "match the frame". */
export const EMBED_SIZE_FILL = "fill";

// Mirrors SketchSizeSchema's bounds — a hand-edited URL must not be able to
// push the canvas outside what the studio itself allows.
export const EMBED_SIZE_MIN = 50;
export const EMBED_SIZE_MAX = 8192;

/**
 * Autoplay policy baked into a share URL.
 * - `on`      — autoplay everywhere (default; omitted from the URL)
 * - `off`     — never autoplay; the embed shows a poster + play affordance
 * - `desktop` — autoplay on desktop, off on touch/mobile
 */
export type AutoplayPolicy = "on" | "off" | "desktop";

/**
 * Canvas resolution baked into a share URL.
 * - `{ width, height }` — a fixed resolution, fit into the frame
 * - `"fill"`            — track the iframe's own box, re-sizing with it
 * - `null`              — leave the sketch's stored size alone
 */
export type EmbedSize = {
  width: number;
  height: number;
} | typeof EMBED_SIZE_FILL;

export type EmbedHash = {
  /** Decoded sketch-params delta, or null when absent/undecodable. */
  options: Record<string, unknown> | null;
  /** Field paths to expose as controls, or null when unspecified. */
  controls: string[] | null;
  /** Autoplay policy; defaults to "on" when absent or unrecognised. */
  autoplay: AutoplayPolicy;
  /** Canvas resolution override, or null when the sketch's own size stands. */
  size: EmbedSize | null;
  /** Whether the sketch is inset from the frame edges. Defaults to false. */
  margin: boolean;
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

/* ---- size ---------------------------------------------------------- */

/**
 * Parse an `s=` token into a resolution. Returns null for anything that is not
 * `fill` or a pair of in-range integers, so a mangled URL degrades to "use the
 * sketch's own size" instead of booting a 0×0 (or 40000×40000) canvas.
 */
export function parseEmbedSize( value: string | null | undefined ): EmbedSize | null {
  if ( !value ) {
    return null;
  }

  if ( value === EMBED_SIZE_FILL ) {
    return EMBED_SIZE_FILL;
  }

  const match = /^(\d+)x(\d+)$/i.exec( value.trim() );

  if ( !match ) {
    return null;
  }

  const width = Number( match[ 1 ] );
  const height = Number( match[ 2 ] );
  const inRange = ( side: number ) =>
    Number.isFinite( side ) && side >= EMBED_SIZE_MIN && side <= EMBED_SIZE_MAX;

  if ( !inRange( width ) || !inRange( height ) ) {
    return null;
  }

  return {
    width,
    height
  };
}

/** Serialise a resolution back into its `s=` token. Inverse of `parseEmbedSize`. */
export function formatEmbedSize( size: EmbedSize ): string {
  return size === EMBED_SIZE_FILL ? EMBED_SIZE_FILL : `${ size.width }x${ size.height }`;
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
  const rawAutoplay = params.get( EMBED_AUTOPLAY_HASH_KEY );

  return {
    options: rawOptions ? decodeEmbedOptions( rawOptions ) : null,
    controls: rawControls
      ? rawControls
        .split( "," )
        .map( ( path ) => path.trim() )
        .filter( Boolean )
      : null,
    autoplay: rawAutoplay === "off" || rawAutoplay === "desktop"
      ? rawAutoplay
      : "on",
    size: parseEmbedSize( params.get( EMBED_SIZE_HASH_KEY ) ),
    margin: params.get( EMBED_MARGIN_HASH_KEY ) === "1"
  };
}

/**
 * Build the embed URL fragment from a sketch-params delta, an optional control
 * whitelist, and optional extras (autoplay policy, resolution, margin). Inverse
 * of `parseEmbedHash`. Returns "" when there is nothing to encode (so a default
 * share produces a clean, hashless URL). Default-valued extras
 * (`autoplay: "on"`, `margin: false`) are omitted.
 */
export function buildEmbedHash(
  delta: Record<string, unknown>,
  controls?: string[],
  extra?: {
    autoplay?: AutoplayPolicy;
    size?: EmbedSize | null;
    margin?: boolean;
  }
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

  if ( extra?.autoplay === "off" || extra?.autoplay === "desktop" ) {
    params.set(
      EMBED_AUTOPLAY_HASH_KEY,
      extra.autoplay
    );
  }

  if ( extra?.size ) {
    params.set(
      EMBED_SIZE_HASH_KEY,
      formatEmbedSize( extra.size )
    );
  }

  if ( extra?.margin ) {
    params.set(
      EMBED_MARGIN_HASH_KEY,
      "1"
    );
  }

  const query = params.toString();

  return query ? `#${ query }` : "";
}

/**
 * Resolve an autoplay policy to an actual boolean for the current environment.
 * `prefers-reduced-motion` is honoured above everything (accessibility), then
 * the explicit policy, then the desktop/mobile split.
 */
export function resolveAutoplay(
  policy: AutoplayPolicy,
  environment: {
    reducedMotion: boolean;
    mobile: boolean;
  }
): boolean {
  if ( environment.reducedMotion ) {
    return false;
  }

  if ( policy === "off" ) {
    return false;
  }

  if ( policy === "desktop" && environment.mobile ) {
    return false;
  }

  return true;
}
