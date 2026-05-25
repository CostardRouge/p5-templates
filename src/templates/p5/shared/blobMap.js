export function registerBlob(
  filename, file
) {
  window.__blobAssetMap ??= {};
  window.__blobAssetFiles ??= {};

  /* revoke old url if we re-use the name */
  if ( window.__blobAssetMap[ filename ] ) {
    URL.revokeObjectURL( window.__blobAssetMap[ filename ] );
  }

  window.__blobAssetMap[ filename ] = URL.createObjectURL( file );
  window.__blobAssetFiles[ filename ] = file;
}

export function getBlobFile( filename ) {
  return window.__blobAssetFiles?.[ filename ];
}

export function getBlobFileByURL( url ) {
  const files = window.__blobAssetFiles;
  const urls = window.__blobAssetMap;

  if ( !files || !urls ) {
    return undefined;
  }

  for ( const key of Object.keys( urls ) ) {
    if ( urls[ key ] === url ) {
      return files[ key ];
    }
  }

  return undefined;
}
