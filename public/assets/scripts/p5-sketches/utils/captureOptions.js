/* ------------------------------------------------------------------ */
/*  Imports + shared store                                            */
/* ------------------------------------------------------------------ */
import {
  cache, events, exif, sketch
} from "./index.js";
import {
  getSketchOptions,
  subscribeSketchOptions,
  setSketchOptions,
} from "/shared/syncSketchOptions.js";

import {
  resolveAssetURL, deepMerge
} from "/shared/utils.js";

/* ------------------------------------------------------------------ */
/*  Local mutable copy (initialised once)                             */
/* ------------------------------------------------------------------ */
const sketchOptions = {
  /* sensible defaults --------------------------------------------- */
  size: {
    width: 1080,
    height: 1350
  },
  animation: {
    duration: 10,
    framerate: 60
  },
  assets: {
  },
  ...getSketchOptions(),
};

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
  const globalImages = sketchOptions.assets?.images ?? [
  ];
  const slideImages = ( sketchOptions.slides ?? [
  ] )
    .flatMap( slide => slide?.assets?.images ?? [
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
        sketchOptions.id
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

  prevMap.forEach( o => {
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

    if ( url.startsWith( "blob:" ) ) {
      const buffer = await ( await fetch( url ) ).arrayBuffer();

      tags = exif.load( buffer );
    } else {
      tags = await exif.load( url );
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
/*  Canvas “loaded” indicator once a single EXIF result returns       */
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
  /* listen for React-side option mutations ----------------------- */
    subscribeSketchOptions( (
      newOptions, origin
    ) => {
      if (
        JSON.stringify( newOptions.size ) !== JSON.stringify( sketchOptions.size )
      ) {
        events.handle(
          "engine-resize-canvas",
          newOptions?.size?.width,
          newOptions?.size?.height
        );

        sketch.sketchOptions.size = newOptions?.size;
      }

      if ( JSON.stringify( newOptions.animation ) !== JSON.stringify( sketchOptions.animation ) ) {
        sketch.sketchOptions.animation = newOptions?.animation;

        events.handle(
          "engine-framerate-change",
          newOptions?.animation?.framerate
        );
      }

      Object.assign(
        sketchOptions,
        newOptions
      );

      refreshAssets();
    } );

    setSketchOptions(
      sketchOptions,
      sketch.sketchOptions?.engine
    );
  }
);

export default sketchOptions;