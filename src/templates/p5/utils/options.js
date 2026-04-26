/* ------------------------------------------------------------------ */
/*  Imports                                                           */
/* ------------------------------------------------------------------ */

import events from "./events.js";
import exif from "./exif.js";
import cache from "./cache.js";
import sketch from "./sketch.js";

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
    document.querySelector( "canvas#defaultCanvas0" )?.classList.add( "loaded" );
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
        img: loadImage( url ),
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
  const c = document.querySelector( "canvas#defaultCanvas0" );

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

events.register(
  "pre-setup",
  () => {
    subscribeSketchOptions( ( newOptions ) => {
      const current = getSketchOptions();

      if ( JSON.stringify( newOptions.size ) !== JSON.stringify( current.size ) ) {
        events.handle(
          "engine-resize-canvas",
          newOptions?.size?.width,
          newOptions?.size?.height
        );
        sketch.sketchOptions.size = newOptions?.size;
      }

      if ( JSON.stringify( newOptions.animation ) !== JSON.stringify( current.animation ) ) {
        events.handle(
          "engine-framerate-change",
          newOptions?.animation?.framerate
        );
        sketch.sketchOptions.animation = newOptions?.animation;
      }

      refreshAssets();
    } );

    setSketchOptions(
      getSketchOptions(),
      sketch.sketchOptions?.engine
    );
  }
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
