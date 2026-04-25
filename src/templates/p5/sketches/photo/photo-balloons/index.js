import options from "@/p5/utils/options.js";
import cache from "@/p5/utils/cache.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import * as common from "@/p5/utils/common.js";

const canvases = {
  mask: undefined,
  imageBuffer: undefined,
};

const getBg = () => options.sketch?.colors?.background ?? [
  255
];

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

function initBall() {
  const ballsConfig = options.sketch?.balls ?? {
  };
  const motionConfig = options.sketch?.motion ?? {
  };

  return {
    position: createVector(
      width / 2,
      height / 2
    ),
    size: random(
      ballsConfig.minSize ?? 200,
      ballsConfig.maxSize ?? 400
    ),
    vx: random(
      -1,
      1
    ) * ( motionConfig.phaseJitter ?? 1 ),
    vy: random(
      -1,
      1
    ) * ( motionConfig.phaseJitter ?? 1 ),
  };
}

function ensureBalls( images ) {
  images.forEach( ( imgObj ) => {
    if ( imgObj && !imgObj.ball ) {
      imgObj.ball = initBall();
    }
  } );
}

/* ---------- mask draw helper ---------- */

function drawImageWithMask( {
  img, maskDrawer, graphics = window
} ) {
  const imageConfig = options.sketch?.image ?? {
  };

  imageUtils.marginImage( {
    img,
    fill: imageConfig.fill ?? true,
    center: imageConfig.center ?? true,
    graphics: canvases.imageBuffer,
    position: createVector(
      width / 2,
      height / 2
    ),
  } );

  canvases.mask.erase();
  canvases.mask.rect(
    0,
    0,
    graphics.width,
    graphics.height
  );
  canvases.mask.noErase();

  const bg = getBg();

  canvases.mask.background(
    ...bg,
    1
  );

  maskDrawer?.( canvases.mask );

  const maskedImage = canvases.imageBuffer.get();

  maskedImage.mask( canvases.mask );

  graphics.image(
    maskedImage,
    0,
    0,
    graphics.width,
    graphics.height
  );
}

/* ---------- setup ---------- */

sketch.setup( () => {
  canvases.mask = createGraphics(
    sketch?.engine?.canvas?.width,
    sketch?.engine?.canvas?.height
  );

  canvases.imageBuffer = createGraphics(
    sketch?.engine?.canvas?.width,
    sketch?.engine?.canvas?.height
  );

  background( ...getBg() );

  ensureBalls( getImages() );
} );

/* ---------- draw ---------- */

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...getBg() );

  const images = getImages();

  ensureBalls( images );

  const motionConfig = options.sketch?.motion ?? {
  };
  const linesConfig = options.sketch?.lines ?? {
  };

  const m = motionConfig.travelMargin ?? 100;
  const minWAmp = motionConfig.minWidthAmplitude ?? 200;
  const minHAmp = motionConfig.minHeightAmplitude ?? 6;

  const w = width / 2;
  const h = height / 2;

  const angleSpeed = motionConfig.angleSpeed ?? 1;

  const showLines = linesConfig.show ?? true;
  const lineColor = linesConfig.color ?? [
    0,
    0,
    0
  ];
  const lineWeight = linesConfig.weight ?? 1;
  const lineMaxDist = linesConfig.maxDistance ?? 1000;
  const lineAlphaScale = linesConfig.alphaScale ?? 100;

  const links = [
  ];

  // Precompute easing-based amplitudes
  const vw = mappers.fn(
    animation.circularProgression,
    0,
    1,
    minWAmp,
    w,
    easing.easeInOutBack
  );
  const vh = mappers.fn(
    animation.circularProgression,
    0,
    1,
    minHAmp,
    h,
    easing.easeInOutBack
  );

  // Update positions and optionally draw links
  images.forEach( (
    image, index
  ) => {
    if ( !image ) {
      return;
    }

    const ball = image.ball;

    if ( !ball ) {
      return;
    }

    const {
      position, vx, vy
    } = ball;

    position.x = mappers.fn(
      sin( animation.angle * angleSpeed + index + vx ),
      -1,
      1,
      -vw + m,
      vw - m
    );
    position.y = mappers.fn(
      cos( animation.angle * angleSpeed - index + vy ),
      -1,
      1,
      -vh + m,
      vh - m
    );

    position.x += w;
    position.y += h;

    if ( !showLines ) return;

    strokeWeight( lineWeight );

    images.forEach( (
      {
        ball: other
      }, _index
    ) => {
      if ( index === _index ) return;
      if ( links.includes( `${ _index }-${ index }` ) ) return;

      const {
        x: _x, y: _y
      } = other.position;
      const d = map(
        position.dist( other.position ),
        0,
        lineMaxDist,
        0,
        1
      );
      const fade = constrain(
        d,
        0,
        1
      );

      stroke(
        ...lineColor,
        fade * lineAlphaScale
      );
      line(
        position.x,
        position.y,
        _x,
        _y
      );

      links.push( `${ index }-${ _index }` );
    } );
  } );

  // Draw masked images
  images.forEach( ( image ) => {
    if ( !image ) {
      return;
    }

    const {
      img, ball
    } = image;

    const {
      size,
      position: {
        x, y
      },
    } = ball;

    drawImageWithMask( {
      img,
      maskDrawer: ( graphics ) => {
        graphics.fill( 255 );
        graphics.noStroke();
        graphics.circle(
          x,
          y,
          size
        );
      },
    } );
  } );

  renderTitle( options.sketch?.title );
} );
