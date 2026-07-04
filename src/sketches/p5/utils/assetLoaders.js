// Promise-aware wrappers around p5's asset loaders.
//
// Callers get an asset object immediately that fills in once the load lands —
// usable synchronously, the way p5 1.x's `loadImage`/`loadFont` behaved. p5 2
// loaders instead return a promise for a separate object, so each wrapper
// hands out a placeholder of the right class and grafts the loaded asset onto
// it (see `graft`). Each load also opens a loading step (see
// @/lib/assets/loadingProgress) that settles when the browser is done, so it
// is awaitable (`ready`), gates deterministic capture via pendingMedia, and
// shows up in the engine's `loading` event and the sketch-page placeholder.
//
// The p5 2 loaders are awaited without success/failure callbacks on purpose:
// when callbacks are passed, the returned promise resolves with the callback's
// return value and a failure no longer rejects — which would turn a missing
// asset into a silently "loaded" one.

import {
  beginLoadingStep
} from "@/lib/assets/loadingProgress";
import {
  getHostP5, getP5
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

// The p5 class, for constructing placeholders. Read off the host instance:
// getP5() may be an embedded sketch's p5.Graphics surface, whose constructor
// is p5.Graphics rather than p5.
function p5Class() {
  return ( getHostP5() ?? getP5() )?.constructor;
}

// Make `placeholder` become `loaded`: adopt its class and own state. Any own
// property that pointed back at `loaded` (p5.Image keeps `_pixelsState = this`)
// is re-pointed at the placeholder, so pixel reads/writes stay on the object
// callers actually hold.
function graft(
  placeholder, loaded
) {
  Object.setPrototypeOf(
    placeholder,
    Object.getPrototypeOf( loaded )
  );
  Object.assign(
    placeholder,
    loaded
  );

  for ( const key of Object.keys( placeholder ) ) {
    if ( placeholder[ key ] === loaded ) {
      placeholder[ key ] = placeholder;
    }
  }

  return placeholder;
}

/**
 * Load an image through p5, with the load reported as a step.
 *
 * Returns `{ img, ready }` — `img` is a 1×1 placeholder p5.Image, usable
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

  const img = new ( p5Class().Image )(
    1,
    1
  );

  const ready = Promise.resolve( getP5().loadImage( url ) )
    .then( ( loaded ) => {
      graft(
        img,
        loaded
      );
      // Force a WebGL texture re-upload for anyone who bound the placeholder.
      img.setModified( true );
      step.loaded();

      return img;
    } )
    .catch( ( error ) => {
      step.failed( error );
      onError?.( error );

      return null;
    } );

  return {
    img,
    ready
  };
}

/**
 * Load a font through p5, with the load reported as a step.
 * Same contract as `loadImageAsset`: `font` is a placeholder p5.Font usable
 * right away (it renders as sans-serif until the file lands — readiness for
 * glyph geometry is `font.data`), and `ready` resolves with the font, or
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

  const font = Object.create( p5Class().Font.prototype );

  // p5 2 textFont() reads `face.family` off a p5.Font, so this keeps
  // textFont( font ) valid in the frames before the real font arrives.
  font.face = {
    family: "sans-serif"
  };

  const ready = Promise.resolve( getP5().loadFont( path ) )
    .then( ( loaded ) => {
      graft(
        font,
        loaded
      );
      step.loaded();

      return font;
    } )
    .catch( ( error ) => {
      step.failed( error );
      onError?.( error );

      return null;
    } );

  return {
    font,
    ready
  };
}
