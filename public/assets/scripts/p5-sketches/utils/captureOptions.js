import { cache, events, exif } from './index.js';

// function getCaptureOptions() {
//   return window.sketchOptions
//
//   const urlParams = new URLSearchParams(window.location.search);
//   const base64 = urlParams.get("captureOptions");
//
//   if (!base64) {
//     return {};
//   }
//
//   return JSON.parse(atob(base64))
// }

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
}, window.sketchOptions);

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

    // console.log(imageObject.exif)
  } );
});

// console.log({
//   captureOptions
// });

export default captureOptions;
