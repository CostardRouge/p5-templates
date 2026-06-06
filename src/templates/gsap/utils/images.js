/**
 * Image helpers for GSAP/HTML photo templates.
 *
 * The `images-stack` form control stores an array of asset paths under
 * `options.sketch.images` (occasionally as `{ path }` instances). These helpers
 * resolve them to browser-usable URLs — mirroring how the p5 engine resolves
 * image assets — so templates can drop them straight into `<img>`/`background`.
 */
import {
  resolveAssetURL
} from "@/lib/assets/resolveAssetURL";

/** Extract the raw asset path from a string entry or an `{ path }` instance. */
function entryToPath( entry ) {
  if ( !entry ) {
    return "";
  }

  return typeof entry === "string" ? entry : ( entry.path ?? "" );
}

/**
 * Resolve `options.sketch.images` into an array of usable image URLs.
 *
 * `options.id` (the job id, when present) lets uploaded assets resolve through
 * the S3 proxy; bundled test images and blobs resolve without it.
 */
export function resolveImages( options ) {
  const sketch = options?.sketch ?? {};
  const paths = Array.isArray( sketch.images ) ? sketch.images : [];
  const id = options?.id;

  return paths
    .map( ( entry ) => resolveAssetURL(
      entryToPath( entry ),
      id
    ) )
    .filter( Boolean );
}

/**
 * Pick the image URL for a slot, wrapping circularly so a grid/ring/deck with
 * more cells than images keeps repeating instead of leaving gaps. Returns
 * `undefined` when there are no images at all.
 */
export function imageAt(
  urls, index
) {
  if ( !Array.isArray( urls ) || urls.length === 0 ) {
    return undefined;
  }

  return urls[ ( ( index % urls.length ) + urls.length ) % urls.length ];
}
