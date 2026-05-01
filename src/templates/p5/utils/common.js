import cache from "./cache.js";
import easing from "./easing.js";
import mappers from "./mappers.js";
import options from "./options.js";
import animation from "./animation.js";

import {
  getP5
} from "@/p5/utils/sketch.js";

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
  return (
    ( paths || options.assets?.[ type ] )
      ?.map( ( path ) => cache.get( `${ type }Map` ).get( path ) )
      .filter( Boolean ) || [
    ]
  );
}

export function getAsset(
  path, type = "images"
) {
  return cache.get( `${ type }Map` ).get( path );
}

export function inverseX(
  x, limit = 1
) {
  const p = getP5();

  return p.map(
    x,
    0,
    limit,
    limit,
    0
  );
}

export function getFixedOrVariableOption(
  option, progression = 1
) {
  const optionConfig = typeof option === "object" ? option : options.sketch?.[ option ];

  if ( !optionConfig ) {
    return;
  }

  const {
    mode
  } = optionConfig;

  if ( "fixed" === mode ) {
    return optionConfig.value;
  }

  if ( "variable" === mode ) {
    const {
      start, end, count, speedMultiplier, progressionMultiplier, easingFn
    } = optionConfig;

    return mappers.fn(
      Math.sin( animation.angle * speedMultiplier +
        progression * progressionMultiplier ),
      -1,
      1,
      start,
      end,
      easing?.[ easingFn ] ?? easing.easeInOutSine
    );
  }
}

export const getLoopMultiplier = ( targetValue ) => {
  const p = getP5();

  return (
    Math.max(
      Math.round( targetValue / p.TAU ),
      1
    ) * p.TAU
  );
};

export function getLoopPhase( components ) {
  return components.reduce(
    (
      previousValue, currentValue
    ) => {
      const [
        value,
        multiplier
      ] = currentValue;

      if ( undefined !== value ) {
        return previousValue + ( value * getLoopMultiplier( multiplier ) );
      }

      return previousValue;
    },
    0
  );
}

export const getVariableOptionValue = (
  optionConfig, component, mapFunction = Math.sin, mapMin = -1, mapMax = 1
) => {
  if ( !optionConfig ) {
    return;
  }

  const {
    x, y, z
  } = component;

  const {
    start, end, xMultiplier, yMultiplier, zMultiplier, generalMultiplier, easingFn
  } = optionConfig;

  const phase = getLoopPhase( [
    [
      x,
      xMultiplier
    ],
    [
      y,
      yMultiplier
    ],
    [
      z,
      zMultiplier
    ]
  ] );

  return mappers.fn(
    mapFunction( phase ),
    mapMin,
    mapMax,
    start,
    end,
    easing?.[ easingFn ] ?? easing.easeInOutSine
  ) * generalMultiplier;
};