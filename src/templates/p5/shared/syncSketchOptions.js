import {
  deepMerge, structuredClone
} from "./utils.js";

export const EVENT = "sketch-options";

globalThis.sketchOptions ??= {
};

let current = globalThis.sketchOptions;

export function setSketchOptions(
  update, origin = "react"
) {
  const sourceClone = structuredClone( update );

  const merged = deepMerge(
    structuredClone( current ),
    sourceClone
  );

  if ( JSON.stringify( merged ) === JSON.stringify( current ) ) {
    return;
  }

  // Mutate in place so existing references stay live
  for ( const key of Object.keys( current ) ) {
    if ( !( key in merged ) ) delete current[ key ];
  }

  Object.assign( current, merged );
  globalThis.sketchOptions = current;

  window.dispatchEvent( new CustomEvent(
    EVENT,
    {
      detail: {
        opts: current,
        origin,
      },
    }
  ) );
}

export function subscribeSketchOptions( cb ) {
  const handler = ( e ) => {
    cb(
      e.detail.opts,
      e.detail.origin
    );
  };

  window.addEventListener(
    EVENT,
    handler
  );

  return () => window.removeEventListener(
    EVENT,
    handler
  );
}

export const getSketchOptions = () => globalThis.sketchOptions ?? current;
