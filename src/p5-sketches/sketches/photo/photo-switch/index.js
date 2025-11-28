import options from "@/p5/utils/options.js";

import cache from "@/p5/utils/cache.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import * as common from "@/p5/utils/common.js";

// helpers
const getBackgroundColor = () =>
  ( options.sketch?.backgroundColor ??
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
    ? imagesFromOptions.map( ( path ) => common.getAsset( path ) ).filter( Boolean )
    : fromCache || [
    ];
};

const pickImg = ( entry ) => ( entry?.img ? entry.img : entry );

sketch.setup(
  () => {
    background( ...getBackgroundColor() );
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

sketch.draw( ( ) => {
  background( ...getBackgroundColor() );

  const images = getImages();

  if ( !images?.length ) {
    return;
  }

  // Which image to show this frame
  const imageIndex = Math.floor( animation.progression * images.length ) % images.length;
  const imageAtIndex = pickImg( images[ imageIndex ] );

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
    img: imageAtIndex,
  } );

  renderTitle( );
} );
