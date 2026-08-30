// Derive the breakdown's step list: the DIFF of the sketch's parameters.
// Pure: no p5 / DOM / store access — the orchestrator feeds it the merged
// final params and the sketch's form metadata (stock defaults + field
// config).
//
// Grouping: a nested object is one step; an isolated top-level field is its
// OWN step (no shared "PARAMETERS" gathering). Order = config walk order.

import {
  humanizeKey,
  looksLikeColor,
  looksLikeVector,
  nearlyEqual
} from "./format.js";
import {
  matchesKeyList
} from "../keyMatch.js";

// Hard cap so a 100-param sketch stays a watchable narration: overflow steps
// are flagged — they get no schedule window, stay at their final values from
// frame 0 and never reach the counter.
export const MAX_ANIM_STEPS = 24;

// Runtime-only keys that are never part of the visual recipe.
const RESERVED_KEYS = new Set( [
  "bindings",
  "interaction"
] );

function isPlainObject( value ) {
  return value != null && typeof value === "object" && !Array.isArray( value );
}

// Re-exported so the existing importers keep their entry point; the rule now
// lives in ../keyMatch.js because lerpParams' snap check must apply the very
// same one (full path, bare leaf name, or ancestor path).
export {
  matchesKeyList
};

export function getByPath(
  obj, path
) {
  let level = obj;

  for ( const segment of String( path ).split( "." ) ) {
    if ( !isPlainObject( level ) ) {
      return undefined;
    }

    level = level[ segment ];
  }

  return level;
}

/**
 * Resolve a dotted path inside a form configuration, walking nested-object
 * `fields` maps. Returns the FieldConfig or undefined.
 */
export function formConfigAt(
  formConfiguration, path
) {
  if ( !isPlainObject( formConfiguration ) ) {
    return undefined;
  }

  const segments = String( path ).split( "." );

  let level = formConfiguration;

  for ( let i = 0; i < segments.length; i++ ) {
    const entry = level?.[ segments[ i ] ];

    if ( !entry ) {
      return undefined;
    }

    if ( i === segments.length - 1 ) {
      return entry;
    }

    level = entry.fields;
  }

  return undefined;
}

// Classify one leaf value. The form config upgrades ambiguous shapes
// ([r,g,b] vs 3-vector) to certainty; the renderer keys the color chip off
// this.
export function classifyLeaf(
  value, fieldConfig
) {
  if ( fieldConfig?.component === "color" ) {
    return "colors";
  }

  if ( fieldConfig?.component === "vector2d" ) {
    return "vectors";
  }

  if ( typeof value === "number" ) {
    return "numbers";
  }

  if ( typeof value === "boolean" ) {
    return "booleans";
  }

  if ( typeof value === "string" ) {
    return "strings";
  }

  if ( looksLikeVector( value ) ) {
    return "vectors";
  }

  if ( looksLikeColor( value ) ) {
    return "colors";
  }

  return "numbers";
}

/**
 * Does a final value differ from its stock default? Numbers compare with a
 * relative epsilon; a stock value that's missing entirely counts as changed
 * (the param exists only in the tuned version).
 */
export function differs(
  finalValue, stockValue
) {
  if ( stockValue === undefined ) {
    return true;
  }

  if ( typeof finalValue === "number" && typeof stockValue === "number" ) {
    return !nearlyEqual(
      finalValue,
      stockValue
    );
  }

  if ( Array.isArray( finalValue ) ) {
    if ( !Array.isArray( stockValue ) || stockValue.length !== finalValue.length ) {
      return true;
    }

    return finalValue.some( (
      component, i
    ) => (
      typeof component === "number" && typeof stockValue[ i ] === "number"
        ? !nearlyEqual(
          component,
          stockValue[ i ]
        )
        : component !== stockValue[ i ]
    ) );
  }

  return finalValue !== stockValue;
}

// A leaf the animation can meaningfully vary. Arrays are kept only when
// fully numeric (colors / vectors / numeric tuples).
function isAnimatableLeaf( value ) {
  if ( value === null || value === undefined ) {
    return false;
  }

  switch ( typeof value ) {
    case "number":
    case "boolean":
    case "string":
      return true;
    default:
      break;
  }

  return Array.isArray( value ) && value.every( ( v ) => typeof v === "number" );
}

// Depth-first walk collecting animatable leaves as { path, value, cls }.
function collectLeaves(
  node, prefix, excludeKeys, formConfiguration, out
) {
  if ( !isPlainObject( node ) ) {
    return;
  }

  for ( const key of Object.keys( node ) ) {
    if ( !prefix && RESERVED_KEYS.has( key ) ) {
      continue;
    }

    const path = prefix ? `${ prefix }.${ key }` : key;

    if ( matchesKeyList(
      path,
      excludeKeys
    ) ) {
      continue;
    }

    const value = node[ key ];

    if ( isPlainObject( value ) ) {
      collectLeaves(
        value,
        path,
        excludeKeys,
        formConfiguration,
        out
      );
      continue;
    }

    if ( !isAnimatableLeaf( value ) ) {
      continue;
    }

    out.push( {
      path,
      value,
      cls: classifyLeaf(
        value,
        formConfigAt(
          formConfiguration,
          path
        )
      )
    } );
  }
}

// The class a group of leaves reads as: its majority class (first wins ties).
function majorityClass( leaves ) {
  const counts = new Map();

  let best = "numbers";
  let bestCount = 0;

  for ( const leaf of leaves ) {
    const count = ( counts.get( leaf.cls ) ?? 0 ) + 1;

    counts.set(
      leaf.cls,
      count
    );

    if ( count > bestCount ) {
      best = leaf.cls;
      bestCount = count;
    }
  }

  return best;
}

/**
 * Build the ordered step list.
 *
 * Returns [ { id, label, cls, leaves, paths, finalSlice, overflow } ] where
 * `leaves` = [ { path, value, cls } ] (the renderer needs per-leaf classes
 * for the color chip), `paths`/`finalSlice` are derived conveniences for the
 * interpolator, and `overflow` marks steps past MAX_ANIM_STEPS.
 */
export default function deriveBreakdownSteps(
  finalSketch, build = {}, formMeta = {}
) {
  const excludeKeys = build.excludeKeys ?? [];
  const leaves = [];

  collectLeaves(
    finalSketch,
    "",
    excludeKeys,
    formMeta.formConfiguration,
    leaves
  );

  // Diff selection: keep only leaves whose final value differs from the
  // stock default at the same path. Without reachable stock values the diff
  // is undefined — degrade to "all" (documented fallback).
  const stock = formMeta.formValues;
  const useDiff =
    ( build.selection ?? "changed" ) === "changed" &&
    isPlainObject( stock ) &&
    Object.keys( stock ).length > 0;

  const selected = useDiff
    ? leaves.filter( ( leaf ) => differs(
      leaf.value,
      getByPath(
        stock,
        leaf.path
      )
    ) )
    : leaves;

  if ( !selected.length ) {
    return [];
  }

  // Group by top-level key: one step per nested object, and each isolated
  // top-level leaf becomes its own step.
  const steps = [];
  const groupIndex = new Map();

  for ( const leaf of selected ) {
    const dot = leaf.path.indexOf( "." );

    if ( dot === -1 ) {
      steps.push( {
        id: leaf.path,
        label: humanizeKey( leaf.path ),
        leaves: [
          leaf
        ]
      } );
      continue;
    }

    const groupKey = leaf.path.slice(
      0,
      dot
    );

    if ( !groupIndex.has( groupKey ) ) {
      const step = {
        id: groupKey,
        label: humanizeKey( groupKey ),
        leaves: []
      };

      groupIndex.set(
        groupKey,
        step
      );
      steps.push( step );
    }

    groupIndex.get( groupKey ).leaves.push( leaf );
  }

  return steps.map( (
    step, index
  ) => {
    const finalSlice = {};

    for ( const leaf of step.leaves ) {
      finalSlice[ leaf.path ] = leaf.value;
    }

    return {
      id: step.id,
      label: step.label,
      cls: majorityClass( step.leaves ),
      leaves: step.leaves,
      paths: step.leaves.map( ( leaf ) => leaf.path ),
      finalSlice,
      overflow: index >= MAX_ANIM_STEPS
    };
  } );
}
