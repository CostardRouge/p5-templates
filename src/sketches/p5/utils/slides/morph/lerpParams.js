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
 *     dotted path, leaf name or ancestor
 *     path — see ../keyMatch.js)          → snap (discrete / cache-invalidating)
 *   - nested plain object                 → recurse
 *   - key present on only one side        → passthrough (no NaN)
 *
 * Pure: no p5 / DOM dependency, so it is unit-testable in node.
 */

import sequenceProgress from "./sequenceProgress.js";
import {
  matchesKeyList
} from "../keyMatch.js";

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
  return (
    matchesKeyList(
      path,
      snapKeys
    ) ||
    a == null ||
    b == null ||
    typeof a !== typeof b ||
    typeof a === "boolean" ||
    typeof a === "string"
  );
}

// A leaf morphs when the two sides differ. Arrays compare component-wise so an
// unchanged colour doesn't register as a change.
function leafChanges(
  a, b
) {
  if ( a === b ) {
    return false;
  }

  if ( Array.isArray( a ) && Array.isArray( b ) ) {
    return a.length !== b.length || a.some( (
      v, i
    ) => v !== b[ i ] );
  }

  return true;
}

// `resolveT( path )` returns the morph progress for the leaf at `path`, so the
// same walk serves both a uniform morph (constant t) and a per-parameter
// sequenced one (a different slice of t per changing leaf).
function lerpNode(
  from, to, resolveT, snapKeys, prefix
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
      resolveT,
      path,
      snapKeys
    );
  }

  return out;
}

function lerpValue(
  a, b, resolveT, path, snapKeys
) {
  if ( shouldSnap(
    a,
    b,
    path,
    snapKeys
  ) ) {
    return resolveT( path ) < 0.5 ? a : b;
  }

  if ( typeof a === "number" && typeof b === "number" ) {
    return a + ( b - a ) * resolveT( path );
  }

  if ( Array.isArray( a ) && Array.isArray( b ) ) {
    if ( isEqualLengthNumericArray(
      a,
      b
    ) ) {
      const t = resolveT( path );

      return a.map( (
        v, i
      ) => v + ( b[ i ] - v ) * t );
    }

    return resolveT( path ) < 0.5 ? a : b;
  }

  if ( isPlainObject( a ) && isPlainObject( b ) ) {
    return lerpNode(
      a,
      b,
      resolveT,
      snapKeys,
      path
    );
  }

  return resolveT( path ) < 0.5 ? a : b;
}

// Ordered list of leaf paths that actually change between `from` and `to`,
// following the exact traversal order of lerpNode so indices line up.
function collectChangingLeaves(
  from, to, prefix, snapKeys, out
) {
  const source = from ?? {};
  const target = to ?? {};
  const keys = new Set( [
    ...Object.keys( source ),
    ...Object.keys( target )
  ] );

  for ( const key of keys ) {
    const path = prefix ? `${ prefix }.${ key }` : key;
    const a = source[ key ];
    const b = target[ key ];

    if ( a === undefined || b === undefined ) {
      continue;
    }

    if (
      !shouldSnap(
        a,
        b,
        path,
        snapKeys
      ) &&
      isPlainObject( a ) &&
      isPlainObject( b )
    ) {
      collectChangingLeaves(
        a,
        b,
        path,
        snapKeys,
        out
      );
      continue;
    }

    if ( leafChanges(
      a,
      b
    ) ) {
      out.push( path );
    }
  }

  return out;
}

export default function lerpParams(
  from, to, t, snapKeys = [], prefix = ""
) {
  return lerpNode(
    from,
    to,
    () => t,
    snapKeys,
    prefix
  );
}

/**
 * Like lerpParams, but SEQUENCES the individual parameters that change: each
 * differing leaf (e.g. `sites.count`, `backgroundColor`, `speed`) gets its own
 * slice of the morph window, so they change one after another instead of all at
 * once. `spread` (0..1) sizes the slices — 0 = every changing param moves
 * together (plain lerp); 1 = strictly one param at a time, each over 1/N of the
 * window. Only leaves that actually differ count toward N. Falls back to a plain
 * lerp when 0 or 1 params change.
 */
export function lerpParamsSequenced(
  from, to, t, snapKeys = [], spread = 0
) {
  const source = from ?? {};
  const target = to ?? {};

  if ( spread <= 0 ) {
    return lerpParams(
      source,
      target,
      t,
      snapKeys
    );
  }

  const order = collectChangingLeaves(
    source,
    target,
    "",
    snapKeys,
    []
  );

  if ( order.length <= 1 ) {
    return lerpParams(
      source,
      target,
      t,
      snapKeys
    );
  }

  const indexOf = new Map( order.map( (
    path, index
  ) => [
    path,
    index
  ] ) );
  const resolveT = ( path ) => {
    const index = indexOf.get( path );

    if ( index === undefined ) {
      return t;
    }

    return sequenceProgress(
      t,
      index,
      order.length,
      spread
    );
  };

  return lerpNode(
    source,
    target,
    resolveT,
    snapKeys,
    ""
  );
}
