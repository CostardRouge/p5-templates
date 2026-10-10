// Paths in a field's config that point at ANOTHER field are written relative to
// the field's parent object, so one options module serves the sketch scope and
// every `slides.N.` copy of it alike. Used by the palette picker (where its
// custom look lives) and by `inactiveUnless` (which field switches this one off).

/**
 * Resolve a path written relative to a field's PARENT object: `"stops"` is a
 * sibling, `"../../background"` climbs two levels first. Returns null when the
 * path climbs past the root.
 */
export function resolveRelativePath(
  fieldName: string, relative: string
): string | null {
  const segments = fieldName.split( "." ).slice(
    0,
    -1
  );

  for ( const part of relative.split( "/" ) ) {
    if ( part === "" || part === "." ) {
      continue;
    }

    if ( part === ".." ) {
      if ( segments.length === 0 ) {
        return null;
      }

      segments.pop();
      continue;
    }

    segments.push( part );
  }

  return segments.length > 0 ? segments.join( "." ) : null;
}

export type InactiveUnless = {
  /** The field that decides, relative to this field's parent. */
  field: string;
  /** This field is live only while that one holds this value. */
  equals: unknown;
  /** One line telling the reader why the field is off and how to turn it on. */
  note?: string;
};

/**
 * Whether a field configured with `inactiveUnless` is switched off by the
 * value its deciding field holds. An absent value (a sketch saved before the
 * deciding field existed) never switches anything off.
 */
export function isFieldInactive(
  rule: InactiveUnless | undefined, decidingValue: unknown
): boolean {
  if ( !rule || decidingValue === undefined || decidingValue === null ) {
    return false;
  }

  return String( decidingValue ) !== String( rule.equals );
}
