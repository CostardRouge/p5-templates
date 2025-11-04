import options from "../../utils/options.js";

import cache from "../../utils/cache.js";
import sketch from "../../utils/sketch.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";
import * as common from "../../utils/common.js";

// helpers
const getBg = () =>
  ( options.sketch?.backgroundColor ??
    options.colors?.background ??
    [
      246,
      235,
      225
    ] );

const getImages = () => {
  const imagesFromOptions =
    options.sketch?.images && options.sketch.images.length
      ? options.sketch.images
      : null;

  const fromCache = cache.get( "images" );

  return imagesFromOptions
    ? imagesFromOptions.map( ( p ) => common.getAsset( p ) ).filter( Boolean )
    : fromCache || [
    ];
};

const pickImg = ( entry ) => ( entry?.img ? entry.img : entry );

sketch.setup(
  () => {
    background( ...getBg() );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    },
  }
);

sketch.draw( ( _time ) => {
  background( ...getBg() );

  const imgs = getImages();

  if ( !imgs?.length ) return;

  // Which image to show this frame
  const idx = Math.floor( animation.progression * imgs.length ) % imgs.length;
  const img = pickImg( imgs[ idx ] );

  const margin = options.sketch?.margin ?? 80;
  const centerImage = options.sketch?.centerImage ?? true;
  const imageScale = options.sketch?.imageScale ?? 1;

  imageUtils.marginImage( {
    position: createVector(
      width / 2,
      height / 2
    ),
    center: centerImage,
    margin,
    scale: imageScale,
    img,
  } );
} );
