/**
 * Deep interpolation of two sketch-parameter objects, used by the montage
 * (transition) slide to morph one variant into another over time.
 *
 * Rules (per leaf):
 *   - number                              → linear lerp
 *   - colour array [3-4] / equal-length
 *     all-numeric array                   → component-wise lerp
 *   - boolean / string / enum / type or
 *     length mismatch / null / undefined  → snap (t < 0.5 keeps `from`)
 *   - key listed in `snapKeys` (full
 *     dotted path OR leaf name, e.g.
 *     "seed" matches "sites.seed")        → snap (discrete / cache-invalidating)
 *   - nested plain object                 → recurse
 *   - key present on only one side        → passthrough (no NaN)
 *
 * Pure: no p5 / DOM dependency, so it is unit-testable in node.
 */

function isPlainObject( value ) {
  return value != null && typeof value === "object" && !Array.isArray( value );
}

function isEqualLengthNumericArray(
  a, b
) {
  return (
    Array.isArray( a ) &&
    Array.isArray( b ) &&
    a.length === b.length &&
    a.every( ( v ) => typeof v === "number" ) &&
    b.every( ( v ) => typeof v === "number" )
  );
}

function shouldSnap(
  a, b, path, snapKeys
) {
  const leaf = path.includes( "." ) ? path.slice( path.lastIndexOf( "." ) + 1 ) : path;

  return (
    snapKeys.includes( path ) ||
    snapKeys.includes( leaf ) ||
    a == null ||
    b == null ||
    typeof a !== typeof b ||
    typeof a === "boolean" ||
    typeof a === "string"
  );
}

function lerpValue(
  a, b, t, path, snapKeys
) {
  if ( shouldSnap(
    a,
    b,
    path,
    snapKeys
  ) ) {
    return t < 0.5 ? a : b;
  }

  if ( typeof a === "number" && typeof b === "number" ) {
    return a + ( b - a ) * t;
  }

  if ( Array.isArray( a ) && Array.isArray( b ) ) {
    if ( isEqualLengthNumericArray(
      a,
      b
    ) ) {
      return a.map( (
        v, i
      ) => v + ( b[ i ] - v ) * t );
    }

    return t < 0.5 ? a : b;
  }

  if ( isPlainObject( a ) && isPlainObject( b ) ) {
    return lerpParams(
      a,
      b,
      t,
      snapKeys,
      path
    );
  }

  return t < 0.5 ? a : b;
}

export default function lerpParams(
  from, to, t, snapKeys = [], prefix = ""
) {
  const source = from ?? {};
  const target = to ?? {};
  const keys = new Set( [
    ...Object.keys( source ),
    ...Object.keys( target )
  ] );
  const out = {};

  for ( const key of keys ) {
    const path = prefix ? `${ prefix }.${ key }` : key;
    const a = source[ key ];
    const b = target[ key ];

    if ( a === undefined ) {
      out[ key ] = b;
      continue;
    }

    if ( b === undefined ) {
      out[ key ] = a;
      continue;
    }

    out[ key ] = lerpValue(
      a,
      b,
      t,
      path,
      snapKeys
    );
  }

  return out;
}
