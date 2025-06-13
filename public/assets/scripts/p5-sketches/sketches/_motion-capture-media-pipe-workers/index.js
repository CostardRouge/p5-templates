import {
  sketch,
  events,
  easing,
  colors,
  mappers,
  animation,
  imageUtils,
  string,
  iterators,
  captureOptions as options,
  shapes
} from "/assets/scripts/p5-sketches/utils/index.js";

import drawGuidelines from "./guidelines.js";

const mediapipe = {
  capture: {
    element: null,
    size: {
      // width: 640 / 4,
      // height: 480 / 4,
      width: 256,
      height: 256,
      // width: options.size.width,
      // height: options.size.height
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
  latestResult: null,
  previousFrameSentTime: 0,
  inferenceIntervalMilliseconds: 20
};

const layers = {
  dots: {
    graphics: undefined,
    size: options.size,
    background: [
      16
    ],
    erase: 30
  },
  hands: {
    graphics: undefined,
    size: options.size,
    background: undefined,
    erase: 25
  },
  guidelines: {
    graphics: undefined,
    size: options.size,
    background: undefined,
    erase: 255,
  },
};

const GUIDELINE_DELAY = 2500;

const handDetectionState = {
  handsAreVisible: 0,
  lastDetectedHandTime: -GUIDELINE_DELAY
};

const indexFingerJointIndices = [
  5,
  6,
  7,
  8
];

const extendedThumbJointIndices = [
  0,
  1,
  2,
  3,
  4
];

const middleFingerJointIndices = [
  9,
  10,
  11,
  12
];

const ringFingerJointIndices = [
  13,
  14,
  15,
  16
];

const pinkyFingerJointIndices = [
  17,
  18,
  19,
  20
];

sketch.setup(
  () => {
    background( 0 );

    for ( const layerName in layers ) {
      const {
        background, size
      } = layers[ layerName ];

      layers[ layerName ].graphics = createGraphics(
        size.width,
        size.height
      );

      // if ( background ) {
      //   layers[ layerName ].graphics.background( ...background );
      // }
    }

    createNeonDots( 10 );

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
      // wasmPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    } );

    mediapipe.worker.onmessage = ( event ) => {
      const message = event.data;

      if ( message.type === "READY" ) {
        mediapipe.workerReady = true;
      }

      if ( message.type === "RESULT" ) {
        mediapipe.latestResult = message.payload;
      }
    };
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

const neonDots = [
];

function createNeonDots( count ) {
  for ( let i = 0; i < count; i++ ) {
    const [
      minSize,
      maxSize
    ] = [
      random(
        70,
        100
      ),
      random(
        10,
        20
      )
    ];

    neonDots.push( {
      sizeRange: [
        minSize,
        maxSize
      ],
      position: createVector(
        random(
          maxSize * 2,
          width - maxSize * 2
        ),
        random(
          maxSize * 2,
          height - maxSize * 2
        )
      ),
      index: i / count
    } );
  }
}

function drawNeonDots( count ) {
  neonDots.forEach( (
    neonDotData, index
  ) => {
    neonDot( {
      ...neonDotData,
      graphics: layers.dots.graphics,
      index: index / neonDots.length,
    } );
  } );
}

function neonDot( {
  sizeRange = [
    300,
    75
  ],
  shadowsCount = 3,
  graphics = window,
  position,
  index
} = {
} ) {
  for ( let shadowIndex = 0; shadowIndex < shadowsCount; shadowIndex++ ) {
    const shadowProgression = shadowsCount / shadowsCount;

    const circleSize = mappers.fn(
      shadowIndex,
      0,
      shadowsCount,
      sizeRange[ 0 ],
      sizeRange[ 1 ],
      // easing.easeInExpo
    );

    graphics.stroke( colors.rainbow( {
      opacityFactor: map(
        shadowIndex,
        0,
        shadowsCount,
        2,
        0.75
      ),
      hueOffset: ( animation.circularProgression + shadowProgression ),
      hueIndex: map(
        index,
        0,
        1,
        -PI,
        PI
      ),
    } ) );

    graphics.strokeWeight( circleSize );

    graphics.point(
      position.x,
      position.y
    );
  }
}

function neonLine( {
  innerCircleSize = 10,
  shadowsCount = 3,
  graphics = window,
  vectors,
  index
} = {
} ) {
  graphics.noStroke();

  for ( let shadowIndex = 0; shadowIndex < shadowsCount; shadowIndex++ ) {
    const shadowProgression = shadowsCount / shadowsCount;

    iterators.vectors(
      vectors,
      (
        position, _to, innerProgression, totalStep
      ) => {
        const totalProgression = totalStep / vectors.length;

        const circleSize = mappers.fn(
          shadowIndex,
          0,
          shadowsCount,
          innerCircleSize * shadowsCount,
          innerCircleSize,
          easing.easeOutSine
        );

        graphics.fill( colors.rainbow( {
          opacityFactor: map(
            shadowIndex,
            0,
            shadowsCount,
            1,
            3
          ),
          hueOffset: easing.easeOutSine( shadowProgression * shadowIndex ),
          hueIndex: map(
            Math.sin( animation.angle
              // + easing.easeInOutBack( totalProgression ) * 2
              + shadowProgression
              + totalProgression ),
            -1,
            1,
            -PI,
            PI
          ) * 4,
        } ) );

        graphics.circle(
          position.x,
          position.y,
          circleSize
        );
      },
      0.05
    );
  }
}

const drawSegmentationMask = () => {
  const startTimeMs = performance.now();

  if ( mediapipe.lastPredictTime === startTimeMs ) {
    return;
  }

  const segmentationResult = mediapipe.tasks.segmenter.segmentForVideo(
    mediapipe.capture.element.elt,
    startTimeMs
  );

  if ( segmentationResult === null ) {
    return;
  }
};

const drawHandLandmarks = () => {
  const handLandmarksArray = mediapipe.latestResult?.handLandmarksArray;

  if ( !handLandmarksArray ) {
    return;
  }

  const fingersToTrace = [
    extendedThumbJointIndices,
    indexFingerJointIndices,
    middleFingerJointIndices,
    ringFingerJointIndices,
    pinkyFingerJointIndices
  ];

  handLandmarksArray.forEach( ( handLandmarkArray ) => {
    const fingers = [
    ];

    for ( let fingerToTraceIndex = 0; fingerToTraceIndex < fingersToTrace.length; fingerToTraceIndex++ ) {
      const jointIndices = fingersToTrace[ fingerToTraceIndex ];

      const fingerJointVectors = jointIndices.map( fingerJointIndex => {
        const joint = handLandmarkArray[ fingerJointIndex ];

        return createVector(
          inverseX( joint.x ) * width,
          joint.y * height,
          map(
            joint.z,
            0,
            -1,
            0,
            1
          )
        );
      } );

      const averageFingerZ = fingerJointVectors.reduce(
        (
          sum, {
            z
          }
        ) => (
          sum + z
        ),
        0
      ) / fingerJointVectors.length;

      fingers.push( [
        averageFingerZ,
        fingerJointVectors
      ] );
    }

    // fingers
    //   .sort( (
    //     b, a
    //   ) => a[ 0 ] - b[ 0 ] );

    for ( let fingerIndex = 0; fingerIndex < fingers.length; fingerIndex++ ) {
      const [
        z,
        vectors
      ] = fingers[ fingerIndex ];

      neonLine( {
        innerCircleSize: map(
          z,
          0,
          1,
          10,
          100
        ),
        vectors,
        index: fingerIndex / ( fingersToTrace.length - 1 ),
        graphics: layers.hands.graphics
      } );
    }
  } );
};

const rightEye = 0;
const leftEye = 1;
const nose = 2;
const mouth = 3;
const rightEar = 4;
const leftEar = 5;

const drawCircleEchoes = ( {
  position,
  echoColor = color(
    128,
    128,
    255
  ),
  count,
  size
} ) => {
  noFill();

  for ( let circleEchoIndex = 0; circleEchoIndex < count; circleEchoIndex++ ) {
    const circleEchoProgression = easing.easeInExpo( circleEchoIndex / count );

    strokeWeight( 1 );
    stroke( echoColor );

    circle(
      position.x,
      position.y,
      size * circleEchoProgression
    );
  }
};

const getZoomFromFace = ( face ) => {
  if ( !face || face.length < 6 ) return 0;

  const dEyes = p5.Vector.dist(
    face[ 0 ],
    face[ 1 ]
  ); // right eye to left eye
  const dEars = p5.Vector.dist(
    face[ 4 ],
    face[ 5 ]
  ); // right ear to left ear
  const dNoseMouth = p5.Vector.dist(
    face[ 2 ],
    face[ 3 ]
  ); // nose to mouth

  const avgDist = ( dEyes + dEars + dNoseMouth ) / 3;

  const minDist = 20;
  const maxDist = 120;

  return constrain(
    map(
      avgDist,
      minDist,
      maxDist,
      0,
      1
    ),
    0,
    1
  );
};

const drawFace = ( faceKeyPoints ) => {
  const keyPointVectors = faceKeyPoints.map( faceKeyPoint => {
    return createVector(
      inverseX( faceKeyPoint.x ) * width,
      faceKeyPoint.y * height,
      faceKeyPoint.z,
    );
  } );

  const faceZoom = getZoomFromFace( keyPointVectors );
  const size = mappers.fn(
    faceZoom,
    0,
    1,
    10,
    750,
    easing.easeInExpo
  );

  drawCircleEchoes( {
    size,
    count: 30,
    position: keyPointVectors[ nose ],
  } );
};

const drawFaceDetections = ( ) => {
  const faceDetectionsArray = mediapipe.latestResult?.faceDetectionsArray;

  if ( !faceDetectionsArray ) {
    return;
  }

  noFill();
  stroke(
    0,
    0,
    255
  );
  strokeWeight( 5 );

  faceDetectionsArray.forEach( ( detection ) => {
    // const boundingBox = detection.boundingBox;
    const keypoints = detection.keypoints;

    drawFace( keypoints );

    // beginShape( POINTS );
    // keypoints.forEach( ( keypoint ) => {
    //   vertex(
    //     inverseX( keypoint.x ) * width,
    //     keypoint.y * height
    //   );
    // } );
    // strokeWeight( 10 );
    // endShape();
  } );
};

sketch.draw( (
  time, center, favouriteColour
) => {
  background( ...options.colors.background );

  if ( !mediapipe.videoReady || !mediapipe.workerReady ) {
    return;
  }

  image(
    mediapipe.feedback.element,
    0,
    0,
    width,
    height
  );

  for ( const layerName in layers ) {
    const {
      graphics, background, erase, size
    } = layers[ layerName ];

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
      graphics.erase();
      graphics.noStroke();
      graphics.fill(
        0,
        0,
        0,
        erase
      );
      graphics.rect(
        0,
        0,
        size.width,
        size.height
      );
      graphics.noErase();
    }
  }

  // drawNeonDots();

  // draw overlays from latest worker result (mask, hands, faces)
  if ( mediapipe.latestResult !== null ) {
    drawHandLandmarks();
    // drawFaceDetections();

    // drawSegmentationOverlay();
  }

  const now = performance.now();

  handDetectionState.handsAreCurrentlyVisible = ( mediapipe.latestResult?.handLandmarksArray?.length ?? 0 ) > 0;

  if ( handDetectionState.handsAreCurrentlyVisible ) {
    handDetectionState.lastDetectedHandTime = now;
  }

  if ( !handDetectionState.handsAreCurrentlyVisible && handDetectionState.lastDetectedHandTime !== -1 ) {
    const timeSinceLastHand = now - handDetectionState.lastDetectedHandTime;

    if ( timeSinceLastHand > GUIDELINE_DELAY ) {
      drawGuidelines(
        "Show me\nyour hands!",
        layers.guidelines
      );
    }
  }

  sendFrameToWorkerIfDue();
} );

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

function scaleY( y ) {
  return map(
    y,
    0,
    mediapipe.capture.size.height,
    0,
    mediapipe.feedback.size.height
  );
}

function scaleX( x ) {
  return map(
    x,
    0,
    mediapipe.capture.size.width,
    0,
    mediapipe.feedback.size.width
  );
}