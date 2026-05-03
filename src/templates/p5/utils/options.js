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
  getSketchOptions, setSketchOptions, subscribeSketchOptions,
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
  const globalImages = opts.assets?.images ?? [
  ];
  const slideImages = ( opts.slides ?? [
  ] ).flatMap( ( slide ) => slide?.assets?.images ?? [
  ] );

  const allPaths = [
    ...new Set( [
      ...globalImages,
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
      [
      ]
    );
    const container = getContainer();
    const canvas = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas#defaultCanvas0" );

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
        exif: undefined,
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
    } catch ( error ) {
      console.error(
        "readExifInfo error",
        error
      );
      tags = null;
    }

    object.exif = tags;
  } catch ( e ) {
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
  const c = container?.querySelector( "canvas" ) ?? document.querySelector( "canvas#defaultCanvas0" );

  if ( !c || c.classList.contains( "loaded" ) ) return;
  if ( cache.get( "images" )?.every( ( img ) => img.exif === undefined ) ) return;
  c.classList.add( "loaded" );
}

/* ------------------------------------------------------------------ */
/*  Event hooks                                                       */
/* ------------------------------------------------------------------ */

events.register(
  "engine-window-preload",
  refreshAssets
);
events.register(
  "pre-draw",
  markLoadedWhenExifReady
);

/* ------------------------------------------------------------------ */
/*  Options change tracking                                           */
/* ------------------------------------------------------------------ */

let previousOptions = {
  size: null,
  animation: null,
};

let unsubscribe = null;

/**
 * Compare two objects for deep equality
 */
function isEqual(
  a, b
) {
  if ( a === b ) return true;
  if ( !a || !b ) return false;
  if ( typeof a !== "object" || typeof b !== "object" ) return false;

  return JSON.stringify( a ) === JSON.stringify( b );
}

/**
 * Handle options changes and trigger appropriate events
 */
function handleOptionsChange(
  newOptions, origin
) {
  // Skip if this update came from the p5 engine itself to avoid loops
  if ( origin === "p5" ) return;

  let hasChanges = false;

  // Check for size changes
  if ( newOptions?.size && !isEqual(
    newOptions.size,
    previousOptions.size
  ) ) {
    const {
      width,
      height
    } = newOptions.size;

    if ( width && height ) {
      events.handle(
        "engine-resize-canvas",
        width,
        height
      );

      // Update sketch options reference
      if ( sketch.sketchOptions ) {
        sketch.sketchOptions.size = {
          ...newOptions.size
        };
      }

      previousOptions.size = {
        ...newOptions.size
      };
      hasChanges = true;
    }
  }

  // Check for animation/framerate changes
  if ( newOptions?.animation && !isEqual(
    newOptions.animation,
    previousOptions.animation
  ) ) {
    const framerate = newOptions.animation?.framerate;

    if ( framerate && typeof framerate === "number" && framerate > 0 ) {
      events.handle(
        "engine-framerate-change",
        framerate
      );

      // Update sketch options reference
      if ( sketch.sketchOptions ) {
        sketch.sketchOptions.animation = {
          ...newOptions.animation
        };
      }

      previousOptions.animation = {
        ...newOptions.animation
      };
      hasChanges = true;
    }
  }

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
    assets: initialOptions?.assets,
    slides: initialOptions?.slides,
  };

  // Subscribe to future changes
  unsubscribe = subscribeSketchOptions( handleOptionsChange );

  // Sync initial options to sketch
  setSketchOptions(
    initialOptions,
    sketch.sketchOptions?.engine ?? "p5"
  );
}

events.register(
  "pre-setup",
  initializeOptionsSubscription
);

/* ------------------------------------------------------------------ */
/*  Proxy — always reads from the live store on every access.         */
/*                                                                    */
/*  .sketch  returns base sketch options merged with per-slide        */
/*           overrides via window.getSketchSettings when registered.  */
/*           Falls back to the raw store value for simple sketches.   */
/* ------------------------------------------------------------------ */

const optionsProxy = new Proxy(
  {
  },
  {
    get(
      _, prop
    ) {
      const live = getSketchOptions();

      if ( prop === "sketch" && typeof window !== "undefined" && window.getSketchSettings ) {
        try {
          return window.getSketchSettings( live );
        } catch {
          return live[ prop ] ?? {
          };
        }
      }

      return live[ prop ];
    },
  }
);

export default optionsProxy;
