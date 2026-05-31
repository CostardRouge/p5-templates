import {
  getBlobURL
} from "./blobMap";

/**
 * Resolve an asset path (as stored in sketch options) to a URL that can be
 * fed to `<img>`, `<video>`, `<audio>`, p5's `loadImage`, etc.
 *
 * Resolution order:
 *  1. A locally-registered blob URL (fresh upload, no S3 round-trip).
 *  2. An already-absolute URL (`https:` / `blob:`) is returned as-is.
 *  3. A `public/assets/…` path resolves to the static asset folder.
 *  4. Otherwise, when a job `id` is provided, the path resolves through the
 *     S3 proxy route; without an id it falls back to the origin root.
 */
export function resolveAssetURL(
  path: string,
  id?: string
): string {
  if ( !path ) {
    return "";
  }

  const blobURL = getBlobURL( path );

  if ( blobURL ) {
    return blobURL;
  }

  if ( /^(https?:|blob:)/.test( path ) ) {
    return path;
  }

  const normalizedPath = path.replace(
    /^\/+/,
    ""
  );

  if ( /^assets\//.test( normalizedPath ) ) {
    return `${ location.origin }/${ normalizedPath }`;
  }

  return id
    ? `${ location.origin }/api/s3/${ id }/assets/${ normalizedPath }`
    : `${ location.origin }/${ normalizedPath }`;
}
