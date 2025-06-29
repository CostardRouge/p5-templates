export function registerBlob(
  filename, file
) {
  window.__blobAssetMap ??= {
  };

  /* revoke old url if we re-use the name */
  if ( window.__blobAssetMap[ filename ] ) {
    URL.revokeObjectURL( window.__blobAssetMap[ filename ] );
  }

  window.__blobAssetMap[ filename ] = URL.createObjectURL( file );
}
