import {
  deepMerge, structuredClone
} from "./utils.js";

export const EVENT = "sketch-options";

// Use globalThis as the single source of truth so that every webpack chunk
// (main bundle + dynamically-imported sketch chunks) shares the same object.
if ( !globalThis.sketchOptions ) {
  globalThis.sketchOptions = {};
}

export function setSketchOptions(
  update, origin = "react"
) {
  const sourceClone = structuredClone( update );

  const merged = deepMerge(
    structuredClone( globalThis.sketchOptions ),
    sourceClone
  );

  if ( JSON.stringify( merged ) === JSON.stringify( globalThis.sketchOptions ) ) {
    return;
  }

  // Mutate in place so existing references stay live
  for ( const key of Object.keys( globalThis.sketchOptions ) ) {
    if ( !( key in merged ) ) delete globalThis.sketchOptions[ key ];
  }

  Object.assign( globalThis.sketchOptions, merged );

  window.dispatchEvent( new CustomEvent(
    EVENT,
    {
      detail: {
        opts: globalThis.sketchOptions,
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

export const getSketchOptions = () => globalThis.sketchOptions;
