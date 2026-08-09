/**
 * Asset-related helpers (`resolveAssetURL`, `getScopeAssetPath`) have moved
 * to `@/lib/assets` so they can be consumed by any rendering engine. They
 * are re-exported here only to keep existing imports working — prefer
 * importing from `@/lib/assets` in new code.
 *
 * `deepMerge` and `structuredClone` remain here for now: they are not
 * asset-specific and only used by the option-sync layer.
 */
export {
  resolveAssetURL
} from "@/lib/assets/resolveAssetURL";
export {
  getScopeAssetPath
} from "@/lib/assets/getScopeAssetPath";

export function deepMerge(
  targetObject, sourceObject
) {
  if ( typeof targetObject !== "object" || targetObject === null ) {
    return sourceObject;
  }
  if ( typeof sourceObject !== "object" || sourceObject === null ) {
    return targetObject;
  }

  const mergedObject = Array.isArray( targetObject )
    ? [
      ...targetObject
    ]
    : {
      ...targetObject
    };

  for ( const key of Object.keys( sourceObject ) ) {
    const sourceValue = sourceObject[ key ];
    const targetValue = mergedObject[ key ];

    if (
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray( sourceValue )
    ) {
      mergedObject[ key ] = deepMerge(
        targetValue || {},
        sourceValue
      );
    } else {
      mergedObject[ key ] = sourceValue;
    }
  }

  return mergedObject;
}

function isMergeableObject( value ) {
  return typeof value === "object" && value !== null && !Array.isArray( value );
}

export function valuesEqual(
  a, b
) {
  if ( a === b ) {
    return true;
  }
  // NaN === NaN is false; treat two NaNs as equal so they don't read as a
  // fresh change on every comparison.
  if ( a !== a && b !== b ) {
    return true;
  }
  if ( Array.isArray( a ) && Array.isArray( b ) ) {
    return a.length === b.length && a.every( (
      item, index
    ) => valuesEqual(
      item,
      b[ index ]
    ) );
  }
  if ( isMergeableObject( a ) && isMergeableObject( b ) ) {
    const keys = Object.keys( a );

    return keys.length === Object.keys( b ).length && keys.every( ( key ) => valuesEqual(
      a[ key ],
      b[ key ]
    ) );
  }

  return false;
}

/**
 * Deep-merges `source` into `target` by mutating `target`, writing (a clone
 * of) each source value only where it actually differs. Returns whether
 * anything changed. One walk of `source`, no full-tree clones — this runs at
 * pointer-drag frequency in the option-sync layer, where cloning and
 * re-serialising the whole options tree on every tick starves low-memory
 * (mobile) devices.
 */
export function mergeChangedInPlace(
  target, source
) {
  let changed = false;

  for ( const key of Object.keys( source ) ) {
    const sourceValue = source[ key ];
    const targetValue = target[ key ];

    if ( targetValue === sourceValue ) {
      continue;
    }

    if ( isMergeableObject( sourceValue ) && isMergeableObject( targetValue ) ) {
      if ( mergeChangedInPlace(
        targetValue,
        sourceValue
      ) ) {
        changed = true;
      }
    } else if ( !valuesEqual(
      targetValue,
      sourceValue
    ) ) {
      target[ key ] =
        typeof sourceValue === "object" && sourceValue !== null
          ? structuredClone( sourceValue )
          : sourceValue;
      changed = true;
    }
  }

  return changed;
}

export function structuredClone( value ) {
  if ( typeof globalThis.structuredClone === "function" ) {
    return globalThis.structuredClone( value );
  }

  // Callers expect a synchronous clone, so the only viable fallback is the
  // JSON round-trip (the old MessageChannel trick is async-only — it returned
  // a pending Promise instead of a clone).
  return JSON.parse( JSON.stringify( value ) );
}
