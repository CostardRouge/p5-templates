"use client";
import events from "../../utils/events.js";

// We dynamically import the manager if not using worker
let VisionManagerClass = null;

const mediapipe = {
  config: {
    useWorker: false,
    tasks: [
    ]
  },
  tasks: {
  },
  capture: {
    element: null,
    size: {
      width: 320,
      height: 240
    }
  },
  processor: {
    instance: null,
    busy: false,
    ready: false
  },
  mode: "VIDEO", // VIDEO or IMAGE
  previousFrameSentTime: 0,
  inferenceIntervalMilliseconds: 100, // Default speed
};

export async function init( config = {
} ) {
  mediapipe.config.useWorker = config.worker ?? false;
  mediapipe.config.tasks = config.tasks ?? [
  ];

  createVideoCaptureElements();

  if ( mediapipe.config.useWorker ) {
    setupWorker();
  } else {
    await setupMainThread();
  }
}

function setupWorker() {
  mediapipe.processor.instance = new Worker(
    "/assets/scripts/vision-worker.js",
    {
      type: "module"
    }
  );
  mediapipe.processor.instance.postMessage( {
    type: "INIT",
    tasks: mediapipe.config.tasks,
    mediapipeLibraryPath: "/assets/libraries/mediapipe"
  } );

  mediapipe.processor.instance.onmessage = ( e ) => {
    if ( e.data.type === "READY" ) mediapipe.processor.ready = true;
    if ( e.data.type === "LIB_RESULT" ) handleResult( e.data.payload );
  };
}

async function setupMainThread() {
  const mod = await import( "@/public/assets/scripts/vision-manager.js" );

  VisionManagerClass = mod.VisionManager;
  mediapipe.processor.instance = new VisionManagerClass();
  mediapipe.processor.instance.setResultCallback( handleResult );
  await mediapipe.processor.instance.initialize( {
    tasks: mediapipe.config.tasks,
    mediapipeLibraryPath: "/assets/libraries/mediapipe"
  } );
  mediapipe.processor.ready = true;
}

function handleResult( {
  lib, result
} ) {
  mediapipe.tasks[ lib ] = mediapipe.tasks[ lib ] || {
  };
  mediapipe.tasks[ lib ].result = result;
  mediapipe.processor.busy = false;
}

// --- NEW: Manual Image Prediction ---
export async function predictImage( imageSource ) {
  if ( !mediapipe.processor.ready || mediapipe.processor.busy ) return;

  // 1. Ensure Mode is IMAGE
  if ( mediapipe.mode !== "IMAGE" ) {
    mediapipe.mode = "IMAGE";
    if ( mediapipe.config.useWorker ) {
      mediapipe.processor.instance.postMessage( {
        type: "SET_MODE",
        mode: "IMAGE"
      } );
    } else {
      await mediapipe.processor.instance.setMode( "IMAGE" );
    }
  }

  mediapipe.processor.busy = true;

  // 2. Send Data
  if ( mediapipe.config.useWorker ) {
    // Create bitmap for efficient transfer
    const bitmap = await createImageBitmap( imageSource );

    mediapipe.processor.instance.postMessage(
      {
        type: "FRAME",
        bitmap,
        timestamp: performance.now()
      },
      [
        bitmap
      ]
    );
  } else {
    mediapipe.processor.instance.detect(
      imageSource,
      performance.now()
    );
  }
}

function createVideoCaptureElements() {
  mediapipe.capture.element = createCapture(
    VIDEO,
    {
      flipped: true
    }
  );
  mediapipe.capture.element.size(
    320,
    240
  );
  mediapipe.capture.element.hide();
  mediapipe.capture.element.elt.addEventListener(
    "loadeddata",
    () => { mediapipe.videoReady = true; }
  );
}

events.register(
  "post-draw",
  () => {
  // Only run automatic video loop if we are in VIDEO mode
    if( mediapipe.mode === "VIDEO" ) sendFrameIfDue();
  }
);

function sendFrameIfDue() {
  if ( !mediapipe.processor.ready || mediapipe.processor.busy ) return;

  const now = performance.now();

  if ( now - mediapipe.previousFrameSentTime < mediapipe.inferenceIntervalMilliseconds ) return;

  const videoEl = mediapipe.capture.element.elt;

  if ( !videoEl || videoEl.readyState < 2 ) return;

  mediapipe.processor.busy = true;
  mediapipe.previousFrameSentTime = now;

  if ( mediapipe.config.useWorker ) {
    createImageBitmap( videoEl ).then( bmp => {
      mediapipe.processor.instance.postMessage(
        {
          type: "FRAME",
          bitmap: bmp,
          timestamp: now
        },
        [
          bmp
        ]
      );
    } )
      .catch( e => mediapipe.processor.busy = false );
  } else {
    mediapipe.processor.instance.detect(
      videoEl,
      now
    );
  }
}

export default mediapipe;