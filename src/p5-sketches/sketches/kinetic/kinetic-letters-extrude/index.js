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
  init as mediapipeInit,
  setEnabled as setMediapipeEnabled,
} from "@/p5/utils/mediapipe/mediapipe.js";

// Key landmarks for interaction (palm, fingertips)
const interactionIndices = [
  // 0,
  4,
  8,
  12,
  16,
  // 20,
];

const layers = {
  hands: {
    graphics: undefined,
    size: options.size,
    background: undefined,
    erase: 255,
  },
  visuals: {
    graphics: undefined,
    size: options.size,
    background: [
      80
    ],
    erase: 255,
  },
  pointers: {
    graphics: undefined,
    size: options.size,
    background: undefined,
    erase: 255,
  },
};

const sketchState = {
  letters: [
  ],
  handPointingImage: null,
};

events.register(
  "engine-window-preload",
  () => {
    sketchState.handPointingImage = loadImage( "/assets/images/handpointing.png" );
  }
);

sketch.setup(
  async() => {
    background( ...( options.sketch.backgroundColor ?? [
      246,
      235,
      225
    ] ) );

    await mediapipeInit( {
      enableCapture: false,
      worker: false,
      tasks: [
        "hands"
      ],
    } );

    for ( const layerName in layers ) {
      const {
        background, size
      } = layers[ layerName ];

      layers[ layerName ].graphics = graphics.createAutoResizableGraphics(
        size.width,
        size.height,
        "webgl"
      );

      if ( background ) {
        layers[ layerName ].graphics.background( ...background );
      }
    }
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

sketch.draw( () => {
  background( ...( options.sketch.backgroundColor ?? [
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

  const targetVectors = [
  ];

  if ( options.sketch.interactive.useMouse ) {
    targetVectors.push( createVector(
      mouseX,
      mouseY
    ) );
  }

  if ( useHands ) {
    mediapipe.tasks?.hands?.result?.landmarks?.forEach( ( hand ) => {
      const interactionPoints = interactionIndices
        .map( ( i ) => hand[ i ] )
        .filter( Boolean );

      interactionPoints.forEach( ( point ) => {
        if ( point ) {
          const x = common.inverseX( point.x ) * width;
          const y = point.y * height;

          targetVectors.push( createVector(
            x,
            y
          ) );
        }
      } );
    } );
  }

  const margin = options.sketch.interactive.pointersMargin ?? 150;
  const pointersCount = options.sketch.interactive.pointersCount ?? 5;
  const W = width - margin;
  const H = height - margin;

  for ( let p = 0; p < pointersCount; p++ ) {
    const handProgression = p / pointersCount;

    const pointerPosition = createVector(
      map(
        Math.sin( animation.angle *
            options.sketch.interactive.pointersSinAngleMultiplier +
            handProgression *
              options.sketch.interactive.pointersSinProgressionMultiplier ),
        -1,
        1,
        margin,
        W
      ),
      map(
        Math.cos( animation.angle *
            options.sketch.interactive.pointersCosAngleMultiplier +
            handProgression *
              options.sketch.interactive.pointersCosProgressionMultiplier ),
        -1,
        1,
        margin,
        H
      )
    );

    targetVectors.push( pointerPosition );

    if ( options.sketch.interactive.pointersLinesShow ) {
      layers.pointers.graphics?.stroke( ...( options.sketch.interactive.pointersLinesStroke ?? [
        0
      ] ) );

      layers.pointers.graphics?.strokeWeight( options.sketch.interactive.pointersLinesStrokeWeight );

      shapes.vl(
        pointerPosition.x,
        layers.pointers.graphics
      );
      shapes.hl(
        pointerPosition.y,
        layers.pointers.graphics
      );
    }

    if (
      layers.pointers.graphics &&
      options.sketch.interactive.pointersImageShow
    ) {
      layers.pointers.graphics.image(
        sketchState.handPointingImage,
        pointerPosition.x,
        pointerPosition.y
      );
    }
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

    image(
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
  const letterBodies = [
  ];

  for ( let i = 0; i < text.length; i++ ) {
    const x = random(
      margin,
      width - margin
    ) - width / 2;

    const y = random(
      margin,
      height - margin
    ) - height / 2;

    letterBodies.push( {
      x,
      y,
      char: text[ i ],
    } );
  }

  return letterBodies;
}

function drawLetterBodies(
  graphics, bodies, targetVectors
) {
  const sizeValues = [
    options.sketch.minLetterSize,
    options.sketch.maxLetterSize,
  ];

  for ( const body of bodies ) {
    const {
      x, y, char
    } = body;

    const switchIndex = computeDisplacement(
      createVector(
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
          PI
        ],
        currentTime: switchIndex,
        easingFn:
          easing?.[ options.sketch.interactive.easing ] ?? easing.easeOutSine,
      } );

      graphics.rotateZ( angle );
    }

    // 3D extrusion when switchIndex is close to 1
    if ( switchIndex > 0.8 ) {
      const extrusionDepth = map(
        switchIndex,
        0.8,
        1,
        0,
        100
      );
      const layers = 10;

      for ( let i = 0; i < layers; i++ ) {
        const z = map(
          i,
          0,
          layers - 1,
          0,
          extrusionDepth
        );
        const alpha = map(
          i,
          0,
          layers - 1,
          255,
          50
        );

        graphics.push();
        graphics.translate(
          0,
          0,
          z
        );

        const fillColor = options.sketch.fill ?? [
          0
        ];
        const strokeColor = options.sketch.stroke ?? [
          0
        ];

        graphics.fill(
          ...fillColor.slice(
            0,
            3
          ),
          alpha
        );
        graphics.stroke(
          ...strokeColor.slice(
            0,
            3
          ),
          alpha
        );
        graphics.strokeWeight( options.sketch.strokeWeight );
        graphics.textFont( string.fonts?.[ options.sketch.font ] ?? string.fonts.waverseVariable );

        if ( options.sketch.interactive.varySize ) {
          const size = animation.ease( {
            values: sizeValues,
            currentTime: switchIndex,
            easingFn:
              easing?.[ options.sketch.interactive.easing ] ?? easing.easeOutSine,
          } );

          graphics.textSize( size );
        } else {
          graphics.textSize( options.sketch.minLetterSize );
        }

        graphics.textAlign(
          CENTER,
          CENTER
        );
        graphics.text(
          char,
          0,
          0
        );
        graphics.pop();
      }
    } else {
      // Normal 2D drawing
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
            easing?.[ options.sketch.interactive.easing ] ?? easing.easeOutSine,
        } );

        graphics.textSize( size );
      } else {
        graphics.textSize( options.sketch.minLetterSize );
      }

      graphics.textAlign(
        CENTER,
        CENTER
      );
      graphics.text(
        char,
        0,
        0
      );
    }

    graphics.pop();
  }
}

function computeDisplacement(
  position, targetVectors, maxInfluenceDistance
) {
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
  return constrain(
    proximity,
    0,
    1
  );
}
