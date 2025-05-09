import { cache, events, exif } from './index.js';

const sketchOptions = Object.assign( {
  size: {
    width: 1080,
    height: 1350
  },
  "colors": {
    "text": [0,0,0],
    "accent": [128,128,255],
    "background": [230, 230, 230],
  },
  animation: {
    duration: 12,
    framerate: 60
  },
  "assets": [],
  "lines": false,
  "durationBar": true
}, window.sketchOptions);

function getImagePath( path ) {
  if (sketchOptions.id) {
    return `${window.location.origin}/api/tmp-file?name=${encodeURIComponent(path)}&folder=${sketchOptions.id}`;
  }

  return `${window.location.origin}/${path}`;
}

function refreshAssets() {
  if (sketchOptions.assets.length === 0) {
    document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
    return;
  }

  cache.store("images", () => sketchOptions.assets.map( path => ({
    path,
    exif: undefined,
    img: loadImage( getImagePath( path ) ),
    filename: path.split("/").pop(),
  }) ) );

  cache.get("images").forEach( async( imageObject ) => {
    const { path } = imageObject;

    imageObject.exif = await exif.load( getImagePath( path ) );
  } );
}

function callbackForImagesExifLoaded() {
  if (document.querySelector("canvas#defaultCanvas0.loaded") !== null) {
    return;
  }

  if (cache.get("images").every(image => image.exif === undefined)) {
    return;
  }

  document.querySelector("canvas#defaultCanvas0").classList.add("loaded");
}

events.register("engine-window-preload", refreshAssets);
events.register("pre-draw", callbackForImagesExifLoaded);

window.addEventListener('sketch-options', ({ detail }) => {
  Object.assign(sketchOptions, detail);          // mutate in place => refs stay valid
  refreshAssets();                               // anything that depends on options
  console.info('[p5] options updated', sketchOptions);
});

export default sketchOptions;
