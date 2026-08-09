/**
 * Engine-agnostic sketch options synchronisation.
 *
 * Manages a global `sketchOptions` store and broadcasts changes
 * via a `CustomEvent("sketch-options")` so both React components and
 * sketch runtime code (p5, GSAP, Three.js …) stay in sync.
 */
import {
  mergeChangedInPlace
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
  // Mutate the store in place so existing references stay live, writing (and
  // cloning) only the values that actually changed. Anything else — cloning
  // the whole tree or serialising it to detect no-ops — is per-keystroke
  // garbage that adds up fast on memory-constrained devices.
  if ( !mergeChangedInPlace(
    current,
    update
  ) ) {
    return;
  }

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

/**
 * Builds the smallest partial of `source` that covers the given dotted form
 * paths (react-hook-form's `info.name` values), for handing to
 * `setSketchOptions` in place of the whole options tree.
 *
 * The walk stops at the first array it meets and includes that array
 * wholesale — the store's merge treats arrays as leaf values, so an
 * index-keyed partial object would corrupt them. Stale paths (fields that no
 * longer resolve) are skipped; returns null when nothing could be extracted
 * so the caller can fall back to a full-tree sync.
 */
export function extractOptionsSubset(
  source: Record<string, any>,
  paths: string[]
): Record<string, any> | null {
  // Sorting puts prefixes first; a path covered by a shorter one is dropped
  // so the walk never descends into a subtree it already assigned wholesale.
  const sorted = Array.from( new Set( paths ) ).sort();
  const subset: Record<string, any> = {};

  let lastKept: string | null = null;
  let extracted = false;

  for ( const path of sorted ) {
    if ( lastKept !== null && path.startsWith( `${ lastKept }.` ) ) {
      continue;
    }

    lastKept = path;

    const segments = path.split( "." );

    let src: any = source;
    let dst = subset;

    for ( let i = 0; i < segments.length; i++ ) {
      const segment = segments[ i ];

      if ( typeof src !== "object" || src === null || !( segment in src ) ) {
        break;
      }

      const value = src[ segment ];

      if (
        i === segments.length - 1 ||
        Array.isArray( value ) ||
        typeof value !== "object" ||
        value === null
      ) {
        dst[ segment ] = value;
        extracted = true;
        break;
      }

      dst = dst[ segment ] ??= {};
      src = value;
    }
  }

  return extracted ? subset : null;
}
