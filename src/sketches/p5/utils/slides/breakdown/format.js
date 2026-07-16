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

/**
 * Every text a lerping value can render as, sampled at t = 0, 0.1 … 1.
 * The overlay reserves its value column at the WIDEST of these — measuring
 * only the endpoints under-reserves ("5.13" between "2" and "8") and the
 * panel overflows mid-lerp. Lerps are monotone per component, so a 0.1 grid
 * bounds the real maximum. Snapping values only ever show their endpoints.
 */
export function sampleValueTexts(
  start, final, snap = false
) {
  const endpoints = () =>
    [
      formatValue( start ),
      formatValue( final )
    ].filter( ( text ) => text !== null );

  if (
    snap ||
    start === null ||
    final === null ||
    typeof start === "boolean" ||
    typeof start === "string" ||
    typeof start !== typeof final
  ) {
    return endpoints();
  }

  const lerpNumber = (
    a, b, t
  ) => a + ( b - a ) * t;

  const texts = [];

  for ( let i = 0; i <= 10; i++ ) {
    const t = i / 10;

    let value;

    if ( typeof start === "number" ) {
      value = lerpNumber(
        start,
        final,
        t
      );
    } else if (
      Array.isArray( start ) &&
      Array.isArray( final ) &&
      start.length === final.length
    ) {
      value = start.map( (
        component, k
      ) => (
        typeof component === "number" && typeof final[ k ] === "number"
          ? lerpNumber(
            component,
            final[ k ],
            t
          )
          : t < 0.5 ? component : final[ k ]
      ) );
    } else {
      return endpoints();
    }

    const text = formatValue( value );

    if ( text !== null ) {
      texts.push( text );
    }
  }

  return texts;
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
