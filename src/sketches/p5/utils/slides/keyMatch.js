/**
 * The one matching rule for user-supplied key lists (`snapKeys`,
 * `excludeKeys`): shared by the breakdown's step derivation, its start-value
 * builder and the montage's `lerpParams`, so a key typed once behaves the same
 * everywhere.
 *
 * An entry matches a leaf path when it is:
 *   - the full dotted path            ("colors.text" matches "colors.text")
 *   - the bare leaf name              ("seed" matches "sites.seed")
 *   - an ancestor path of the leaf    ("colors" matches "colors.text")
 *
 * The ancestor rule is what lets the options UI offer a whole group as one
 * entry. A bare mid-path segment is NOT an ancestor match ("cell" does not
 * cover "grid.cell.size") — a group is picked by its path.
 *
 * Pure: no p5 / DOM dependency.
 */
export function matchesKeyList(
  path, keys
) {
  if ( !Array.isArray( keys ) || !keys.length ) {
    return false;
  }

  const fullPath = String( path );
  const leaf = fullPath.includes( "." )
    ? fullPath.slice( fullPath.lastIndexOf( "." ) + 1 )
    : fullPath;

  return keys.some( ( key ) => (
    key === fullPath ||
    key === leaf ||
    fullPath.startsWith( `${ key }.` )
  ) );
}

export default matchesKeyList;
