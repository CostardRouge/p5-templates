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

export function structuredClone( value ) {
  if ( typeof globalThis.structuredClone === "function" ) {
    return globalThis.structuredClone( value );
  }

  try {
    return new Promise( (
      resolve, reject
    ) => {
      const {
        port1, port2
      } = new MessageChannel();

      port2.onmessage = ( e ) => resolve( e.data );
      port2.onmessageerror = reject;
      port1.postMessage( value );
    } );
  } catch {}

  return JSON.parse( JSON.stringify( value ) );
}
