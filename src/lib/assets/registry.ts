/**
 * Engine-agnostic asset registry.
 *
 * Owns the in-browser mapping from asset path → `blob:` URL and from
 * asset path → original `File` reference. Any engine (p5, GSAP, …) and
 * any React form component can read/write through this module.
 *
 * Two parallel maps are kept on `window`:
 *   - `__blobAssetMap`   path → blob: URL (consumed by image loaders)
 *   - `__blobAssetFiles` path → File      (consumed by EXIF / raw byte reads)
 *
 * Keeping the original File around lets us read the bytes a second time
 * (e.g. for EXIF) without re-fetching the blob: URL, which a normal
 * `fetch()` would still re-read in full.
 */

export type AssetScope =
  | "global"
  | {
    slide: number;
  };

export type AssetType = "images" | "videos" | "audios" | "json";

function ensureMaps(): void {
  if ( typeof window === "undefined" ) {
    return;
  }
  window.__blobAssetMap ??= {};
  window.__blobAssetFiles ??= {};
}

export function registerBlob(
  path: string,
  file: File
): void {
  ensureMaps();

  if ( typeof window === "undefined" ) {
    return;
  }

  const existing = window.__blobAssetMap?.[ path ];

  if ( existing ) {
    URL.revokeObjectURL( existing );
  }

  window.__blobAssetMap![ path ] = URL.createObjectURL( file );
  window.__blobAssetFiles![ path ] = file;
}

export function unregisterBlob( path: string ): void {
  if ( typeof window === "undefined" ) {
    return;
  }

  const url = window.__blobAssetMap?.[ path ];

  if ( url ) {
    URL.revokeObjectURL( url );
    delete window.__blobAssetMap![ path ];
  }

  if ( window.__blobAssetFiles?.[ path ] ) {
    delete window.__blobAssetFiles![ path ];
  }
}

export function getBlobURL( path: string ): string | undefined {
  if ( typeof window === "undefined" ) {
    return undefined;
  }
  return window.__blobAssetMap?.[ path ];
}

export function getBlobFile( path: string ): File | undefined {
  if ( typeof window === "undefined" ) {
    return undefined;
  }
  return window.__blobAssetFiles?.[ path ];
}

/**
 * Resolve a path declared in sketch options into a URL the browser can load.
 * Local blob registrations win; remote paths fall back to the public
 * `/assets/…` location or to the per-recording S3 namespace when `id` is set.
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

  if ( /^(https?:|blob:|data:)/.test( path ) ) {
    return path;
  }

  if ( typeof location === "undefined" ) {
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

/**
 * Build the canonical storage path for an asset uploaded through the form,
 * scoped either globally or to a specific slide.
 */
export function getScopeAssetPath(
  name: string,
  type: AssetType | string,
  scope: AssetScope = "global"
): string {
  if ( scope !== "global" && scope?.slide !== undefined ) {
    return `slide-${ scope.slide }/${ type }/${ name }`;
  }

  return `global/${ type }/${ name }`;
}
