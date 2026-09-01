import {
  mergeChangedInPlace
} from "./utils.js";

export const EVENT = "sketch-options";

globalThis.sketchOptions ??= {};

let current = globalThis.sketchOptions;

export function setSketchOptions(
  update, origin = "react"
) {
  // Mutate the store in place so existing references stay live, writing (and
  // cloning) only the values that actually changed — no full-tree clones or
  // JSON round-trips per update; this runs at pointer-drag frequency.
  if ( !mergeChangedInPlace(
    current,
    update
  ) ) {
    return;
  }

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
