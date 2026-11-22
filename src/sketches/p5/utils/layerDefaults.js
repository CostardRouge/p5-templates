// What a layer reads when its settings are laid over its sketch's own
// defaults (`nestedSketch.js`, «The layer's own defaults»). Pure, so it is
// tested without the p5 runtime.

export const isPlain = ( value ) => value !== null && typeof value === "object" && !Array.isArray( value );

/** `over` laid on `base`, group by group: a value the layer sets wins whole (arrays included). */
export function withDefaults(
  base, over
) {
  if ( !isPlain( base ) ) {
    return over === undefined ? base : over;
  }
  if ( !isPlain( over ) ) {
    return over === undefined ? base : over;
  }

  const out = {
    ...base
  };

  for ( const key of Object.keys( over ) ) {
    out[ key ] = withDefaults(
      base[ key ],
      over[ key ]
    );
  }

  return out;
}
