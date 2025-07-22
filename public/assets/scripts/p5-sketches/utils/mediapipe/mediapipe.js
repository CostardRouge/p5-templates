import {
  events,
  captureOptions as options,
} from "/assets/scripts/p5-sketches/utils/index.js";

const RUNNING_INFERENCE = 30;
const IDLE_INFERENCE = 500;
const IDLE_FRAMERATE = 20;
const IDLE_DELAY = 10_000;

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

  handDetectionState: {
    handsAreVisible: 0,
    lastDetectedHandTime: 0
  }
};

events.register(
  "pre-setup",
  () => {
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

events.register(
  "post-draw",
  () => {
    sendFrameToWorkerIfDue();
  }
);

function sendFrameToWorkerIfDue( ) {
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
}

events.register(
  "pre-draw",
  () => {
    if ( !mediapipe.videoReady || !mediapipe.workerReady ) {
      return;
    }

    const now = performance.now();

    // mediapipe.handDetectionState.handsAreCurrentlyVisible = Object.values( mediapipe.workerResult ).some( libResult => libResult?.length > 0 ?? false );
    mediapipe.handDetectionState.handsAreCurrentlyVisible = (
      ( mediapipe.workerResult?.hands?.landmarks?.length > 0 ?? false ) ||
      ( mediapipe.workerResult?.poses?.landmarks?.length > 0 ?? false )
    );

    if ( mediapipe.handDetectionState.handsAreCurrentlyVisible ) {
      mediapipe.handDetectionState.lastDetectedHandTime = now;
    }

    if ( !mediapipe.handDetectionState.handsAreCurrentlyVisible && mediapipe.handDetectionState.lastDetectedHandTime !== -1 ) {
      const timeSinceLastHand = now - mediapipe.handDetectionState.lastDetectedHandTime;

      if ( timeSinceLastHand > IDLE_DELAY ) {
        frameRate( IDLE_FRAMERATE );
        mediapipe.inferenceIntervalMilliseconds = IDLE_INFERENCE;
        mediapipe.idle = true;
      }
    }
    else {
      frameRate( options.animation.framerate );
      mediapipe.inferenceIntervalMilliseconds = RUNNING_INFERENCE;
      mediapipe.idle = false;
    }

    mediapipe.running = ( now - mediapipe.handDetectionState.lastDetectedHandTime ) < IDLE_DELAY;
  }
);

export default mediapipe;