// Promise-aware wrappers around p5's callback-style asset loaders.
//
// p5's `loadImage`/`loadFont` return their asset object immediately and fill
// it in later — callers can keep using that object synchronously, but the
// load itself was invisible: nothing to await, nothing reported. Each wrapper
// here opens a loading step (see @/lib/assets/loadingProgress) that settles
// when the browser is done, so the load is awaitable (`ready`), gates
// deterministic capture via pendingMedia, and shows up in the engine's
// `loading` event and the sketch-page placeholder.
//
// Passing a failure callback to p5 is load-bearing, not optional: without one
// p5 never decrements its preload counter for a failed asset, so a single
// stale path hangs the sketch on the loading screen forever. Both wrappers
// always register one, so a caller cannot forget it.

import {
  beginLoadingStep
} from "@/lib/assets/loadingProgress";
import {
  getP5
} from "./sketch.js";

function labelFromURL( url ) {
  if ( typeof url !== "string" || !url ) {
    return "asset";
  }
  if ( url.startsWith( "blob:" ) ) {
    return "blob";
  }

  const file = url.split( "/" ).pop()
    ?.split( "?" )[ 0 ] || url;

  // Asset paths are URL-encoded, and these labels are read by humans on the
  // loading screen: "DSC02023%20Medium.jpeg" should show as a real filename.
  try {
    return decodeURIComponent( file );
  } catch {
    // A stray "%" makes decodeURIComponent throw — the raw name still reads.
    return file;
  }
}

/**
 * Load an image through p5, with the load reported as a step.
 *
 * Returns `{ img, ready }` — `img` is p5's placeholder object, usable
 * synchronously and filled in on decode; `ready` resolves with the image
 * once decoded, or with `null` if the load failed. `onError` runs on
 * failure so callers can drop their own reference to the broken asset.
 */
export function loadImageAsset(
  url, {
    label = labelFromURL( url ), onError
  } = {}
) {
  const step = beginLoadingStep(
    "image",
    label
  );

  let failed = false;

  const img = getP5().loadImage(
    url,
    () => step.loaded(),
    ( error ) => {
      failed = true;
      step.failed( error );
      onError?.( error );
    }
  );

  return {
    img,
    ready: step.promise.then( () => ( failed ? null : img ) )
  };
}

/**
 * Load a font through p5, with the load reported as a step.
 * Same contract as `loadImageAsset`: `ready` resolves with the font, or
 * `null` when the load failed.
 */
export function loadFontAsset(
  path, {
    label = labelFromURL( path ), onError
  } = {}
) {
  const step = beginLoadingStep(
    "font",
    label
  );

  let failed = false;

  const font = getP5().loadFont(
    path,
    () => step.loaded(),
    ( error ) => {
      failed = true;
      step.failed( error );
      onError?.( error );
    }
  );

  return {
    font,
    ready: step.promise.then( () => ( failed ? null : font ) )
  };
}
