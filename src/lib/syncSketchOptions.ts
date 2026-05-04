/**
 * Engine-agnostic sketch options synchronisation.
 *
 * Manages a global `sketchOptions` store and broadcasts changes
 * via a `CustomEvent("sketch-options")` so both React components and
 * sketch runtime code (p5, GSAP, Three.js …) stay in sync.
 */
import {
  deepMerge, structuredClone
} from "@/p5/shared/utils.js";

export const EVENT = "sketch-options";

const globalStore = globalThis as typeof globalThis & {
  sketchOptions?: Record<string, any>;
};

globalStore.sketchOptions ??= {};

const current: Record<string, any> = globalStore.sketchOptions;

export function setSketchOptions(
  update: Record<string, any>,
  origin = "react"
): void {
  const sourceClone = structuredClone( update );

  const merged = deepMerge(
    structuredClone( current ),
    sourceClone
  );

  if ( JSON.stringify( merged ) === JSON.stringify( current ) ) {
    return;
  }

  for ( const key of Object.keys( current ) ) {
    if ( !( key in merged ) ) delete current[ key ];
  }

  Object.assign(
    current,
    merged
  );

  globalStore.sketchOptions = current;

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

export function subscribeSketchOptions( cb: ( opts: Record<string, any>, origin?: string ) => void ): () => void {
  const handler = ( e: Event ) => {
    const detail = ( e as CustomEvent ).detail;

    cb(
      detail.opts,
      detail.origin
    );
  };

  window.addEventListener(
    EVENT,
    handler
  );

  return () =>
    window.removeEventListener(
      EVENT,
      handler
    );
}

export const getSketchOptions = (): Record<string, any> => globalStore.sketchOptions ?? current;
