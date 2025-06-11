import {
  cache, events, exif, sketch
} from "./index.js";
import {
  getSketchOptions,
  subscribeSketchOptions,
  setSketchOptions,
} from "/shared/syncSketchOptions.js";

const sketchOptions = {
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
    ]
  },
  animation: {
    duration: 12,
    framerate: 60
  },
  assets: [
  ],
  lines: false,
  durationBar: true,
  ...getSketchOptions()
};

const getImagePath = path =>
  sketchOptions.id
    ? `${ location.origin }/api/files/${ path }`
    : `${ location.origin }/${ path }`;

function refreshAssets() {
  if ( !sketchOptions.assets?.length ) {
    document.querySelector( "canvas#defaultCanvas0" )?.classList.add( "loaded" );
    return;
  }

  cache.store(
    "images",
    () =>
      sketchOptions.assets.map( path => ( {
        path,
        exif: undefined,
        img: loadImage( getImagePath( path ) ),
        filename: path.split( "/" ).pop(),
      } ) ),
  );

  cache.get( "images" ).forEach( async imgObj => {
    imgObj.exif = await exif.load( getImagePath( imgObj.path ) );
  } );
}

function markLoadedWhenExifReady() {
  const c = document.querySelector( "canvas#defaultCanvas0" );

  if ( !c || c.classList.contains( "loaded" ) ) return;
  if ( cache.get( "images" )?.every( img => img.exif === undefined ) ) return;
  c.classList.add( "loaded" );
}

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
    subscribeSketchOptions( (
      newOptions, _origin
    ) => {
      console.info(
        "[p5] options updated",
        sketchOptions
      );
      Object.assign(
        sketchOptions,
        newOptions
      );

      refreshAssets();

      // events.handle(
      //   "engine-resize-canvas",
      //   newOptions?.size?.width,
      //   newOptions?.size?.height
      // );
      // events.handle(
      //   "engine-framerate-change",
      //   newOptions?.animation?.framerate
      // );

      // sketch.sketchOptions.animation = newOptions?.animation;
      // sketch.sketchOptions.size = newOptions?.size;
    } );

    setSketchOptions(
      sketchOptions,
      sketch.sketchOptions.engine
    );
  }
);

export default sketchOptions;