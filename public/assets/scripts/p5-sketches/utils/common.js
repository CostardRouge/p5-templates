import {
  cache
} from "/assets/scripts/p5-sketches/utils/index.js";

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

export function getAssets(
  options, type = "images", paths = undefined
) {
  return ( paths || options.assets?.[ type ] )
    ?.map( path =>
      cache.get( `${ type }Map` ).get( path ) )
    .filter( Boolean ) || [
  ];
}

export function getAsset(
  path, type = "images"
) {
  return cache.get( `${ type }Map` ).get( path );
}

export function inverseX(
  x, limit = 1
) {
  return map(
    x,
    0,
    limit,
    limit,
    0
  );
}