import path from "node:path";

/**
 * Resolve `segments` against `root` and return the absolute path — or `null`
 * when the result would land outside `root` (a `..` segment, an absolute
 * segment, or anything that normalises to `root` itself).
 *
 * `path.join( root, untrusted )` is NOT a containment check: it normalises
 * `..` away, so `path.join( "/tmp", "../etc/passwd" )` is `/etc/passwd`. Any
 * route that turns a request parameter into a filesystem path goes through
 * this instead.
 */
function resolveInsideDirectory(
  root: string,
  ...segments: string[]
): string | null {
  const base = path.resolve( root );
  const resolved = path.resolve(
    base,
    ...segments
  );
  const relative = path.relative(
    base,
    resolved
  );

  if (
    relative === "" ||
    path.isAbsolute( relative ) ||
    relative.split( path.sep )[ 0 ] === ".."
  ) {
    return null;
  }

  return resolved;
}

export default resolveInsideDirectory;
