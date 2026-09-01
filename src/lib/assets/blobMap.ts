/**
 * Browser-side registry that maps an asset path (`global/images/foo.png`,
 * `slide-2/videos/clip.mp4`, …) to a transient `blob:` URL created from a
 * `File` the user just dropped in the UI.
 *
 * Sketches resolve a path through `resolveAssetURL`, which prefers a
 * registered blob URL when present so that newly-uploaded files render
 * immediately without a round-trip to S3.
 */
declare global {
  interface Window {
    __blobAssetMap?: Record<string, string>;
    /** Which file each registered path came from — see `registerBlobUnique`. */
    __blobAssetKeys?: Record<string, string>;
  }
}

/**
 * A cheap identity for a picked file.
 *
 * Enough to tell "the user picked this same photo again" from "a different
 * photo that happens to carry the same name", without reading the bytes.
 */
function fileIdentity( file: Blob ): string {
  const named = file as File;

  return `${ named.name ?? "" }:${ file.size }:${ file.type }:${ named.lastModified ?? 0 }`;
}

/** `global/images/photo.jpg` + 2 → `global/images/photo-2.jpg`. */
function suffixPath(
  path: string, index: number
): string {
  const dot = path.lastIndexOf( "." );
  const slash = path.lastIndexOf( "/" );

  return dot > slash
    ? `${ path.slice(
      0,
      dot
    ) }-${ index }${ path.slice( dot ) }`
    : `${ path }-${ index }`;
}

export function registerBlob(
  filename: string, file: Blob
): void {
  window.__blobAssetMap ??= {};
  window.__blobAssetKeys ??= {};

  if ( window.__blobAssetMap[ filename ] ) {
    URL.revokeObjectURL( window.__blobAssetMap[ filename ] );
  }

  window.__blobAssetMap[ filename ] = URL.createObjectURL( file );
  window.__blobAssetKeys[ filename ] = fileIdentity( file );
}

/**
 * Register a file under a path that is not already taken by a *different*
 * file, and return the path it actually got.
 *
 * Asset paths are built from the file's own name (`getScopeAssetPath`), and on
 * a phone that name is a constant: every pick from the iOS camera roll arrives
 * as `image.jpg`. Registering the second photo under the first one's path
 * revoked the first blob URL and left the sketch pointing at a path whose
 * cached image it had already loaded — so the canvas kept showing photo one
 * and only a page reload could dislodge it.
 *
 * Picking the *same* file again is not a collision: it keeps its path, so
 * re-adding a photo does not litter the pool with copies of one image.
 */
export function registerBlobUnique(
  filename: string, file: Blob
): string {
  window.__blobAssetMap ??= {};
  window.__blobAssetKeys ??= {};

  const identity = fileIdentity( file );

  for ( let index = 1; ; index++ ) {
    const candidate = index === 1 ? filename : suffixPath(
      filename,
      index
    );

    if (
      !window.__blobAssetMap[ candidate ] ||
        window.__blobAssetKeys[ candidate ] === identity
    ) {
      registerBlob(
        candidate,
        file
      );

      return candidate;
    }
  }
}

export function getBlobURL( filename: string ): string | undefined {
  return window.__blobAssetMap?.[ filename ];
}

export function revokeBlob( filename: string ): void {
  const url = window.__blobAssetMap?.[ filename ];

  if ( url ) {
    URL.revokeObjectURL( url );
    delete window.__blobAssetMap![ filename ];
    delete window.__blobAssetKeys?.[ filename ];
  }
}
