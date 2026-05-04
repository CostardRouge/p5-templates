import options from "@/p5/utils/options.js";

import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import scripts from "@/p5/utils/scripts.js";

import * as common from "@/p5/utils/common.js";

import mediapipe, {
  init as mediapipeInit
} from "@/p5/utils/mediapipe/mediapipe.js";

import drawHands from "@/p5/utils/mediapipe/drawHands.js";
import neonDot from "@/p5/utils/visuals/neonDot.js";

import Matter from "@/public/assets/libraries/matter.min.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

scripts.load( "/assets/libraries/decomp.min.js" );

const {
  Engine, Bodies, Composite, Vector
} = Matter;

const BALLS_COUNT = 50;
const BALLS_SIZE = [
  40,
  60
];
const BOUNDARY_THICKNESS = 50;
const BOUNDARY_MARGIN = 50;

const layers = {
  visuals: {
    graphics: undefined,
    size: options.size,
    background: [
      80
    ],
    erase: 255
  },
  hands: {
    graphics: undefined,
    size: options.size,
    background: undefined,
    erase: 255
  }
};

const matter = {
  engine: Engine.create(),
  bottom: undefined,
  balls: [],
  handBodies: [],
  boundaries: []
};

sketch.setup( async() => {
  const p = getP5();

  p.background( ...options.colors.background );

  await mediapipeInit( {
    worker: false,
    tasks: [
      "hands"
    ]
  } );

  for ( const layerName in layers ) {
    const {
      background, size
    } = layers[ layerName ];

    layers[ layerName ].graphics = p.createGraphics(
      size.width,
      size.height
    );

    if ( background ) {
      layers[ layerName ].graphics.background( ...background );
    }
  }

  // / MATTER
  const margin = BOUNDARY_MARGIN;
  const thickness = BOUNDARY_THICKNESS;

  addBoundary(
    p.width / 2,
    p.height + thickness / 2 - margin,
    p.width,
    thickness
  );
  addBoundary(
    p.width / 2,
    -thickness / 2 + margin,
    p.width,
    thickness
  );
  addBoundary(
    -thickness / 2 + margin,
    p.height / 2,
    thickness,
    p.height
  );
  addBoundary(
    p.width + thickness / 2 - margin,
    p.height / 2,
    thickness,
    p.height
  );

  for ( let i = 0; i < BALLS_COUNT; i++ ) {
    addBall(
      p.random(
        thickness,
        p.width - thickness
      ),
      p.random(
        thickness,
        p.height - thickness
      ),
      p.random( ...BALLS_SIZE )
    );
  }
} );

matter.engine.gravity = {
  x: 0,
  y: 0
};

sketch.draw( (
  time, center, favouriteColour
) => {
  const p = getP5();

  p.background( ...options.colors.background );

  if ( mediapipe.idle ) {
    p.background( 90 );
  }

  drawHands(
    mediapipe.tasks?.hands?.result,
    layers.hands.graphics
  );

  // Update hand physics bodies
  updateHandBodies();
  applyRestoringForces( 0.01 );

  Engine.update( matter.engine );

  matter.balls.forEach( (
    ball, index
  ) => {
    const {
      position, initialPosition, circleRadius
    } = ball;

    // p.stroke( 0 );
    // p.line(
    //   position.x,
    //   position.y,
    //   initialPosition.x,
    //   initialPosition.y
    // );

    neonDot( {
      sizeRange: [
        circleRadius * 2,
        ( circleRadius * 2 ) / 3
      ],
      shadowsCount: 3,
      graphics: layers.visuals.graphics,
      position,
      index: index / matter.balls.length
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

  string.write(
    "restore",
    0,
    p.height / 2,
    {
      size: 172,
      strokeWeight: 0,
      stroke: p.color( ...options.colors.background ),
      fill: p.color( ...options.colors.background ),
      font: string.fonts.martian,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      blendMode: p.EXCLUSION
    }
  );

  string.write(
    "hand tracking v3",
    0,
    ( p.height * 6 ) / 10,
    {
      size: 32,
      strokeWeight: 0,
      stroke: p.color( ...options.colors.background ),
      fill: p.color( ...options.colors.background ),
      font: string.fonts.loraItalic,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      blendMode: p.EXCLUSION
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
  matter.handBodies = [];

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
  const p = getP5();
  const interactionPoints = interactionIndices
    .map( ( i ) => hand[ i ] )
    .filter( Boolean );

  interactionPoints.forEach( ( point ) => {
    if ( point ) {
      const x = common.inverseX( point.x ) * p.width;
      const y = point.y * p.height;

      // Create invisible circular body
      const handBody = Matter.Bodies.circle(
        x,
        y,
        75,
        {
          isStatic: true, // Static so it doesn't fall
          isSensor: false // Can interact with other bodies
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
  );

  newBall.initialPosition = {
    x,
    y
  };

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
      isStatic: true
    }
  );

  matter.boundaries.unshift( newBoundary );
  Composite.add(
    matter.engine.world,
    newBoundary
  );
}

function applyRestoringForces(
  strength = 0.0001, maxForce = 0.003
) {
  for ( const ball of matter.balls ) {
    const pos = ball.position;
    const target = ball.initialPosition;

    let fx = ( target.x - pos.x ) * strength;
    let fy = ( target.y - pos.y ) * strength;

    // Clamp force magnitude
    const mag = Math.sqrt( fx ** 2 + fy ** 2 );

    if ( mag > maxForce ) {
      fx = ( fx / mag ) * maxForce;
      fy = ( fy / mag ) * maxForce;
    }

    Matter.Body.applyForce(
      ball,
      pos,
      {
        x: fx,
        y: fy
      }
    );
  }
}
