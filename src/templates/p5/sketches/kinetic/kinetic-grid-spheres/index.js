import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import grid from "@/p5/utils/grid.js";
import graphics from "@/p5/utils/graphics.js";
import colors from "@/p5/utils/colors.js";
import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import addScreenPositionFunction from "@/utils/addScreenPositionFunction.js";

import mediapipe, {
  init as mediapipeInit, setEnabled as setMediapipeEnabled
} from "@/p5/utils/mediapipe/mediapipe.js"; // Key landmarks for interaction (fingertips)

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
    image: null
  },
  shape: {
    graphics: null
  },
  webcam: {
    graphics: null
  }
};

sketch.setup( async( {
  canvas
} ) => {
  const p = getP5();

  p.background( ...getBackgroundColor() );

  sketchState.shape.graphics = graphics.createAutoResizableGraphics(
    p.width,
    p.height,
    "webgl"
  );

  addScreenPositionFunction( sketchState.shape.graphics );

  sketchState.webcam.graphics = p.createGraphics(
    p.width,
    p.height
  );

  await mediapipeInit( {
    worker: false,
    tasks: [
      "hands"
    ]
  } );
} );

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    246,
    235,
    225
  ];

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...getBackgroundColor() );

  renderTitle( options.sketch?.title );

  // Dynamically enable/disable mediapipe based on useHands option
  const useHands = options.sketch.animation.useHands ?? true;

  setMediapipeEnabled( useHands );

  const columns = options.sketch?.grid?.columns ?? 65;
  const rows = ( columns * p.height ) / p.width;
  const cellSize = p.width / columns;

  const gridOptions = {
    topLeft: p.createVector(
      -p.width / 2,
      -p.height / 2
    ),
    topRight: p.createVector(
      p.width / 2,
      -p.height / 2
    ),
    bottomLeft: p.createVector(
      -p.width / 2,
      p.height / 2
    ),
    bottomRight: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    rows,
    columns,
    centered: true
  };

  const gap = options.sketch.grid.gap ?? 3;
  const w = cellSize - gap;
  const h = cellSize - gap;
  const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
  const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
  const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

  const maxInfluenceDistance =
    options.sketch.animation.maxInfluenceDistance ?? 150;

  const targetVectors = [];

  if ( options.sketch.animation.useMouse ?? true ) {
    sketchState.shape.graphics.screenPosition( p.createVector(
      p.mouseX - p.width / 2,
      p.mouseY - p.height / 2
    ) );
  }

  if ( options.sketch.animation.useHands ?? true ) {
    mediapipe.tasks?.hands?.result?.landmarks?.forEach( ( hand ) => {
      const interactionPoints = interactionIndices
        .map( ( i ) => hand[ i ] )
        .filter( Boolean );

      interactionPoints.forEach( ( point ) => {
        if ( point ) {
          const x = common.inverseX( point.x ) * p.width;
          const y = point.y * p.height;

          targetVectors.push( sketchState.shape.graphics.screenPosition( p.createVector(
            x - p.width / 2,
            y - p.height / 2
          ) ) );
        }
      } );
    } );
  }

  const margin = 150;
  const W = p.width / 2 - margin;
  const H = p.height / 2 - margin;
  const targetsCount = options.sketch.animation.spheresCount ?? 3;

  for ( let i = 0; i < targetsCount; i++ ) {
    const targetProgression = i / targetsCount;

    targetVectors.push( ( p.createVector(
      p.map(
        Math.sin( animation.angle + i * 2 ),
        -1,
        1,
        -W,
        W
      ),
      p.map(
        Math.cos( animation.angle + i * targetProgression ),
        -1,
        1,
        -H,
        H
      )
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

      const proximity = p.map(
        minDistance,
        0,
        maxInfluenceDistance,
        1,
        0
      );

      // Ensure the value is clamped between 0 and 1
      const switchIndex = p.constrain(
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
        easingFn: easing?.[ options.sketch.animation.easing ] ?? easing.easeOutBack
      } );

      const fillAlpha = animation.ease( {
        values: [
          fillAlphaStart,
          fillAlphaEnd
        ],
        currentTime: switchIndex
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
          -p.PI,
          p.PI
        ) * hueMultiplier,
        opacityFactor
      } );

      const {
        levels: [
          red,
          green,
          blue
        ]
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
  p.image(
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
    p.image(
      sketchState.webcam.graphics,
      0,
      0,
      p.width,
      p.height
    );
  }
} );
