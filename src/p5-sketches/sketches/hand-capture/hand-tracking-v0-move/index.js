import options from "@/p5/utils/options.js";

import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import * as common from "@/p5/utils/common.js";

import mediapipe, {
  init as mediapipeInit,
} from "@/p5/utils/mediapipe/mediapipe.js";

import drawHands from "@/p5/utils/mediapipe/drawHands.js";
import neonDot from "@/p5/utils/visuals/neonDot.js";

import Matter from "@/public/assets/libraries/matter.min.js";

import scripts from "@/p5/utils/scripts.js";

scripts.load( "/assets/libraries/decomp.min.js" );

const {
  Engine, Bodies, Composite
} = Matter;

const layers = {
  visuals: {
    graphics: undefined,
    size: options.size,
    background: [
      0,
      0,
      0,
      10
    ],
    erase: 255,
  },
  hands: {
    graphics: undefined,
    size: options.size,
    background: [
      230
    ],
    erase: 255,
  },
};

const matter = {
  engine: Engine.create(),
  bottom: undefined,
  balls: [
  ],
  handBodies: [
  ],
  boundaries: [
  ],
};

sketch.setup( async() => {
  background( ...options.colors.background );

  await mediapipeInit( {
    worker: false,
    tasks: [
      "hands"
    ],
  } );

  for ( const layerName in layers ) {
    const {
      background, size
    } = layers[ layerName ];

    layers[ layerName ].graphics = createGraphics(
      size.width,
      size.height
    );

    if ( background ) {
      layers[ layerName ].graphics.background( ...background );
    }
  }

  // / MATTER
  const margin = 50;
  const thickness = 50;

  addBoundary(
    width / 2,
    height + thickness / 2 - margin,
    width,
    thickness
  );
  addBoundary(
    width / 2,
    -thickness / 2 + margin,
    width,
    thickness
  );
  addBoundary(
    -thickness / 2 + margin,
    height / 2,
    thickness,
    height
  );
  addBoundary(
    width + thickness / 2 - margin,
    height / 2,
    thickness,
    height
  );

  for ( let i = 0; i <= 25; i++ ) {
    addBall(
      random(
        thickness,
        width - thickness
      ),
      random(
        thickness,
        height - thickness
      ),
      random(
        50,
        80
      )
    );
  }
} );

matter.engine.gravity = {
  x: 0,
  y: 0,
};

sketch.draw( (
  time, center, favouriteColour
) => {
  background( ...options.colors.background );

  if ( mediapipe.idle ) {
    background( 90 );
  }

  drawHands(
    mediapipe.tasks?.hands?.result,
    layers.hands.graphics
  );

  // Update hand physics bodies
  updateHandBodies();

  Engine.update( matter.engine );

  // matter.engine.gravity = Vector.create(
  //   mappers.fn(
  //     Math.sin( animation.angle ),
  //     -1,
  //     1,
  //     -1,
  //     1,
  //     // easing.easeInOutExpo
  //   ),
  //   mappers.fn(
  //     Math.cos( animation.angle * 1.5 ),
  //     -1,
  //     1,
  //     -1,
  //     1,
  //     // easing.easeInOutExpo
  //   ),
  // );

  matter.balls.forEach( (
    ball, index
  ) => {
    const {
      position, circleRadius
    } = ball;

    // layers.visuals.graphics.circle(
    //   position.x,
    //   position.y,
    //   circleRadius * 2
    // );

    neonDot( {
      sizeRange: [
        circleRadius * 2,
        ( circleRadius * 2 ) / 3
      ],
      shadowsCount: 3,
      graphics: layers.visuals.graphics,
      position,
      index: index / matter.balls.length,
    } );
  } );

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

  string.write(
    "move",
    0,
    height / 2,
    {
      size: 172,
      strokeWeight: 0,
      stroke: color( ...options.colors.background ),
      fill: color( ...options.colors.background ),
      font: string.fonts.martian,
      textAlign: [
        CENTER,
        CENTER
      ],
      blendMode: EXCLUSION,
    }
  );

  string.write(
    "hand tracking v0",
    0,
    ( height * 6 ) / 10,
    {
      size: 32,
      strokeWeight: 0,
      stroke: color( ...options.colors.background ),
      fill: color( ...options.colors.background ),
      font: string.fonts.loraItalic,
      textAlign: [
        CENTER,
        CENTER
      ],
      blendMode: EXCLUSION,
    }
  );
} );

function updateHandBodies() {
  // Remove old hand bodies
  for ( let handBody of matter.handBodies ) {
    Composite.remove(
      matter.engine.world,
      handBody
    );
  }
  matter.handBodies = [
  ];

  mediapipe.tasks?.hands?.result?.landmarks?.forEach?.( createHandInteractionBodies );
}

// Key landmarks for interaction (palm, fingertips)
const interactionIndices = [
  0,
  4,
  8,
  12,
  16,
  20,
  9
];

function createHandInteractionBodies( hand ) {
  const interactionPoints = interactionIndices
    .map( ( i ) => hand[ i ] )
    .filter( Boolean );

  interactionPoints.forEach( ( point ) => {
    if ( point ) {
      const x = common.inverseX( point.x ) * width;
      const y = point.y * height;

      // Create invisible circular body
      const handBody = Matter.Bodies.circle(
        x,
        y,
        75,
        {
          isStatic: true, // Static so it doesn't fall
          isSensor: false, // Can interact with other bodies
        }
      );

      matter.handBodies.push( handBody );

      Composite.add(
        matter.engine.world,
        handBody
      );
    }
  } );
}

function addBall(
  x, y, radius
) {
  const newBall = Bodies.circle(
    x,
    y,
    radius
    // {
    //   friction: .001,
    //   frictionAir: 0.9,
    //   restitution: 9,
    // }
  );

  matter.balls.unshift( newBall );
  Composite.add(
    matter.engine.world,
    newBall
  );
}

function addBoundary(
  x, y, w, h
) {
  const newBoundary = Bodies.rectangle(
    x,
    y,
    w,
    h,
    {
      isStatic: true,
    }
  );

  matter.boundaries.unshift( newBoundary );
  Composite.add(
    matter.engine.world,
    newBoundary
  );
}
