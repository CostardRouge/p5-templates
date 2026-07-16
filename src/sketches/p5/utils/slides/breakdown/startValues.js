// Build the parameter object the breakdown animates FROM. No randomness:
// each value departs deterministically toward the "opposite" end of its own
// range and travels back to the final value.
//
// Per-leaf rule:
//   candidate = the field's form MIN; if min ≈ final (relative epsilon) the
//   candidate flips to MAX — the opposite end. Then `departure` (0..1)
//   scales how far the start actually sits:
//     start = final + ( candidate − final ) × departure
//   1 = full opposite/min, 0.1 = already close (the breakdown just
//   "stabilizes" the sketch), 0 = identity (nothing moves).
//
// Colors invert per RGB channel (alpha kept); booleans flip when departure
// ≥ 0.5 (they snap mid-window anyway); strings/enums keep their final value
// (narrating a fake enum reads wrong). Pure and rng-free → identical between
// live preview and deterministic capture by construction.

import {
  looksLikeColor,
  nearlyEqual
} from "./format.js";
import {
  matchesKeyList,
  formConfigAt
} from "./deriveSteps.js";

const RESERVED_KEYS = new Set( [
  "bindings",
  "interaction"
] );

function isPlainObject( value ) {
  return value != null && typeof value === "object" && !Array.isArray( value );
}

// Numeric range of a form field, when it exposes one. For a leaf nested
// under a vector2d pad ("position.x"), the range comes from the pad's shared
// + per-axis config.
function numericRange(
  fieldConfig, axis
) {
  if ( !fieldConfig ) {
    return null;
  }

  if (
    fieldConfig.component === "slider" ||
    fieldConfig.component === "number"
  ) {
    if (
      typeof fieldConfig.min === "number" &&
      typeof fieldConfig.max === "number"
    ) {
      return {
        min: fieldConfig.min,
        max: fieldConfig.max,
        step: fieldConfig.step
      };
    }

    return null;
  }

  if ( fieldConfig.component === "vector2d" && axis ) {
    const allowNegative = fieldConfig.allowNegative ?? true;
    const min = fieldConfig.min ?? ( allowNegative ? -1 : 0 );
    const max = fieldConfig.max ?? 1;
    const perAxis = axis === "x" ? fieldConfig.xAxis : fieldConfig.yAxis;

    return {
      min: perAxis?.min ?? min,
      max: perAxis?.max ?? max,
      step: perAxis?.step ?? fieldConfig.step
    };
  }

  return null;
}

function snapToStep(
  value, range
) {
  if ( typeof range?.step !== "number" || range.step <= 0 ) {
    return value;
  }

  const snapped = range.min + Math.round( ( value - range.min ) / range.step ) * range.step;

  // Avoid float dust on integer steps (a start of 4.000000000000001 narrates
  // badly in the overlay).
  return Number.isInteger( range.step ) ? Math.round( snapped ) : snapped;
}

// Departure-scaled travel from the final value toward a candidate.
function departFrom(
  finalValue, candidate, departure
) {
  return finalValue + ( candidate - finalValue ) * departure;
}

function startNumber(
  finalValue, departure, range
) {
  if ( range ) {
    const candidate = nearlyEqual(
      range.min,
      finalValue
    )
      ? range.max
      : range.min;

    return snapToStep(
      departFrom(
        finalValue,
        candidate,
        departure
      ),
      range
    );
  }

  // No form range: head toward 0, or toward 1 when the final IS 0.
  const candidate = nearlyEqual(
    finalValue,
    0
  ) ? 1 : 0;
  const start = departFrom(
    finalValue,
    candidate,
    departure
  );

  return Number.isInteger( finalValue ) ? Math.round( start ) : start;
}

/**
 * One leaf's start value.
 */
function startLeaf(
  finalValue, departure, fieldConfig, axis
) {
  if ( typeof finalValue === "number" ) {
    return startNumber(
      finalValue,
      departure,
      numericRange(
        fieldConfig,
        axis
      )
    );
  }

  if ( typeof finalValue === "boolean" ) {
    return departure >= 0.5 ? !finalValue : finalValue;
  }

  if ( typeof finalValue === "string" ) {
    return finalValue;
  }

  if ( Array.isArray( finalValue ) ) {
    const isColor =
      fieldConfig?.component === "color" || looksLikeColor( finalValue );

    if ( isColor ) {
      // Opposite = inverted RGB; alpha (index 3) kept — a transparent start
      // would hide the whole travel.
      return finalValue.map( (
        channel, i
      ) => (
        i === 3
          ? channel
          : Math.round( departFrom(
            channel,
            255 - channel,
            departure
          ) )
      ) );
    }

    return finalValue.map( ( component ) => (
      typeof component === "number"
        ? startNumber(
          component,
          departure,
          null
        )
        : component
    ) );
  }

  return finalValue;
}

function buildLevel(
  node, prefix, context
) {
  const out = {};

  for ( const key of Object.keys( node ) ) {
    if ( !prefix && RESERVED_KEYS.has( key ) ) {
      out[ key ] = node[ key ];
      continue;
    }

    const path = prefix ? `${ prefix }.${ key }` : key;
    const value = node[ key ];

    if ( isPlainObject( value ) ) {
      out[ key ] = buildLevel(
        value,
        path,
        context
      );
      continue;
    }

    // Excluded / snap keys keep their final value (excluded also gets no
    // step; snap keys flip mid-window via lerpParams' snap rule anyway).
    if (
      matchesKeyList(
        path,
        context.excludeKeys
      ) ||
      matchesKeyList(
        path,
        context.snapKeys
      )
    ) {
      out[ key ] = value;
      continue;
    }

    let fieldConfig = formConfigAt(
      context.formConfiguration,
      path
    );
    let axis;

    // A number under a vector2d pad has its config on the PARENT path.
    if ( !fieldConfig && prefix && ( key === "x" || key === "y" ) ) {
      const parent = formConfigAt(
        context.formConfiguration,
        prefix
      );

      if ( parent?.component === "vector2d" ) {
        fieldConfig = parent;
        axis = key;
      }
    }

    out[ key ] = startLeaf(
      value,
      context.departure,
      fieldConfig,
      axis
    );
  }

  return out;
}

/**
 * Build the start-parameter object, same shape as `finalSketch`.
 *
 * `formMeta` is `{ formValues, formConfiguration }` from the sketch's
 * options.ts (via the window.getSketchFormMeta bridge) — optional; without
 * it the numeric heuristics take over (bare capture harness).
 */
export default function buildStartValues(
  finalSketch, build = {}, formMeta = {}
) {
  if ( !isPlainObject( finalSketch ) ) {
    return {};
  }

  return buildLevel(
    finalSketch,
    "",
    {
      departure: build.departure ?? 1,
      snapKeys: build.snapKeys ?? [
        "seed"
      ],
      excludeKeys: build.excludeKeys ?? [],
      formConfiguration: formMeta.formConfiguration
    }
  );
}
