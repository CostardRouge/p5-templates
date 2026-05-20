/* ------------------------------------------------------------------ */
/*  Imports                                                           */
/* ------------------------------------------------------------------ */

import events from "./events.js";
import exif from "./exif.js";
import cache from "./cache.js";
import sketch from "./sketch.js";
import {
  getP5, getContainer
} from "./sketch.js";

import {
  getSketchOptions, setSketchOptions, subscribeSketchOptions
} from "../shared/syncSketchOptions.js";

import {
  resolveAssetURL
} from "../shared/utils.js";

/* ------------------------------------------------------------------ */
/*  Debounced, de-duplicated asset refresher                          */
/* ------------------------------------------------------------------ */

let refreshTimer = -1;

function refreshAssets() {
  if ( refreshTimer === -1 ) {
    _refreshAssets();
  }

  clearTimeout( refreshTimer );
  refreshTimer = setTimeout(
    _refreshAssets,
    80
  );
}

async function _refreshAssets() {
  const opts = getSketchOptions();
  const globalImages = opts.assets?.images ?? [];
  // Also pick up images stored directly in sketch form fields (e.g. images-stack)
  const sketchImages = opts.sketch?.images ?? [];
  const slideImages = ( opts.slides ?? [] ).flatMap( ( slide ) => [
    ...( slide?.assets?.images ?? [] ),
    ...( slide?.sketch?.images ?? [] )
  ] );

  const allPaths = [
    ...new Set( [
      ...globalImages,
      ...sketchImages,
      ...slideImages
    ] )
  ];

  if ( allPaths.length === 0 ) {
    cache.set(
      "imagesMap",
      new Map()
    );
    cache.set(
      "images",
      []
    );
    const container = getContainer();
    const canvas = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

    canvas?.classList.add( "loaded" );
    return;
  }

  const prevMap = cache.get( "imagesMap" ) ?? new Map();
  const newMap = new Map();

  for ( const path of allPaths ) {
    let obj = prevMap.get( path );

    if ( !obj ) {
      const url = resolveAssetURL(
        path,
        opts.id
      );

      obj = {
        path,
        filename: path.split( "/" ).pop(),
        img: getP5().loadImage( url ),
        exif: undefined
      };

      readExifInfo(
        obj,
        url
      );
    }

    newMap.set(
      path,
      obj
    );
    prevMap.delete( path );
  }

  prevMap.forEach( ( o ) => {
    o.img?.remove?.();
    delete o.exif;
  } );

  cache.set(
    "imagesMap",
    newMap
  );
  cache.set(
    "images",
    [
      ...newMap.values()
    ]
  );
}

async function readExifInfo(
  object, url
) {
  try {
    let tags;

    try {
      tags = url.startsWith( "blob:" )
        ? await exif.load( await ( await fetch( url ) ).arrayBuffer() )
        : await exif.load( url );
    } catch( error ) {
      console.error(
        "readExifInfo error",
        error
      );
      tags = null;
    }

    object.exif = tags;
  } catch( e ) {
    console.warn(
      "[EXIF] fail",
      object.path,
      e
    );
    object.exif = null;
  }
}

/* ------------------------------------------------------------------ */
/*  Canvas "loaded" indicator once EXIF results return               */
/* ------------------------------------------------------------------ */

function markLoadedWhenExifReady() {
  const container = getContainer();
  const c = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas.p5Canvas" );

  if ( !c || c.classList.contains( "loaded" ) ) {
    return;
  }
  if ( cache.get( "images" )?.every( ( img ) => img.exif === undefined ) ) {
    return;
  }
  c.classList.add( "loaded" );
}

/* ------------------------------------------------------------------ */
/*  Event hooks                                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Options change tracking                                           */
/* ------------------------------------------------------------------ */

let previousOptions = {
  size: null,
  animation: null,
  effectiveSize: null,
  effectiveAnimation: null
};

let unsubscribe = null;

/**
 * Compare two objects for deep equality
 */
function isEqual(
  a, b
) {
  if ( a === b ) {
    return true;
  }
  if ( !a || !b ) {
    return false;
  }
  if ( typeof a !== "object" || typeof b !== "object" ) {
    return false;
  }

  return JSON.stringify( a ) === JSON.stringify( b );
}

/**
 * Resolve the effective size/animation for the current slide.
 * Per-slide overrides win; otherwise global values are used.
 */
function getEffective( opts ) {
  const slideIndex = typeof window !== "undefined" && window.getCurrentSlide
    ? window.getCurrentSlide()?.index
    : undefined;
  const slide = slideIndex != null ? opts?.slides?.[ slideIndex ] : null;

  return {
    size: slide?.size ?? opts?.size,
    animation: slide?.animation ?? opts?.animation
  };
}

/**
 * Handle options changes and trigger appropriate events
 */
function handleOptionsChange(
  newOptions, origin
) {
  // Skip if this update came from the p5 engine itself to avoid loops
  if ( origin === "p5" ) {
    return;
  }

  let hasChanges = false;

  const {
    size: effectiveSize,
    animation: effectiveAnimation
  } = getEffective( newOptions );

  // Check for effective size changes (slide override or global)
  if ( effectiveSize && !isEqual(
    effectiveSize,
    previousOptions.effectiveSize
  ) ) {
    const {
      width,
      height
    } = effectiveSize;

    if ( width && height ) {
      events.handle(
        "engine-resize-canvas",
        width,
        height
      );

      // Update sketch options reference
      if ( sketch.sketchOptions ) {
        sketch.sketchOptions.size = {
          ...effectiveSize
        };
      }

      previousOptions.effectiveSize = {
        ...effectiveSize
      };
      hasChanges = true;
    }
  }

  // Check for effective animation/framerate changes (slide override or global)
  if ( effectiveAnimation && !isEqual(
    effectiveAnimation,
    previousOptions.effectiveAnimation
  ) ) {
    const framerate = effectiveAnimation?.framerate;

    if ( framerate && typeof framerate === "number" && framerate > 0 ) {
      events.handle(
        "engine-framerate-change",
        framerate
      );

      // Update sketch options reference
      if ( sketch.sketchOptions ) {
        sketch.sketchOptions.animation = {
          ...effectiveAnimation
        };
      }

      previousOptions.effectiveAnimation = {
        ...effectiveAnimation
      };
      hasChanges = true;
    }
  }

  // Also track raw globals for reference
  previousOptions.size = newOptions?.size ? {
    ...newOptions.size
  } : null;
  previousOptions.animation = newOptions?.animation ? {
    ...newOptions.animation
  } : null;

  // Refresh assets if there were any changes or if assets changed
  if ( hasChanges || !isEqual(
    newOptions?.assets,
    previousOptions.assets
  ) || !isEqual(
    newOptions?.slides,
    previousOptions.slides
  ) ) {
    refreshAssets();
    previousOptions.assets = newOptions?.assets;
    previousOptions.slides = newOptions?.slides;
  }
}

/**
 * Initialize options subscription
 */
function initializeOptionsSubscription() {
  // Clean up existing subscription if any
  if ( unsubscribe ) {
    unsubscribe();
    unsubscribe = null;
  }

  // Get initial options and store them
  const initialOptions = getSketchOptions();

  previousOptions = {
    size: initialOptions?.size ? {
      ...initialOptions.size
    } : null,
    animation: initialOptions?.animation ? {
      ...initialOptions.animation
    } : null,
    effectiveSize: initialOptions?.size ? {
      ...initialOptions.size
    } : null,
    effectiveAnimation: initialOptions?.animation ? {
      ...initialOptions.animation
    } : null,
    assets: initialOptions?.assets,
    slides: initialOptions?.slides
  };

  // Subscribe to future changes
  unsubscribe = subscribeSketchOptions( handleOptionsChange );

  // Sync initial options to sketch
  setSketchOptions(
    initialOptions,
    sketch.sketchOptions?.engine ?? "p5"
  );
}

// Called by sketch.start() on every sketch initialization so that these
// handlers survive a reset() which clears events.registeredEvents.
export function registerEvents() {
  events.register(
    "engine-window-preload",
    refreshAssets
  );
  events.register(
    "pre-draw",
    markLoadedWhenExifReady
  );
  events.register(
    "pre-setup",
    initializeOptionsSubscription
  );
}

/**
 * Update the previous-options baseline to match the given effective
 * size/animation.  Called by slides/index.js after a slide switch so
 * that the next handleOptionsChange comparison starts from the right
 * baseline and doesn't re-fire events for values that were already applied.
 */
export function syncEffectivePrevious(
  effectiveSize, effectiveAnimation
) {
  if ( effectiveSize ) {
    previousOptions.effectiveSize = {
      ...effectiveSize
    };
  }

  if ( effectiveAnimation ) {
    previousOptions.effectiveAnimation = {
      ...effectiveAnimation
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Proxy — always reads from the live store on every access.         */
/*                                                                    */
/*  .sketch  returns base sketch options merged with per-slide        */
/*           overrides via window.getSketchSettings when registered.  */
/*           Falls back to the raw store value for simple sketches.   */
/* ------------------------------------------------------------------ */

const optionsProxy = new Proxy(
  {},
  {
    get(
      _, prop
    ) {
      const live = getSketchOptions();

      if ( prop === "sketch" && typeof window !== "undefined" && window.getSketchSettings ) {
        try {
          return window.getSketchSettings( live );
        } catch {
          return live[ prop ] ?? {};
        }
      }

      return live[ prop ];
    }
  }
);

export default optionsProxy;
