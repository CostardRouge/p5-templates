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
    erase: 255
  },
  hands: {
    graphics: undefined,
    size: options.size,
    background: [
      230
    ],
    erase: 255
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

    for ( let i = 0; i <= 50; i++ ) {
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
          20,
          50
        )
      );
    }
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

  if ( !mediapipe.idle ) {
    drawHands(
      mediapipe.workerResult.hands,
      layers.hands.graphics
    );

    // Update hand physics bodies
    updateHandBodies();
    applyRepulsionFromHands();

    Engine.update( matter.engine );

    matter.balls.forEach( (
      ball, index
    ) => {
      const {
        position, circleRadius
      } = ball;

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
  }

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

  string.write(
    "repulse",
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
      blendMode: EXCLUSION
    }
  );

  string.write(
    "hand tracking v2",
    0,
    height * 6 / 10,
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
      blendMode: EXCLUSION
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
    radius,
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

function applyRepulsionFromHands(
  strength = 0.5,
  maxForce = 0.02,
  repulseDistance = 600
) {
  const hands = mediapipe.workerResult?.hands?.landmarks ?? [
  ];

  if ( hands.length === 0 || matter.balls.length === 0 ) {
    return;
  }

  for ( const hand of hands ) {
    const repulsePoints = interactionIndices.map( i => hand[ i ] ).filter( Boolean );

    for ( const point of repulsePoints ) {
      const target = {
        x: common.inverseX( point.x ) * width,
        y: point.y * height
      };

      for ( const ball of matter.balls ) {
        const dist = distance(
          target,
          ball.position
        );

        // Apply repulsive force if the ball is within the repulseDistance
        if ( dist < repulseDistance ) {
          repulseBallFromPoint(
            ball,
            target,
            strength,
            maxForce
          );
        }
      }
    }
  }
}

function repulseBallFromPoint(
  ballBody,
  target,
  strength = 0.0005,
  maxForce = 0.002
) {
  const pos = ballBody.position;
  // Calculate force in the opposite direction of the target
  let force = {
    x: ( pos.x - target.x ) * strength,
    y: ( pos.y - target.y ) * strength
  };

  // Clamp force magnitude
  const mag = Math.sqrt( force.x ** 2 + force.y ** 2 );

  if ( mag > maxForce ) {
    force.x = ( force.x / mag ) * maxForce;
    force.y = ( force.y / mag ) * maxForce;
  }

  Matter.Body.applyForce(
    ballBody,
    pos,
    force
  );
}

function distance(
  p1, p2
) {
  return Math.sqrt( Math.pow(
    p2.x - p1.x,
    2
  ) + Math.pow(
    p2.y - p1.y,
    2
  ) );
}