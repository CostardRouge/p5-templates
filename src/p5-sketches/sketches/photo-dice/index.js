import options from "../../utils/options.js";

import cache from "../../utils/cache.js";
import string from "../../utils/string.js";
import easing from "../../utils/easing.js";
import sketch from "../../utils/sketch.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";

import * as common from "../../utils/common";

const canvases = {
};

const getBg = () =>
  ( options.sketch?.background ??
    options.colors?.background ??
    [
      0
    ] );

const getTextColor = () =>
  ( options.sketch?.text ??
    options.colors?.text ??
    [
      255
    ] );

const getFont = () => {
  const key = options.sketch?.font ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

const easingMap = {
  easeInOutExpo: easing.easeInOutExpo,
  easeInOutElastic: easing.easeInOutElastic,
  easeInOutCirc: easing.easeInOutCirc,
  easeInOutSine: easing.easeInOutSine,
  easeInOutQuad: easing.easeInOutQuad
};

sketch.setup(
  () => {
    canvases.dice = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height,
      WEBGL
    );

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
    }
  }
);

function dice(
  size = width, render
) {
  const rotations = [
    canvases.dice.createVector(), // face
    canvases.dice.createVector(
      0,
      HALF_PI
    ), // right
    canvases.dice.createVector( HALF_PI ), // up
    canvases.dice.createVector(
      0,
      -HALF_PI
    ), // left
    canvases.dice.createVector(
      0,
      PI
    ), // back
    canvases.dice.createVector( -HALF_PI ), // bottom
  ];

  for ( let i = 0; i < rotations.length; i++ ) {
    const {
      x: rX, y: rY /* , z: rZ */ } = rotations[ i ];

    canvases.dice.push();
    canvases.dice.rotateX( rX );
    canvases.dice.rotateY( rY );
    // canvases.dice.rotateZ(rZ)
    canvases.dice.translate(
      0,
      0,
      size / 2
    );

    render(
      i,
      size
    );

    canvases.dice.pop();
  }
}

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...getBg() );

  // Images from UI or cache
  const imagesFromOptions = options.sketch?.images && options.sketch.images.length ? options.sketch.images : null;
  const imagesFromCache = cache.get( "images" );
  const images = imagesFromOptions?.map( imagePath => (
    common.getAsset( imagePath )
  ) ) || imagesFromCache || [
  ];

  const repeatImages = options.sketch?.repeatImages ?? true;

  // Motion controls
  const rotateSpeed = options.sketch?.rotateSpeed ?? 1;
  const easeFn = easingMap[ options.sketch?.easing ] || easing.easeInOutExpo;

  // Calculate current rotation target (6 faces in cycle)
  const {
    x: rX, y: rY /* , z: rZ */ } = animation.ease( {
    values: [
      canvases.dice.createVector(), // face
      canvases.dice.createVector(
        0,
        -HALF_PI
      ), // right
      canvases.dice.createVector( -HALF_PI ), // up
      canvases.dice.createVector(
        0,
        HALF_PI
      ), // left
      canvases.dice.createVector(
        0,
        PI
      ), // back
      canvases.dice.createVector( HALF_PI ), // bottom
    ],
    currentTime: animation.progression * 6 * rotateSpeed,
    lerpFn: p5.Vector.lerp,
    easingFn: easeFn,
  } );

  // Prepare WEBGL canvas
  canvases.dice.push();
  canvases.dice.background( ...getBg() );

  if ( options.sketch?.useOrbitControl ?? true ) {
    canvases.dice.orbitControl();
  }

  canvases.dice.rotateX( rX );
  canvases.dice.rotateY( rY );

  const diceSizeFactor = options.sketch?.diceSizeFactor ?? 1.5;
  const faceScale = options.sketch?.faceScale ?? 0.65;

  dice(
    width / diceSizeFactor,
    (
      index, size
    ) => {
    // pick image for this face
      let imgObj = null;

      if ( images.length > 0 ) {
        const i = repeatImages ? ( index % images.length ) : index;

        imgObj = images[ i ];
      }

      if ( imgObj?.img ) {
        imageUtils.marginImage( {
          position: createVector(
            0,
            0
          ),
          img: imgObj.img,
          scale: faceScale,
          center: true,
          graphics: canvases.dice,
        } );
      } else {
      // fallback: draw a simple face label if no image
        canvases.dice.push();
        canvases.dice.noFill();
        canvases.dice.stroke(
          0,
          50
        );
        canvases.dice.rectMode( CENTER );
        canvases.dice.rect(
          0,
          0,
          size * 0.9,
          size * 0.9
        );
        canvases.dice.pop();
      }
    }
  );

  canvases.dice.pop();

  // Compose to main canvas
  image(
    canvases.dice,
    0,
    0
  );

  // Title overlay (optional)
  const titleVisibleFrom = options.sketch?.titleProgressStart ?? 0.0;
  const titleVisibleTo = options.sketch?.titleProgressEnd ?? 0.2;
  const withinWindow =
    animation.progression >= titleVisibleFrom &&
    animation.progression <= titleVisibleTo;

  if ( ( options.sketch?.showTitle ?? true ) && withinWindow ) {
    const customTitle = options.sketch?.title?.trim?.() || "";
    const defaultTitle = "photo-dice".toUpperCase().replaceAll(
      "-",
      "\n"
    );
    const title = customTitle !== "" ? customTitle : defaultTitle;

    const blendModeValue = options.sketch?.titleBlendMode ?? "exclusion";

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
