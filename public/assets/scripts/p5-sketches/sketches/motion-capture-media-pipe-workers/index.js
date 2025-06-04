import {
  sketch,
  events,
  mappers,
  animation,
  imageUtils,
  string,
  captureOptions as options,
  shapes
} from "/assets/scripts/p5-sketches/utils/index.js";

const mediapipe = {
  capture: {
    element: null,
    size: {
      width: 640,
      height: 480
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
  inferenceIntervalMilliseconds: 25
};

sketch.setup(
  () => {
    background( ...options.colors.background );

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
      wasmPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
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
      height: options.size.height
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

  stroke(
    0,
    255,
    0
  );
  noFill();
  strokeWeight( 5 );

  handLandmarksArray.forEach( ( hand ) => {
    hand.forEach( ( joint ) => {
      circle(
        map(
          joint.x,
          0,
          1,
          width,
          0
        ),
        joint.y * height,
        16
      );
    } );
  } );
};

const drawFaceDetections = () => {
  const faceDetectionsArray = mediapipe.latestResult?.faceDetectionsArray;

  if ( !faceDetectionsArray ) {
    return;
  }

  // console.log( {
  //   faceDetectionsArray
  // } );

  noFill();
  stroke(
    0,
    0,
    255
  );
  strokeWeight( 10 );

  faceDetectionsArray.forEach( ( face ) => {
    const boundingBox = face.boundingBox;
    const keypoints = face.keypoints;

    // VL AND HL
    shapes.vl( scaleX( boundingBox.originX ) );
    shapes.vl( scaleX( boundingBox.originX + boundingBox.width ) );
    shapes.hl( scaleY( boundingBox.originY ) );
    shapes.hl( scaleY( boundingBox.originY + boundingBox.height ) );

    // FACE RECT
    stroke( "green" );
    rect(
      scaleX( boundingBox.originX ),
      scaleY( boundingBox.originY ),
      -scaleX( boundingBox.width ),
      scaleY( boundingBox.height )
    );

    // FACE KEY POINTS
    beginShape( POINTS );
    keypoints.forEach( ( keypoint ) => {
      vertex(
        map(
          keypoint.x,
          0,
          1,
          width,
          0
        ),
        keypoint.y * height
      );
    } );
    endShape();
  } );
};

sketch.draw( (
  time, center, favouriteColour
) => {
  background( ...options.colors.background );

  if ( !mediapipe.videoReady || !mediapipe.workerReady ) {
    return; // wait for both video & worker
  }

  // draw live video
  image(
    mediapipe.feedback.element,
    0,
    0,
    width,
    height
  );

  // draw overlays from latest worker result (mask, hands, faces)
  if ( mediapipe.latestResult !== null ) {
    // drawHandLandmarks();
    drawFaceDetections();

    // drawSegmentationOverlay();
  }

  sendFrameToWorkerIfDue();
} );

function scaleY( y ) {
  return map(
    y,
    0,
    mediapipe.capture.size.height,
    0,
    height,
    true
  );
}

function scaleX( x ) {
  return map(
    x,
    0,
    mediapipe.capture.size.width,
    width,
    0,
    true
  );
}