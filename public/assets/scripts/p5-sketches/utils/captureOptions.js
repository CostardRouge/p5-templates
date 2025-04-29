import { cache, events, exif } from './index.js';

const sketchOptions = Object.assign( {
  "colors": {
    "text": [0,0,0],
    "accent": [128,128,255],
    "background": [230, 230, 230],
  },
  "assets": [],
  "lines": true,
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
  } );
});

export default sketchOptions;
