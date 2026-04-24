/**
 * Engine-agnostic sketch options synchronisation.
 *
 * Manages a global `sketchOptions` store and broadcasts changes
 * via a `CustomEvent("sketch-options")` so both React components and
 * sketch runtime code (p5, GSAP, Three.js …) stay in sync.
 *
 * Moved from `src/p5-sketches/shared/syncSketchOptions.js` — the
 * logic has no dependency on any specific engine.
 */
import {
  deepMerge, structuredClone
} from "@/p5-sketches/shared/utils.js";

export const EVENT = "sketch-options";

let current: Record<string, any> = ( globalThis as any ).sketchOptions ?? {};

export function setSketchOptions(
  update: Record<string, any>,
  origin = "react",
): void {
  const sourceClone = structuredClone( update );

  const merged = deepMerge(
    structuredClone( current ),
    sourceClone,
  );

  if ( JSON.stringify( merged ) === JSON.stringify( current ) ) {
    return;
  }

  current = merged;
  ( globalThis as any ).sketchOptions = current;

  window.dispatchEvent(
    new CustomEvent( EVENT, {
      detail: {
        opts: current,
        origin,
      },
    } ),
  );
}

export function subscribeSketchOptions(
  cb: ( opts: Record<string, any>, origin?: string ) => void,
): () => void {
  const handler = ( e: Event ) => {
    const detail = ( e as CustomEvent ).detail;

    cb(
      detail.opts,
      detail.origin,
    );
  };

  window.addEventListener(
    EVENT,
    handler,
  );

  return () =>
    window.removeEventListener(
      EVENT,
      handler,
    );
}

export const getSketchOptions = (): Record<string, any> => current;
