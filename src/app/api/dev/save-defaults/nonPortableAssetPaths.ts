/**
 * Guard for the save-defaults dev endpoint.
 *
 * A checked-in `options.ts` default has no recording/job id to resolve
 * through, so `resolveAssetURL` (`src/lib/assets/resolveAssetURL.ts`) falls
 * back to treating anything that is not `blob:`, not an absolute
 * `http(s):` URL and not rooted at `assets/` (a bundled `public/` file) as
 * an S3 storage key — which only resolves for the account that uploaded it.
 * Persisting one as a shipped default 404s for every other visitor instead
 * (`docs/memory/assets.md`); it has already happened twice
 * (photo-segmentation-v1-mask, photo-segmentation-v2-noise-reveal) from
 * clicking "save current values as defaults" while a personally-uploaded
 * photo was selected.
 */

const ASSET_EXTENSION_RE =
  /\.(png|jpe?g|webp|gif|svg|avif|bmp|arw|mp3|wav|wave|ogg|oga|opus|weba|m4a|aac|flac|aiff?|mp4|webm|mov|mkv|m4v)(\?|#|$)/i;

/** True when `value` looks like an asset path naming an uploaded storage key rather than a bundled/static/absolute one. */
export function isNonPortableAssetPath( value: unknown ): boolean {
  if ( typeof value !== "string" || !value ) {
    return false;
  }

  // A session-local blob URL: meaningless once written to a checked-in file.
  if ( value.startsWith( "blob:" ) ) {
    return true;
  }

  if ( /^https?:/i.test( value ) ) {
    return false;
  }

  if ( /^\/?assets\//i.test( value ) ) {
    return false;
  }

  return ASSET_EXTENSION_RE.test( value );
}

/** Walks a changed leaf value (scalar or array) for every non-portable asset path it contains. */
export function findNonPortableAssetPaths( value: unknown ): string[] {
  if ( typeof value === "string" ) {
    return isNonPortableAssetPath( value ) ? [
      value
    ] : [];
  }

  if ( Array.isArray( value ) ) {
    return value.flatMap( findNonPortableAssetPaths );
  }

  return [];
}
