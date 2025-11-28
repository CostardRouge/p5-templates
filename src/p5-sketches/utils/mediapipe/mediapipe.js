import events from "@/p5/utils/events.js";

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
  inferenceIntervalMilliseconds: 20, // Default speed
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

/**
 * Triggers segmentation at a specific point.
 * @param {number} x - Mouse X or Touch X
 * @param {number} y - Mouse Y or Touch Y
 * @param {HTMLElement} sourceElement - (Optional) The video/image to segment. Defaults to capture.
 */
export function interact(
  x, y, sourceElement
) {
  if ( !mediapipe.processor.ready ) return;

  const element = sourceElement || mediapipe.capture.element.elt;

  // 1. Normalize Coordinates (0.0 to 1.0)
  // We must use the actual element size, not the screen size
  const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : {
    width: element.width,
    height: element.height
  };

  // If using p5 video capture, it might not be in the DOM, so we rely on internal size
  const elWidth = element.width || element.videoWidth;
  const elHeight = element.height || element.videoHeight;

  // Map screen click to video coordinates
  // Note: This assumes the video is stretched to fill screen.
  // If you have black bars, you need more complex mapping.
  const normalizedPoint = {
    x: x / width, // p5 global width
    y: y / height // p5 global height
  };

  // 2. Send to Processor
  if ( mediapipe.config.useWorker ) {
    createImageBitmap( element ).then( bmp => {
      mediapipe.processor.instance.postMessage(
        {
          type: "INTERACT", // New Message Type
          bitmap: bmp,
          point: normalizedPoint
        },
        [
          bmp
        ]
      );
    } );
  } else {
    mediapipe.processor.instance.interact(
      element,
      normalizedPoint
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