import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import grid from "@/p5/utils/grid.js";
import graphics from "@/p5/utils/graphics.js";
import colors from "@/p5/utils/colors.js";
import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import addScreenPositionFunction from "@/public/assets/libraries/addScreenPositionFunction.js";

import mediapipe, {
  init as mediapipeInit,
  setEnabled as setMediapipeEnabled,
} from "@/p5/utils/mediapipe/mediapipe.js";

// Key landmarks for interaction (fingertips)
const interactionIndices = [
  4,
  8,
  12,
  16,
  20
];

const sketchState = {
  interactive: {
    image: null,
  },
  shape: {
    graphics: null,
  },
  webcam: {
    graphics: null,
  },
};

sketch.setup( async( {
  canvas
} ) => {
  background( ...getBackgroundColor() );

  sketchState.shape.graphics = graphics.createAutoResizableGraphics(
    width,
    height,
    "webgl"
  );
  addScreenPositionFunction( sketchState.shape.graphics );

  sketchState.webcam.graphics = createGraphics(
    width,
    height
  );

  await mediapipeInit( {
    worker: false,
    tasks: [
      "hands"
    ],
  } );
} );

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

sketch.draw( () => {
  background( ...getBackgroundColor() );

  renderTitle( options.sketch?.title );

  // Dynamically enable/disable mediapipe based on useHands option
  const useHands = options.sketch.animation.useHands ?? true;

  setMediapipeEnabled( useHands );

  const columns = options.sketch?.grid?.columns ?? 65;
  const rows = ( columns * height ) / width;
  const cellSize = width / columns;

  const gridOptions = {
    topLeft: createVector(
      -width / 2,
      -height / 2
    ),
    topRight: createVector(
      width / 2,
      -height / 2
    ),
    bottomLeft: createVector(
      -width / 2,
      height / 2
    ),
    bottomRight: createVector(
      width / 2,
      height / 2
    ),
    rows,
    columns,
    centered: true,
  };

  const gap = options.sketch.grid.gap ?? 3;
  const w = cellSize - gap;
  const h = cellSize - gap;
  const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
  const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
  const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

  const maxInfluenceDistance =
    options.sketch.animation.maxInfluenceDistance ?? 150;

  const targetVectors = [
  ];

  if ( options.sketch.animation.useMouse ?? true ) {
    sketchState.shape.graphics.screenPosition( createVector(
      mouseX - width / 2,
      mouseY - height / 2
    ) );
  }

  if ( options.sketch.animation.useHands ?? true ) {
    mediapipe.tasks?.hands?.result?.landmarks?.forEach( ( hand ) => {
      const interactionPoints = interactionIndices
        .map( ( i ) => hand[ i ] )
        .filter( Boolean );

      interactionPoints.forEach( ( point ) => {
        if ( point ) {
          const x = common.inverseX( point.x ) * width;
          const y = point.y * height;

          targetVectors.push( sketchState.shape.graphics.screenPosition( createVector(
            x - width / 2,
            y - height / 2
          ) ) );
        }
      } );
    } );
  }

  const margin = 150;
  const W = width / 2 - margin;
  const H = height / 2 - margin;
  const targetsCount = options.sketch.animation.spheresCount ?? 3;

  for ( let i = 0; i < targetsCount; i++ ) {
    const targetProgression = i / targetsCount;

    targetVectors.push( sketchState.shape.graphics.screenPosition( createVector(
      Math.sin( animation.angle + i * 2 ) * W,
      Math.cos( animation.angle + i * targetProgression ) * H
    ) ) );
  }

  if ( options.sketch.animation.showSpheres ?? true ) {
    targetVectors.forEach( ( vector ) => {
      sketchState.shape.graphics.push();
      sketchState.shape.graphics.translate(
        vector.x,
        vector.y,
        50
      );
      sketchState.shape.graphics.normalMaterial( vector );
      sketchState.shape.graphics.sphere( options.sketch.animation.sphereSize ?? 30 );
      sketchState.shape.graphics.pop();
    } );
  }

  grid.draw(
    gridOptions,
    ( position ) => {
      sketchState.shape.graphics.push();
      sketchState.shape.graphics.translate( position );

      let minDistance = Infinity;

      for ( let i = 0; i < targetVectors.length; i++ ) {
        const target = targetVectors[ i ];
        const distance = position.dist( target );

        if ( distance < minDistance ) {
          minDistance = distance;
        }
      }

      const proximity = map(
        minDistance,
        0,
        maxInfluenceDistance,
        1,
        0
      );

      // Ensure the value is clamped between 0 and 1
      const switchIndex = constrain(
        proximity,
        0,
        1
      );

      const depthMax = cellSize * ( options.sketch?.grid?.depth ?? 20 );

      const depth = animation.ease( {
        values: [
          depthMax,
          cellSize
        ],
        currentTime: switchIndex,
        easingFn: easing?.[ options.sketch.animation.easing ] ?? easing.easeOutBack,
      } );

      const fillAlpha = animation.ease( {
        values: [
          fillAlphaStart,
          fillAlphaEnd
        ],
        currentTime: switchIndex,
      } );

      const hue = sketchState.shape.graphics.noise(
        position.x / columns / 5,
        position.y / rows / 5
      // switchIndex
      );
      const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 2;
      const opacityFactor = options.sketch?.color?.opacityFactor ?? 1.5;

      const tint = colors.rainbow( {
        hueOffset: switchIndex,
        hueIndex:
        sketchState.shape.graphics.map(
          hue,
          0,
          1,
          -PI,
          PI
        ) * hueMultiplier,
        opacityFactor,
      } );

      const {
        levels: [
          red,
          green,
          blue
        ],
      } = tint;

      sketchState.shape.graphics.fill(
        red,
        green,
        blue,
        fillAlpha
      );
      sketchState.shape.graphics.stroke(
        red,
        green,
        blue,
        strokeAlpha
      );

      sketchState.shape.graphics.box(
        w,
        h,
        -depth
      );

      sketchState.shape.graphics.pop();
    }
  );

  // SHAPE
  image(
    sketchState.shape.graphics,
    0,
    0
  );
  sketchState.shape.graphics.clear();

  // WEBCAM - only render if enabled and capture element exists
  if ( mediapipe.enabled && mediapipe.capture.element ) {
    sketchState.webcam.graphics.clear();
    sketchState.webcam.graphics.image(
      mediapipe.capture.element,
      0,
      0,
      mediapipe.capture.size.width * 2,
      mediapipe.capture.size.height * 2
    );
    // sketchState.webcam.graphics.filter( POSTERIZE );
    // sketchState.webcam.graphics.filter( INVERT );
    // sketchState.webcam.graphics.filter( GRAY );
    image(
      sketchState.webcam.graphics,
      0,
      0,
      width,
      height
    );
  }
} );
