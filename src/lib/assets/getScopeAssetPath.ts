export type AssetScope =
  | "global"
  | { slide: number };

/**
 * Build the storage path for an asset under either the global pool or a
 * specific slide. The shape `<scope>/<type>/<name>` is the contract shared
 * between client uploads, S3 storage, and sketch-side asset loaders.
 */
export function getScopeAssetPath(
  name: string,
  type: string,
  scope: AssetScope = "global"
): string {
  if ( scope !== "global" && scope?.slide !== undefined ) {
    return `slide-${ scope.slide }/${ type }/${ name }`;
  }

  return `global/${ type }/${ name }`;
}
