import options from "@/p5/utils/options.js";

import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

// object-fit: cover via the 9-arg p5 image() — the crop happens at the
// source rect, so a zoomed background never bleeds outside its half
function drawImageCover( {
  img,
  x,
  y,
  width,
  height,
  zoom = 1
} ) {
  const p = getP5();

  const coverScale = Math.max(
    width / img.width,
    height / img.height
  ) * zoom;
  const sourceWidth = width / coverScale;
  const sourceHeight = height / coverScale;
  const sourceX = ( img.width - sourceWidth ) / 2;
  const sourceY = ( img.height - sourceHeight ) / 2;

  p.image(
    img,
    x,
    y,
    width,
    height,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight
  );
}

sketch.setup( () => {
  const p = getP5();

  p.background( ...options.sketch.backgroundColor );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch;

  p.clear();
  p.background( ...o.backgroundColor );

  const images = imageUtils.getImages();

  if ( images.length < 2 ) {
    return;
  }

  const pairPosition = animation.progression * images.length;
  const pairIndex = Math.floor( pairPosition );
  const pairProgression = pairPosition - pairIndex;

  const leftImage = mappers.circularIndex(
    pairIndex,
    images
  )?.img;
  const rightImage = mappers.circularIndex(
    pairIndex + 1,
    images
  )?.img;

  if ( !leftImage || !rightImage ) {
    return;
  }

  const halfWidth = p.width / 2;
  const backgroundZoom = o.background.zoom * ( 1 + o.background.zoomAmplitude * pairProgression );

  // swapped backgrounds: each half shows the *opposite* photo, zoomed in
  drawImageCover( {
    img: rightImage,
    x: 0,
    y: 0,
    width: halfWidth,
    height: p.height,
    zoom: backgroundZoom
  } );

  drawImageCover( {
    img: leftImage,
    x: halfWidth,
    y: 0,
    width: halfWidth,
    height: p.height,
    zoom: backgroundZoom
  } );

  // centered collage window, straddling the seam, showing the photos unswapped
  const innerWidth = o.inner.width * p.width;
  const innerHalfWidth = innerWidth / 2;
  const innerHeight = innerHalfWidth * o.inner.aspect;
  const innerX = ( p.width - innerWidth ) / 2;
  const innerY = ( p.height - innerHeight ) / 2 + o.inner.verticalOffset * p.height;

  drawImageCover( {
    img: leftImage,
    x: innerX,
    y: innerY,
    width: innerHalfWidth,
    height: innerHeight
  } );

  drawImageCover( {
    img: rightImage,
    x: innerX + innerHalfWidth,
    y: innerY,
    width: innerHalfWidth,
    height: innerHeight
  } );
} );
