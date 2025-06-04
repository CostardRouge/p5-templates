export function deepMerge(
  target = {
  }, source = {
  }
) {
  if ( typeof target !== "object" || target === null ) return target;
  if ( typeof source !== "object" || source === null ) return target;

  for ( const [
    key,
    value
  ] of Object.entries( source ) ) {
    const tVal = target[ key ];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray( value ) &&
      tVal &&
      typeof tVal === "object" &&
      !Array.isArray( tVal )
    ) {
      deepMerge(
        tVal,
        value
      ); // recurse on nested plain objects
    } else {
      target[ key ] = Array.isArray( value ) ? [
        ...value
      ] : value; // copy / overwrite
    }
  }

  return target;
}