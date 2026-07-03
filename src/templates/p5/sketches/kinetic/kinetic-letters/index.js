import options from "@/p5/utils/options.js";

import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";

import {
  initInteraction,
  getPointers
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";

// The letters live on their own buffer so their per-letter transforms stay
// isolated from the main canvas; the interaction overlay (crosshairs, pointer
// markers, camera preview…) then draws on top via drawInteractionOverlay.
const layers = {
  visuals: {
    graphics: undefined,
    size: options.size,
    background: [
      80
    ],
    erase: 255
  }
};

const sketchState = {
  letters: []
};

const getBackgroundColor = () =>
  options.sketch.backgroundColor ?? [
    246,
    235,
    225
  ];

sketch.setup( async() => {
  const p = getP5();

  p.background( ...getBackgroundColor() );

  // One call boots every enabled interaction source (mouse, touch, vision,
  // orbit, audio, gyroscope…) declared in the shared `interaction` options.
  await initInteraction( options.sketch?.interaction ?? {} );

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
  const interaction = options.sketch?.interaction ?? {};

  p.clear();
  p.background( ...getBackgroundColor() );

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

  // Every enabled source — pointer, hands, orbit, … — merged into one flat list
  // of influence points, replacing the old hand-rolled mouse/hands/pointer loop.
  const targetVectors = getPointers( interaction );

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

  // Shared debug/demo overlay: crosshair lines, pointer markers, finger chains,
  // camera preview and legend — all gated by the `interaction.visualization`
  // options, so it's safe to call unconditionally.
  drawInteractionOverlay( interaction );
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
  const response = options.sketch.response ?? {};
  const easingFn = easing?.[ response.easing ] ?? easing.easeOutSine;
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
      response.maxInfluenceDistance ?? 250
    );

    graphics?.push();
    graphics?.translate(
      x,
      y
    );

    if ( response.varyAngle ) {
      const angle = animation.ease( {
        values: [
          0,
          p.PI
        ],
        currentTime: switchIndex,
        easingFn
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

    if ( response.varySize ) {
      const size = animation.ease( {
        values: sizeValues,
        currentTime: switchIndex,
        easingFn
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
