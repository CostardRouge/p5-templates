import {
  sketch,
  string,
  scripts,
  common,
  captureOptions as options,
} from "/assets/scripts/p5-sketches/utils/index.js";

import mediapipe from "/assets/scripts/p5-sketches/utils/mediapipe/mediapipe.js";

import drawHands from "./drawHands.js";
import neonDot from "../../utils/visuals/neonDot.js";

await scripts.load( "/assets/libraries/decomp.min.js" );
await scripts.load( "/assets/libraries/matter.min.js" );

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
  },
};

const matter = {
  engine: Engine.create(),
  bottom: undefined,
  balls: [
  ],
  letterBodies: [
  ],
  handBodies: [
  ],
  boundaries: [
  ]
};

sketch.setup(
  () => {
    background( ...options.colors.background );

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
    const margin = BOUNDARY_MARGIN;
    const thickness = BOUNDARY_THICKNESS;

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

    // for ( let i = 0; i < BALLS_COUNT; i++ ) {
    //   addBall(
    //     random(
    //       thickness,
    //       width - thickness
    //     ),
    //     random(
    //       thickness,
    //       height - thickness
    //     ),
    //     random( ...BALLS_SIZE )
    //   );
    // }

    matter.letterBodies = addLetterBoxes( "abcdefghijklmnopqrstuvwxyz" );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration
    }
  }
);

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
    mediapipe.workerResult.hands,
    layers.hands.graphics
  );

  drawLetterBodies(
    layers.visuals.graphics,
    matter.letterBodies
  );

  // Update hand physics bodies
  updateHandBodies();
  applyRestoringForcesTo( matter.balls );
  applyRestoringForcesTo( matter.letterBodies );

  Engine.update( matter.engine );

  matter.balls.forEach( (
    ball, index
  ) => {
    const {
      position, initialPosition, circleRadius
    } = ball;

    // stroke( 0 );
    // line(
    //   position.x,
    //   position.y,
    //   initialPosition.x,
    //   initialPosition.y
    // );

    neonDot( {
      sizeRange: [
        circleRadius * 2,
        circleRadius * 2 / 3
      ],
      shadowsCount: 3,
      graphics: layers.visuals.graphics,
      position,
      index: index / ( matter.balls.length )
    } );
  } );

  for ( const layerName in layers ) {
    const layer = layers[ layerName ];
    const {
      graphics, background, erase, size
    } = layer;

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

  // string.write(
  //   "restore",
  //   0,
  //   height / 2,
  //   {
  //     size: 172,
  //     strokeWeight: 0,
  //     stroke: color( ...options.colors.background ),
  //     fill: color( ...options.colors.background ),
  //     font: string.fonts.martian,
  //     textAlign: [
  //       CENTER,
  //       CENTER
  //     ],
  //     blendMode: EXCLUSION
  //   }
  // );

  // string.write(
  //   "hand tracking v2",
  //   0,
  //   height * 6 / 10,
  //   {
  //     size: 32,
  //     strokeWeight: 0,
  //     stroke: color( ...options.colors.background ),
  //     fill: color( ...options.colors.background ),
  //     font: string.fonts.loraItalic,
  //     textAlign: [
  //       CENTER,
  //       CENTER
  //     ],
  //     blendMode: EXCLUSION
  //   }
  // );
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

  mediapipe.workerResult?.hands?.landmarks?.forEach?.( createHandInteractionBodies );
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
  const interactionPoints = interactionIndices.map( i => hand[ i ] ).filter( Boolean );

  interactionPoints.forEach( point => {
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
      isStatic: true,
    }
  );

  matter.boundaries.unshift( newBoundary );
  Composite.add(
    matter.engine.world,
    newBoundary
  );
}

function applyRestoringForcesTo(
  bodies, strength = 0.0001, maxForce = 0.003
) {
  for ( const body of bodies ) {
    const pos = body.position;
    const angle = body.angle;
    const target = body.initialPosition;

    let fx = ( target.x - pos.x ) * strength;
    let fy = ( target.y - pos.y ) * strength;

    const mag = Math.sqrt( fx ** 2 + fy ** 2 );

    if ( mag > maxForce ) {
      fx = ( fx / mag ) * maxForce;
      fy = ( fy / mag ) * maxForce;
    }

    Matter.Body.applyForce(
      body,
      pos,
      {
        x: fx,
        y: fy
      }
    );
  }
}

function addLetterBoxes( text ) {
  const letterBodies = [
  ];

  for ( let i = 0; i < text.length; i++ ) {
    const char = text[ i ];

    const w = 100;
    const h = 100;

    const x = random(
      BOUNDARY_MARGIN,
      width - BOUNDARY_MARGIN
    );

    const y = random(
      BOUNDARY_MARGIN,
      height - BOUNDARY_MARGIN
    );

    const body = Bodies.rectangle(
      x,
      y,
      w,
      h,
      {
        restitution: 0.4,
        friction: 0.1,
        // isStatic: true, // Static so it doesn't fall
        // isSensor: false, // Can interact with other bodies
      }
    );

    body.label = char;
    body.initialPosition = {
      x,
      y
    };

    Composite.add(
      matter.engine.world,
      body
    );
    letterBodies.push( body );

    // startX += spacing;
  }

  return letterBodies;
}

function drawLetterBodies(
  graphics, bodies
) {
  for ( const body of bodies ) {
    const {
      x, y
    } = body.position;
    const angle = body.angle;

    graphics.push();
    graphics.translate(
      x,
      y
    );
    graphics.rotate( angle );
    graphics.fill( 0 );
    graphics.noStroke();
    graphics.textFont( string.fonts.martian );
    graphics.textSize( 144 );
    graphics.textAlign(
      CENTER,
      CENTER
    );
    graphics.text(
      body.label,
      0,
      0
    );
    graphics.pop();
  }
}

