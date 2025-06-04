import {
  sketch, animation, easing, exif, mappers, string, events, captureOptions as options, cache, grid, colors, imageUtils
} from "/assets/scripts/p5-sketches/utils/index.js";

const canvases = {
  imageBuffer: undefined,
  maskBuffer: undefined,
  sliderBuffer: undefined,
};

function drawImageWithMask( {
  img,
  maskDrawer,
  graphics = window
} ) {
  imageUtils.marginImage( {
    img,
    fill: true,
    center: true,
    graphics: canvases.imageBuffer,
    position: createVector(
      width / 2,
      height / 2
    ),
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

sketch.setup(
  () => {
    canvases.maskBuffer = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    canvases.imageBuffer = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    canvases.sliderBuffer = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    // canvases.mask.pixelDensity(options.backgroundPixelDensity || 0.075);
    background( ...options.colors.background );

    options.noSmooth && noSmooth();
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    }
  }
);

let offset = 0;

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...options.colors.background );

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
    // 	width: width/2,
    // 	height: height/2,
    // },
    center: true,
    graphics: canvases.sliderBuffer,
    position: createVector(
      offset,
      height / 2
    ),
  } );

  imageUtils.marginImage( {
    img: nextImage,
    fill: true,
    // boundary: {
    // 	width: width/2,
    // 	height: height/2,
    // },
    center: true,
    graphics: canvases.sliderBuffer,
    position: createVector(
      offset + width + width / 2,
      height / 2
    ),
  } );

  image(
    canvases.sliderBuffer,
    0,
    0
  );

  offset -= 1;// ((width)/imageIndices.length)/options.animation.duration;
  if ( offset <= -width ) {
    offset = 0;
  }

  const defaultTitle = "photo-slide".toUpperCase().replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      defaultTitle,
      // options.texts.title || defaultTitle,
      width / 2,
      height / 2,
      {
        size: 128,
        stroke: color( ...options.colors.text ),
        fill: color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: EXCLUSION
      }
    );
  }
} );
