import options from "@/p5/utils/options.js";

import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const canvases = sketch.state( () => ( {
  imageBuffer: undefined,
  maskBuffer: undefined,
  sliderBuffer: undefined
} ) );

function drawImageWithMask( {
  img, maskDrawer, graphics = getP5()
} ) {
  imageUtils.marginImage( {
    img,
    fill: true,
    center: true,
    graphics: canvases.imageBuffer,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    )
  } );

  // Clean mask
  canvases.maskBuffer.erase();
  canvases.maskBuffer.rect(
    0,
    0,
    canvases.maskBuffer.width,
    canvases.maskBuffer.height
  );
  canvases.maskBuffer.noErase();

  canvases.imageBuffer.erase();
  canvases.imageBuffer.rect(
    0,
    0,
    canvases.imageBuffer.width,
    canvases.imageBuffer.height
  );
  canvases.imageBuffer.noErase();

  maskDrawer?.( canvases.maskBuffer );

  const maskedImage = canvases.imageBuffer.get();

  maskedImage.mask( canvases.maskBuffer );
  graphics.image(
    maskedImage,
    0,
    0,
    graphics.width,
    graphics.height
  );
}

sketch.setup( () => {
  const p = getP5();

  canvases.maskBuffer = p.createGraphics(
    p.width,
    p.height
  );

  canvases.imageBuffer = p.createGraphics(
    p.width,
    p.height
  );

  canvases.sliderBuffer = p.createGraphics(
    p.width,
    p.height
  );

  // canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.075);
  p.background( ...options.colors.background );
} );

let offset = 0;

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.clear();
  p.background( ...options.colors.background );

  const imageObjects = cache.get( "images" );

  imageObjects.forEach( ( {
    img
  } ) => {
    // drawImageWithMask({
    // 	img,
    // 	maskDrawer: graphics => {
    // 		graphics.fill(255);
    // 		graphics.noStroke();
    // 		graphics.circle(x, y, size)
    // 	}
    // })
  } );

  const imageIndices = imageObjects.map( (
    _, index
  ) => index );

  // const currentImageIndex = animation.ease({
  // 	values: imageIndices,
  // 	currentTime: animation.progression*imageIndices.length,
  // 	// easingFn: easing.easeInOutExpo,
  // });

  // animation.ease({
  // 	values: imageIndices,
  // 	currentTime: 1+animation.progression*imageIndices.length,
  // 	// easingFn: easing.easeInOutExpo,
  // });

  // const currentImageIndex = (animation.time*imageIndices.length) % imageIndices.length
  const currentImageIndex = mappers.circularIndex(
    animation.progression * imageIndices.length,
    imageIndices
  );
  const nextImageIndex = mappers.circularIndex(
    1 + animation.progression * imageIndices.length,
    imageIndices
  );

  const currentImage = imageObjects[ ~~currentImageIndex ].img;
  const nextImage = imageObjects[ ~~nextImageIndex ].img;

  canvases.sliderBuffer.erase();
  canvases.sliderBuffer.rect(
    0,
    0,
    canvases.sliderBuffer.width,
    canvases.sliderBuffer.height
  );
  canvases.sliderBuffer.noErase();

  imageUtils.marginImage( {
    img: currentImage,
    fill: true,
    // boundary: {
    // 	width: p.width/2,
    // 	height: p.height/2,
    // },
    center: true,
    graphics: canvases.sliderBuffer,
    position: p.createVector(
      offset,
      p.height / 2
    )
  } );

  imageUtils.marginImage( {
    img: nextImage,
    fill: true,
    // boundary: {
    // 	width: p.width/2,
    // 	height: p.height/2,
    // },
    center: true,
    graphics: canvases.sliderBuffer,
    position: p.createVector(
      offset + p.width + p.width / 2,
      p.height / 2
    )
  } );

  p.image(
    canvases.sliderBuffer,
    0,
    0
  );

  offset -= 1; // ((p.width)/imageIndices.length)/options.animation.duration;
  if ( offset <= -p.width ) {
    offset = 0;
  }

  const defaultTitle = "photo-slide".toUpperCase().replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      defaultTitle,
      p.width / 2,
      p.height / 2,
      {
        size: 128,
        stroke: p.color( ...options.colors.text ),
        fill: p.color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          p.CENTER,
          p.CENTER
        ],
        blendMode: p.EXCLUSION
      }
    );
  }
} );
