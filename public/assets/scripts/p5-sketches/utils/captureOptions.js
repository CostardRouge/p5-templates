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
  colors: {
    text: [
      0,
      0,
      0
    ],
    accent: [
      128,
      128,
      255
    ],
    background: [
      230,
      230,
      230
    ],
  },
  animation: {
    duration: 10,
    framerate: 60
  },
  assets: {
  }, // 👉 now an object { images:[], videos:[], … }
  lines: false,
  durationBar: true,
  /* merge options injected from React / server --------------------- */
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
  const imgPaths = sketchOptions.assets?.images ?? [
  ];

  if ( imgPaths.length === 0 ) {
    cache.set(
      "images",
      [
      ]
    );
    document.querySelector( "canvas#defaultCanvas0" )
      ?.classList.add( "loaded" );
    return;
  }

  const cached = new Map( ( cache.get( "images" ) ?? [
  ] ).map( o => [
    o.path,
    o
  ] ) );

  const finalList = [
  ];

  for ( const path of imgPaths ) {
    let obj = cached.get( path );

    if ( !obj ) {
      obj = {
        path,
        exif: undefined,
        img: loadImage( resolveAssetURL(
          path,
          sketchOptions
        ) ),
        filename: path.split( "/" ).pop(),
      };

      readExifInfo( obj );
    }

    finalList.push( obj );
    cached.delete( path ); // supprime de « reste à supprimer »
  }

  /* --- Suppression ---------------------------------------------- */
  /* Tout ce qui reste dans cached Map n'est plus présent dans options.
     On peut appeler .img.remove() si besoin, ou laisser GC faire.   */
  cached.forEach( o => o.img?.remove?.() );

  /* --- Commit ---------------------------------------------------- */
  cache.set(
    "images",
    finalList
  );
}

async function readExifInfo( o ) {
  try {
    const url = resolveAssetURL(
      o.path,
      sketchOptions
    );
    let tags;

    if ( url.startsWith( "blob:" ) ) {
      const buffer = await ( await fetch( url ) ).arrayBuffer();

      tags = exif.load( buffer );
    } else {
      tags = await exif.load( url );
    }

    console.log( {
      tags
    } );

    o.exif = tags;
  } catch ( e ) {
    console.warn(
      "[EXIF] fail",
      o.path,
      e
    );
    o.exif = null;
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

      refreshAssets(); // will debounce and load only the deltas
    } );

    /* make initial opts available to React (legacy behaviour) ------- */
    setSketchOptions(
      sketchOptions,
      sketch.sketchOptions?.engine
    );
  }
);

export default sketchOptions;