import {
  sketch,
  string,
  scripts,
  mappers,
  animation,
  captureOptions as options,
} from "/assets/scripts/p5-sketches/utils/index.js";

import drawHands from "./drawHands.js";
import drawNeonDot from "./drawNeonDot.js";

await scripts.load( "/assets/libraries/decomp.min.js" );
await scripts.load( "/assets/libraries/matter.min.js" );

const {
  Engine, Bodies, Composite, Vector
} = Matter;

const RUNNING_INFERENCE = 30;
const IDLE_INFERENCE = 500;
const IDLE_FRAMERATE = 20;
const GUIDELINE_DELAY = 2_500;

const mediapipe = {
  capture: {
    element: null,
    size: {
      width: 640,
      height: 480,
    }
  },
  feedback: {
    element: null,
    size: {
      width: options.size.width,
      height: options.size.height
    }
  },
  worker: null,
  workerReady: false,
  workerResult: {
  },
  previousFrameSentTime: 0,
  inferenceIntervalMilliseconds: IDLE_INFERENCE,
};

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

const handDetectionState = {
  handsAreVisible: 0,
  lastDetectedHandTime: 0
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

    // --- capture feed (used for inference only) ---
    mediapipe.capture.element = createCapture(
      VIDEO,
      {
        flipped: true
      }
    );
    mediapipe.capture.element.size(
      mediapipe.capture.size.width,
      mediapipe.capture.size.height
    );
    mediapipe.capture.element.hide();

    mediapipe.capture.element.elt.addEventListener(
      "loadeddata",
      () => {
        mediapipe.videoReady = true;
      }
    );

    // --- feedback feed (drawn to canvas) ---
    mediapipe.feedback.element = createCapture(
      VIDEO,
      {
        flipped: true
      }
    );
    mediapipe.feedback.element.size(
      mediapipe.feedback.size.width,
      mediapipe.feedback.size.height
    );
    mediapipe.feedback.element.hide();

    // --- spin up the vision worker ---

    mediapipe.worker = new Worker( new URL(
      "./vision-worker.js",
      import.meta.url
    ) );

    mediapipe.worker.postMessage( {
      type: "INIT",
      wasmPath: "/assets/scripts/mediapipe/wasm"
    } );

    mediapipe.worker.onmessage = ( event ) => {
      const message = event.data;

      if ( message.type === "READY" ) {
        mediapipe.workerReady = true;
      }

      if ( message.type === "LIB_RESULT" ) {
        mediapipe.workerResult[ message.payload.lib ] = message.payload.result;
      }
    };

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
      addImageBall(
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

const sendFrameToWorkerIfDue = ( ) => {
  const now = performance.now();

  if ( now - mediapipe.previousFrameSentTime < mediapipe.inferenceIntervalMilliseconds ) {
    return;
  }

  const videoElement = mediapipe.capture.element.elt;

  if ( !videoElement || videoElement.readyState < 2 || videoElement.videoWidth === 0 ) {
    return; // video not yet delivering frames
  }

  createImageBitmap( videoElement )
    .then( ( bitmap ) => {
      mediapipe.worker.postMessage(
        {
          type: "FRAME",
          bitmap,
          timestamp: now
        },
        [
          bitmap
        ]
      );

      mediapipe.previousFrameSentTime = now;
    } )
    .catch( console.error );
};

sketch.draw( (
  time, center, favouriteColour
) => {
  background( ...options.colors.background );

  if ( !mediapipe.videoReady || !mediapipe.workerReady ) {
    return;
  }

  const now = performance.now();

  // handDetectionState.handsAreCurrentlyVisible = Object.values( mediapipe.workerResult ).some( libResult => libResult?.length > 0 ?? false );
  handDetectionState.handsAreCurrentlyVisible = (
    ( mediapipe.workerResult?.hands?.landmarks?.length > 0 ?? false ) ||
    ( mediapipe.workerResult?.poses?.landmarks?.length > 0 ?? false )
  );

  if ( handDetectionState.handsAreCurrentlyVisible ) {
    handDetectionState.lastDetectedHandTime = now;
  }

  if ( !handDetectionState.handsAreCurrentlyVisible && handDetectionState.lastDetectedHandTime !== -1 ) {
    const timeSinceLastHand = now - handDetectionState.lastDetectedHandTime;

    if ( timeSinceLastHand > GUIDELINE_DELAY ) {
      frameRate( IDLE_FRAMERATE );
      mediapipe.inferenceIntervalMilliseconds = IDLE_INFERENCE;

      clearGraphics(
        layers.hands,
        255
      );
    }
  }
  else {
    mediapipe.inferenceIntervalMilliseconds = RUNNING_INFERENCE;
    frameRate( options.animation.framerate );
  }

  const motionCaptureExperienceIsRunning = true;// ( now - handDetectionState.lastDetectedHandTime ) < GUIDELINE_DELAY;

  if ( motionCaptureExperienceIsRunning ) {
    // image(
    //   mediapipe.feedback.element,
    //   0,
    //   0,
    //   width,
    //   height
    // );

    drawHands(
      mediapipe.workerResult.hands,
      layers.hands.graphics
    );

    // Update hand physics bodies
    updateHandBodies();
    applyAttractionFromHands(
      0.5,
      0.01
    );

    Engine.update( matter.engine );

    matter.engine.gravity = {
      x: 0,
      y: 0,
    };

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

      drawNeonDot( {
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
      clearGraphics(
        layer,
        erase
      );
    }
  }

  string.write(
    "attract",
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
    "hand tracking v1",
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

  sendFrameToWorkerIfDue();
} );

function clearGraphics(
  {
    graphics, size
  }, eraseValue
) {
  graphics.erase();
  graphics.noStroke();
  graphics.fill(
    0,
    0,
    0,
    eraseValue
  );
  graphics.rect(
    0,
    0,
    size.width,
    size.height
  );
  graphics.noErase();
}

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
      const x = inverseX( point.x ) * width;
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

function addImageBall(
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

function inverseX(
  x, limit = 1
) {
  return map(
    x,
    0,
    limit,
    limit,
    0
  );
}

function applyAttractionFromHands(
  strength = 0.0005, maxForce = 0.002
) {
  const hands = mediapipe.workerResult?.hands?.landmarks ?? [
  ];

  if ( hands.length === 0 || matter.balls.length === 0 ) {
    return;
  }

  for ( const hand of hands ) {
    const attractPoints = interactionIndices.map( i => hand[ i ] ).filter( Boolean );

    for ( const point of attractPoints ) {
      const target = {
        x: inverseX( point.x ) * width,
        y: point.y * height
      };

      for ( const ball of matter.balls ) {
        attractBallToPoint(
          ball,
          target,
          strength,
          maxForce
        );
      }
    }
  }
}

function attractBallToPoint(
  ballBody, target, strength = 0.0005, maxForce = 0.002
) {
  const pos = ballBody.position;
  let force = {
    x: ( target.x - pos.x ) * strength,
    y: ( target.y - pos.y ) * strength
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
