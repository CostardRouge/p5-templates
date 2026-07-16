// Text formatting shared by the breakdown overlay and its step derivation.
// Pure — no p5 / DOM dependency, so it is unit-testable in node.

export function formatNumber( value ) {
  if ( Number.isInteger( value ) ) {
    return String( value );
  }

  return String( Math.round( value * 100 ) / 100 );
}

export function looksLikeColor( value ) {
  return (
    Array.isArray( value ) &&
    ( value.length === 3 || value.length === 4 ) &&
    value.every( ( v ) => typeof v === "number" )
  );
}

export function looksLikeVector( value ) {
  return (
    Array.isArray( value ) &&
    value.length === 2 &&
    value.every( ( v ) => typeof v === "number" )
  );
}

/**
 * Human-readable one-line rendering of a leaf value, or null for values the
 * breakdown never narrates (functions, exotic objects).
 */
export function formatValue( value ) {
  if ( value === null || value === undefined ) {
    return null;
  }

  switch ( typeof value ) {
    case "number":
      return formatNumber( value );
    case "boolean":
      return value ? "on" : "off";
    case "string":
      return value;
    case "function":
      return null;
    default:
      break;
  }

  if ( Array.isArray( value ) ) {
    if ( looksLikeColor( value ) ) {
      // Whole channels: mid-lerp colours narrate as "rgba(180, 21, 45)"
      // instead of float dust.
      return `rgba(${ value.map( ( channel ) => Math.round( channel ) ).join( ", " ) })`;
    }

    if ( looksLikeVector( value ) ) {
      return `(${ formatNumber( value[ 0 ] ) }, ${ formatNumber( value[ 1 ] ) })`;
    }

    return `[${ value.length }]`;
  }

  return null;
}

// "strokeWeight" / "noise_detail-x" -> "STROKE WEIGHT" / "NOISE DETAIL X"
export function humanizeKey( key ) {
  return String( key )
    .replace(
      /([a-z0-9])([A-Z])/g,
      "$1 $2"
    )
    .replace(
      /[-_.]+/g,
      " "
    )
    .trim()
    .toUpperCase();
}

/**
 * Header counter for the current step:
 *   - "numeric": "2/5"
 *   - "letters": spreadsheet-style A, B, … Z, AA, AB (total not shown)
 */
export function formatCounter(
  index, total, mode = "numeric"
) {
  if ( mode === "letters" ) {
    let n = Math.max(
      0,
      Math.trunc( index )
    );
    let out = "";

    do {
      out = String.fromCharCode( 65 + ( n % 26 ) ) + out;
      n = Math.floor( n / 26 ) - 1;
    } while ( n >= 0 );

    return out;
  }

  return `${ index + 1 }/${ total }`;
}

// Relative-epsilon numeric equality shared by the diff selection (deriveSteps)
// and the min≈final opposite-end rule (startValues).
export function nearlyEqual(
  a, b
) {
  return Math.abs( a - b ) <= 1e-6 * Math.max(
    1,
    Math.abs( a ),
    Math.abs( b )
  );
}
