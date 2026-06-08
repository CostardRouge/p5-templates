/**
 * URL resolution for the QR code content item, kept dependency-free (no p5,
 * no window, no qrcode) so it can be unit-tested in isolation. The renderer
 * (drawSlideQrCode.js) feeds it the runtime values.
 *
 * The encoded URL is built from two parts:
 *   - origin: domain override -> NEXT_PUBLIC_SITE_URL -> the live page origin.
 *     This lets a localhost dev machine generate content that still points at
 *     the production domain.
 *   - path: always the live page's path (+ query + hash), with the headless
 *     capture params stripped so a recorded/thumbnailed QR points at the real
 *     experience, not the internal capture URL.
 */

// Query params injected by the headless capture pipeline (see the studio route).
const CAPTURE_PARAMS = [
  "capturing",
  "previewFramerate",
  "previewDuration"
];

/**
 * Normalise an origin: trim, drop trailing slashes, and assume https when no
 * scheme is given (production is https). Returns "" for empty input.
 */
export function normaliseBase( base ) {
  const trimmed = ( base || "" ).trim()
    .replace(
      /\/+$/,
      ""
    );

  if ( !trimmed ) {
    return "";
  }

  return /^https?:\/\//i.test( trimmed ) ? trimmed : `https://${ trimmed }`;
}

/** Drop the scheme for display — "https://" adds nothing to a printed URL. */
export function stripScheme( url ) {
  return ( url || "" ).replace(
    /^https?:\/\//i,
    ""
  );
}

/**
 * Build the absolute URL to encode.
 * @param {object}  args
 * @param {string} [args.domainOverride] per-item origin override
 * @param {string} [args.siteUrl]        NEXT_PUBLIC_SITE_URL value
 * @param {string} [args.href]           live page href (window.location.href)
 * @returns {string} absolute URL, or "" when no origin can be determined
 */
export function buildQrUrl( {
  domainOverride = "",
  siteUrl = "",
  href = ""
} = {} ) {
  let parsed = null;

  try {
    parsed = href ? new URL( href ) : null;
  } catch {
    parsed = null;
  }

  const base =
    normaliseBase( domainOverride ) ||
    normaliseBase( siteUrl ) ||
    ( parsed ? parsed.origin : "" );

  if ( !base ) {
    return "";
  }

  let path = "";

  if ( parsed ) {
    CAPTURE_PARAMS.forEach( ( param ) => parsed.searchParams.delete( param ) );
    path = `${ parsed.pathname }${ parsed.search }${ parsed.hash }`;
  }

  return `${ base }${ path }`;
}
