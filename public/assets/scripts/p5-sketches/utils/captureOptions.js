import { cache, events, exif } from './index.js';

function getCaptureOptions() {
  const urlParams = new URLSearchParams(window.location.search);
  const base64 = urlParams.get("captureOptions");

  if (!base64) {
    return {};
  }

  return JSON.parse(atob(base64))
}

const captureOptions = Object.assign( {
  "size": {
    "width": 1080,
    "height": 1920
  },
  "animation": {
    "framerate": 60,
    "duration": 6
  },
  "texts": {
    "top": "top",
    "bottom": "bottom"
  },
  "colors": {
    "text": [0,0,0],
    "accent": [128,128,255],
    "background": [230, 230, 230],
  },
  "assets": [],
  // "lines": true,
  "durationBar": true
}, getCaptureOptions());

if (!captureOptions.assets.length) {
  captureOptions.assets = [
    "/assets/images/samples/xiamen/_00001.jpeg",
    "/assets/images/samples/xiamen/_00002.jpeg",
    "/assets/images/samples/xiamen/_00003.jpeg",
    "/assets/images/samples/xiamen/_00004.jpeg",
    "/assets/images/samples/xiamen/_00005.jpeg",
  ];
}

events.register("engine-window-preload", () => {
  cache.store("images", () => captureOptions.assets.map( imagePath => ({
    path: imagePath,
    exif: undefined,
    img: loadImage( imagePath ),
    filename: imagePath.split("/").pop(),
  }) ) );

  cache.get("images").forEach( async( imageObject ) => {
    const { path } = imageObject;

    imageObject.exif = await exif.load("http://localhost:3000/" + path);

    console.log(imageObject.exif)
  } );
});

console.log({
  captureOptions
});

export default captureOptions;
