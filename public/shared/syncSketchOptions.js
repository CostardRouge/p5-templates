import {
  deepMerge, structuredClone
} from "./utils.js";

export const EVENT = "sketch-options";

let current = globalThis.sketchOptions ?? {
};

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

  current = merged;
  globalThis.sketchOptions = current;

  window.dispatchEvent( new CustomEvent(
    EVENT,
    {
      detail: {
        opts: current,
        origin
      }
    }
  ) );
}

export function subscribeSketchOptions( cb ) {
  const handler = e => {
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

export const getSketchOptions = () => current;