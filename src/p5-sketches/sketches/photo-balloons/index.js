import options from "../../utils/options.js";

import cache from "../../utils/cache.js";
import string from "../../utils/string.js";
import easing from "../../utils/easing.js";
import sketch from "../../utils/sketch.js";
import mappers from "../../utils/mappers.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";

import * as common from "../../utils/common";

const canvases = {
  mask: undefined,
  imageBuffer: undefined,
};

/* ---------- helpers ---------- */

const getBg = () =>
  ( options.sketch?.background ??
    [
      255
    ] );

const getTextColor = () =>
  ( options.sketch?.text ??
    [
      0
    ] );

const getFont = () => {
  const key = options.sketch?.font ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

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
  const minBallSize = options.sketch?.minBallSize ?? 200;
  const maxBallSize = options.sketch?.maxBallSize ?? 400;
  const phaseJitter = options.sketch?.phaseJitter ?? 1;

  return {
    position: createVector(
      width / 2,
      height / 2
    ),
    size: random(
      minBallSize,
      maxBallSize
    ),
    vx: random(
      -1,
      1
    ) * phaseJitter,
    vy: random(
      -1,
      1
    ) * phaseJitter
  };
}

function ensureBalls( images ) {
  images.forEach( imgObj => {
    if ( imgObj && !imgObj.ball ) {
      imgObj.ball = initBall();
    }
  } );
}

/* ---------- mask draw helper ---------- */

function drawImageWithMask( {
  img, maskDrawer, graphics = window
} ) {
  imageUtils.marginImage( {
    img,
    fill: options.sketch?.imageFill ?? true,
    center: options.sketch?.centerImage ?? true,
    graphics: canvases.imageBuffer,
    position: createVector(
      width / 2,
      height / 2
    ),
  } );

  // Reset mask to transparent
  canvases.mask.erase();
  canvases.mask.rect(
    0,
    0,
    graphics.width,
    graphics.height
  );
  canvases.mask.noErase();

  // Fill mask background with near-transparent (keep alpha param)
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

sketch.setup(
  () => {
    canvases.mask = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    canvases.imageBuffer = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
    );

    background( ...getBg() );

    ensureBalls( getImages() );
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

/* ---------- draw ---------- */

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...getBg() );

  const images = getImages();

  ensureBalls( images );

  // Travel area configuration
  const m = options.sketch?.travelMargin ?? 100;
  const minWAmp = options.sketch?.minWidthAmplitude ?? 200;
  const minHAmp = options.sketch?.minHeightAmplitude ?? 6;

  const w = width / 2;
  const h = height / 2;

  const angleSpeed = options.sketch?.angleSpeed ?? 1;

  const showLines = options.sketch?.showLines ?? true;
  const lineColor = options.sketch?.lineColor ?? [
    0,
    0,
    0
  ];
  const lineWeight = options.sketch?.lineWeight ?? 1;
  const lineMaxDist = options.sketch?.lineMaxDistance ?? 1000;
  const lineAlphaScale = options.sketch?.lineAlphaScale ?? 100;

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
      size, position: {
        x, y
      }
    } = ball;

    drawImageWithMask( {
      img,
      maskDrawer: graphics => {
        graphics.fill( 255 );
        graphics.noStroke();
        graphics.circle(
          x,
          y,
          size
        );
      }
    } );
  } );

  // Title overlay
  const titleVisibleFrom = options.sketch?.titleProgressStart ?? 0.0;
  const titleVisibleTo = options.sketch?.titleProgressEnd ?? 0.2;
  const withinWindow =
    animation.progression >= titleVisibleFrom &&
    animation.progression <= titleVisibleTo;

  if ( ( options.sketch?.showTitle ?? true ) && withinWindow ) {
    const customTitle = options.sketch?.title?.trim?.() || "";
    const defaultTitle = "photo-balloons".toUpperCase().replaceAll(
      "-",
      "\n"
    );
    const title = customTitle !== "" ? customTitle : defaultTitle;

    const blendModeValue = options.sketch?.titleBlendMode;

    string.write(
      title,
      0,
      height / 2,
      {
        size: options.sketch?.titleSize ?? 128,
        stroke: color( ...getTextColor() ),
        fill: color( ...getBg() ),
        font: getFont(),
        textAlign: [
          CENTER,
          CENTER
        ],
        blendMode: blendModeValue
      }
    );
  }
} );
