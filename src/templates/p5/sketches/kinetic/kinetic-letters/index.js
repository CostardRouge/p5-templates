import options from "@/p5/utils/options.js";

import cache from "@/p5/utils/cache.js";
import shapes from "@/p5/utils/shapes.js";
import events from "@/p5/utils/events.js";
import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import graphics from "@/p5/utils/graphics.js";
import * as common from "@/p5/utils/common.js";
import animation from "@/p5/utils/animation.js";

import drawHands from "@/p5/utils/mediapipe/drawHands.js";

import mediapipe, {
  init as mediapipeInit, setEnabled as setMediapipeEnabled
} from "@/p5/utils/mediapipe/mediapipe.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

// Key landmarks for interaction (palm, fingertips)
const interactionIndices = [
  // 0,
  4,
  8,
  12,
  16
  // 20,
];

const layers = {
  hands: {
    graphics: undefined,
    size: options.size,
    background: undefined,
    erase: 255
  },
  visuals: {
    graphics: undefined,
    size: options.size,
    background: [
      80
    ],
    erase: 255
  },
  pointers: {
    graphics: undefined,
    size: options.size,
    background: undefined,
    erase: 255
  }
};

const sketchState = {
  letters: [],
  handPointingImage: null
};

events.register(
  "engine-window-preload",
  () => {
    const p = getP5();

    sketchState.handPointingImage = getP5().loadImage( "/assets/images/handpointing.png" );
  }
);

sketch.setup( async() => {
  const p = getP5();

  p.background( ...( options.sketch.backgroundColor ?? [
    246,
    235,
    225
  ] ) );

  await mediapipeInit( {
    enableCapture: false,
    worker: false,
    tasks: [
      "hands"
    ]
  } );

  for ( const layerName in layers ) {
    const {
      background, size
    } = layers[ layerName ];

    layers[ layerName ].graphics = graphics.createAutoResizableGraphics(
      size.width,
      size.height
    );

    if ( background ) {
      layers[ layerName ].graphics.background( ...background );
    }
  }
} );

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    246,
    235,
    225
  ] ) );

  const useHands = options.sketch.interactive.useHands ?? false;

  setMediapipeEnabled( useHands );

  sketchState.letters = cache.store(
    cache.key(
      options.sketch.text,
      options.sketch.letterPositionMargin
    ),
    () =>
      addLetterBoxes(
        options.sketch.text,
        options.sketch.letterPositionMargin
      )
  );

  drawHands(
    mediapipe.tasks?.hands?.result,
    layers.hands.graphics
  );

  const targetVectors = [];

  if ( options.sketch.interactive.useMouse ) {
    targetVectors.push( p.createVector(
      p.mouseX,
      p.mouseY
    ) );
  }

  if ( useHands ) {
    mediapipe.tasks?.hands?.result?.landmarks?.forEach( ( hand ) => {
      const interactionPoints = interactionIndices
        .map( ( i ) => hand[ i ] )
        .filter( Boolean );

      interactionPoints.forEach( ( point ) => {
        if ( point ) {
          const x = common.inverseX( point.x ) * p.width;
          const y = point.y * p.height;

          targetVectors.push( p.createVector(
            x,
            y
          ) );
        }
      } );
    } );
  }

  const margin = options.sketch.interactive.pointersMargin ?? 150;
  const pointersCount = options.sketch.interactive.pointersCount ?? 5;
  const W = p.width - margin;
  const H = p.height - margin;

  // Loop-exact clock: sin/cos only close when the multiplier on
  // animation.angle is a WHOLE number of turns per loop (the progression
  // multipliers below are a static per-pointer phase offset, not a time
  // rate, so they don't need snapping).
  const pointersSinAngleTurns = Math.round( options.sketch.interactive.pointersSinAngleMultiplier );
  const pointersCosAngleTurns = Math.round( options.sketch.interactive.pointersCosAngleMultiplier );

  for ( let pointerIndex = 0; pointerIndex < pointersCount; pointerIndex++ ) {
    const handProgression = pointerIndex / pointersCount;

    const pointerPosition = p.createVector(
      p.map(
        Math.sin( animation.angle *
            pointersSinAngleTurns +
            handProgression *
              options.sketch.interactive.pointersSinProgressionMultiplier ),
        -1,
        1,
        margin,
        W
      ),
      p.map(
        Math.cos( animation.angle *
            pointersCosAngleTurns +
            handProgression *
              options.sketch.interactive.pointersCosProgressionMultiplier ),
        -1,
        1,
        margin,
        H
      )
    );

    targetVectors.push( pointerPosition );
  }

  if ( options.sketch.interactive.pointersLinesShow ) {
    layers.pointers.graphics?.stroke( ...( options.sketch.interactive.pointersLinesStroke ?? [
      0
    ] ) );

    layers.pointers.graphics?.strokeWeight( options.sketch.interactive.pointersLinesStrokeWeight );

    targetVectors.forEach( ( vector ) => {
      shapes.vl(
        vector.x,
        layers.pointers.graphics
      );
      shapes.hl(
        vector.y,
        layers.pointers.graphics
      );

      if (
        layers.pointers.graphics && options.sketch.interactive.pointersImageShow
      ) {
        layers.pointers.graphics.image(
          sketchState.handPointingImage,
          vector.x,
          vector.y
        );
      }
    } );
  }

  if ( layers.visuals.graphics ) {
    drawLetterBodies(
      layers.visuals.graphics,
      sketchState.letters,
      targetVectors
    );
  }

  for ( const layerName in layers ) {
    const layer = layers[ layerName ];
    const {
      graphics, background, erase, size
    } = layer;

    if ( !graphics ) {
      continue;
    }

    p.image(
      graphics,
      0,
      0,
      size.width,
      size.height
    );

    if ( background ) {
      graphics.background( ...background );
    }

    if ( erase ) {
      layer.graphics.clear();
    }
  }
} );

function addLetterBoxes(
  text, margin = 50
) {
  const p = getP5();
  const letterBodies = [];

  for ( let i = 0; i < text.length; i++ ) {
    const x = p.random(
      margin,
      p.width - margin
    );

    const y = p.random(
      margin,
      p.height - margin
    );

    letterBodies.push( {
      x,
      y,
      char: text[ i ]
    } );
  }

  return letterBodies;
}

function drawLetterBodies(
  graphics, bodies, targetVectors
) {
  const p = getP5();
  const sizeValues = [
    options.sketch.minLetterSize,
    options.sketch.maxLetterSize
  ];

  for ( const body of bodies ) {
    const {
      x, y, char
    } = body;

    const switchIndex = computeDisplacement(
      p.createVector(
        x,
        y
      ),
      targetVectors,
      options.sketch.interactive.maxInfluenceDistance ?? 250
    );

    graphics?.push();
    graphics?.translate(
      x,
      y
    );

    if ( options.sketch.interactive.varyAngle ) {
      const angle = animation.ease( {
        values: [
          0,
          p.PI
        ],
        currentTime: switchIndex,
        easingFn:
          easing?.[ options.sketch.interactive.easing ] ?? easing.easeOutSine
      } );

      graphics.rotate( angle );
    }

    graphics.fill( ...( options.sketch.fill ?? [
      0
    ] ) );
    graphics.stroke( ...( options.sketch.stroke ?? [
      0
    ] ) );
    graphics.strokeWeight( options.sketch.strokeWeight );
    graphics.textFont( string.fonts?.[ options.sketch.font ] ?? string.fonts.waverseVariable );

    if ( options.sketch.interactive.varySize ) {
      const size = animation.ease( {
        values: sizeValues,
        currentTime: switchIndex,
        easingFn:
          easing?.[ options.sketch.interactive.easing ] ?? easing.easeOutSine
      } );

      graphics.textSize( size );
    } else {
      graphics.textSize( options.sketch.minLetterSize );
    }

    graphics.textAlign(
      p.CENTER,
      p.CENTER
    );
    graphics.text(
      char,
      0,
      0
    );
    graphics.pop();
  }
}

function computeDisplacement(
  position, targetVectors, maxInfluenceDistance
) {
  const p = getP5();
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
  return p.constrain(
    proximity,
    0,
    1
  );
}
