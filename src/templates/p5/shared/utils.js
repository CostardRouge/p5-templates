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

