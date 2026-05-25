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
  }
}

export function registerBlob(
  filename: string, file: Blob
): void {
  window.__blobAssetMap ??= {};

  if ( window.__blobAssetMap[ filename ] ) {
    URL.revokeObjectURL( window.__blobAssetMap[ filename ] );
  }

  window.__blobAssetMap[ filename ] = URL.createObjectURL( file );
}

export function getBlobURL( filename: string ): string | undefined {
  return window.__blobAssetMap?.[ filename ];
}

export function revokeBlob( filename: string ): void {
  const url = window.__blobAssetMap?.[ filename ];

  if ( url ) {
    URL.revokeObjectURL( url );
    delete window.__blobAssetMap![ filename ];
  }
}
