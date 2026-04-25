import sketch from "@/p5/utils/sketch.js";
import options from "@/p5/utils/options.js";
import events from "@/p5/utils/events.js";

// import {
//   FaceDetector,
//   FilesetResolver,
//   HandLandmarker,
//   ImageSegmenter
// } from "@/public/assets/libraries/mediapipe/vision_bundle.js";
// } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// ---------------------------------------------------------------------------
// Global MediaPipe container (all mutable task‑related state lives here)
// ---------------------------------------------------------------------------

const mediapipe = {
  capture: {
    element: null,
    size: {
      width: 640,
      height: 480,
    },
  },
  feedback: {
    element: null,
    size: {
      width: options.size.width,
      height: options.size.height,
    },
  },
  tasks: {
    segmenter: null,
    handLandmarker: null,
    faceDetector: null,
  },
  lastPredictTime: 0,
  runningMode: "VIDEO",
  ready: false,
};

// ---------------------------------------------------------------------------
// Pre‑load: fetch WASM backend and initialise the three tasks
// ---------------------------------------------------------------------------

events.register(
  "engine-window-preload",

  async() => {
    // const filesetResolver = await FilesetResolver.forVisionTasks( "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm" );
    const filesetResolver = await FilesetResolver.forVisionTasks( "/assets/scripts/mediapipe/wasm" );

    mediapipe.tasks.segmenter = await ImageSegmenter.createFromOptions(
      filesetResolver,
      {
        baseOptions: {
          delegate: "GPU",
          // modelAssetPath: "https://storage.googleapis.com/mediapipe-assets/deeplabv3.tflite?generation=1661875711618421"
          modelAssetPath: "/assets/scripts/mediapipe/deeplabv3.tflite",
        },
        outputCategoryMask: true,
        outputConfidenceMasks: true,
        runningMode: mediapipe.runningMode,
      }
    );

    mediapipe.tasks.handLandmarker = await HandLandmarker.createFromOptions(
      filesetResolver,
      {
        numHands: 2,
        runningMode: mediapipe.runningMode,
        baseOptions: {
          delegate: "GPU",
          // modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
          modelAssetPath: "/assets/scripts/mediapipe/hand_landmarker.task",
        },
      }
    );

    mediapipe.tasks.faceDetector = await FaceDetector.createFromOptions(
      filesetResolver,
      {
        runningMode: mediapipe.runningMode,
        baseOptions: {
          delegate: "GPU",
          // modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
          modelAssetPath:
            "/assets/scripts/mediapipe/blaze_face_short_range.tflite",
        },
      }
    );

    mediapipe.ready = true;
  }
);

// ---------------------------------------------------------------------------
// p5.js setup – create both webcam feeds (capture + feedback)
// ---------------------------------------------------------------------------

sketch.setup( () => {
  background( ...options.colors.background );

  mediapipe.capture.element = createCapture(
    VIDEO,
    {
      flipped: true,
    }
  );
  mediapipe.capture.element.size(
    mediapipe.capture.size.width,
    mediapipe.capture.size.height
  );
  mediapipe.capture.element.hide();

  mediapipe.feedback.element = createCapture(
    VIDEO,
    {
      flipped: true,
    }
  );
  mediapipe.feedback.element.size(
    mediapipe.feedback.size.width,
    mediapipe.feedback.size.height
  );
  mediapipe.feedback.element.hide();
} );

// ---------------------------------------------------------------------------
// Self‑contained helper functions (each performs inference + drawing)
// ---------------------------------------------------------------------------

const updateTimestamp = () => {
  mediapipe.lastPredictTime = performance.now();
};

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
  const startTimeMs = performance.now();

  if ( mediapipe.lastPredictTime === startTimeMs ) {
    return;
  }

  const handResult = mediapipe.tasks.handLandmarker.detectForVideo(
    mediapipe.capture.element.elt,
    startTimeMs
  );

  if ( handResult === null ) {
    return;
  }
  stroke(
    0,
    255,
    0
  );
  strokeWeight( 5 );

  handResult.landmarks.forEach( ( handLandmarkArray ) => {
    handLandmarkArray.forEach( ( joint ) => {
      circle(
        inverseX( joint.x ) * width,
        joint.y * height,
        16
      );
    } );
  } );
};

const drawFaceDetections = () => {
  const startTimeMs = performance.now();

  if ( mediapipe.lastPredictTime === startTimeMs ) {
    return;
  }

  const faceResult = mediapipe.tasks.faceDetector.detectForVideo(
    mediapipe.capture.element.elt,
    startTimeMs
  );

  if ( faceResult === null ) {
    return;
  }

  noFill();
  stroke(
    0,
    0,
    255
  );
  strokeWeight( 5 );

  faceResult.detections.forEach( ( detection ) => {
    const boundingBox = detection.boundingBox;
    const keypoints = detection.keypoints;

    rect(
      scaleX( inverseX(
        boundingBox.originX,
        mediapipe.capture.size.width
      ) ),
      scaleY( boundingBox.originY ),
      -scaleX( boundingBox.width ),
      scaleY( boundingBox.height )
    );

    beginShape( POINTS );
    keypoints.forEach( ( keypoint ) => {
      vertex(
        inverseX( keypoint.x ) * width,
        keypoint.y * height
      );
    } );
    strokeWeight( 10 );
    endShape();
  } );
};

// ---------------------------------------------------------------------------
// p5.js draw loop – per‑frame processing
// ---------------------------------------------------------------------------

sketch.draw( (
  time, center, favoriteColor
) => {
  background( ...options.colors.background );

  if ( !mediapipe.ready ) {
    return; // Early exit until all models are loaded
  }

  image(
    mediapipe.feedback.element,
    0,
    0,
    width,
    height
  );

  // drawSegmentationMask();
  drawFaceDetections();
  drawHandLandmarks();

  updateTimestamp();
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
