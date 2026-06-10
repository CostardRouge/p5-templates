import events from "@/p5/utils/events.js";

import {
  getP5
} from "@/p5/utils/sketch.js";

// Inference processor living on the main thread. Lazily imported so sketches
// that never enable vision don't pay for the MediaPipe bundle.
let VisionManagerClass = null;

// Timestamp of the previous completed inference, used for the rate stat.
let lastFrameDoneTime = 0;

const mediapipe = {
  config: {
    useWorker: false,
    tasks: [],
    taskOptions: {},
    captureSize: {
      width: 320,
      height: 240
    },
    captureFlip: true
  },

  // Latest result per task: mediapipe.tasks[ lib ] = { result, updatedAt }.
  tasks: {},

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
    busySince: 0,
    ready: false
  },

  mode: "VIDEO", // VIDEO or IMAGE
  previousFrameSentTime: 0,

  // Minimum spacing between inferences while detections are active.
  inferenceIntervalMilliseconds: 20,

  enabled: true, // Dynamic enable/disable flag
  videoReady: false,

  // True once no task has produced a detection for idleAfterMilliseconds.
  // Sketches can read this to dim/skip work while nobody is interacting.
  idle: false,

  scheduler: {
    // Inference spacing used while idle (no detections for a while). The
    // first detection snaps the scheduler back to the active interval.
    idleIntervalMilliseconds: 280,
    idleAfterMilliseconds: 3000,

    // If the processor stays busy longer than this (crashed worker, dropped
    // message), the busy flag is reset so detection self-heals.
    busyTimeoutMilliseconds: 2000,

    // Main-thread inference shares the draw loop: keep at least
    // inferenceMs × headroom between runs to protect the frame budget.
    mainThreadHeadroom: 1.5,

    lastDetectionTime: 0,
    usingFrameCallback: false,
    freshFrame: true
  },

  stats: {
    inferenceMilliseconds: 0, // EMA of end-to-end inference duration
    inferencesPerSecond: 0, // EMA of completed inference rate
    droppedFrames: 0, // frames due but skipped because inference was busy
    watchdogRecoveries: 0,
    lastError: null
  }
};

export async function init( config = {} ) {
  // Release any previous processor first so re-initializing (different task
  // set, camera size…) never leaks a worker or WASM task memory.
  teardownProcessor();

  mediapipe.config.useWorker = config.worker ?? false;
  mediapipe.config.tasks = config.tasks ?? [];
  mediapipe.config.taskOptions = config.taskOptions ?? {};
  mediapipe.config.captureSize = config.captureSize ?? {
    width: 320,
    height: 240
  };
  mediapipe.config.captureFlip = config.captureFlip ?? true;

  mediapipe.inferenceIntervalMilliseconds =
    config.inferenceInterval ?? mediapipe.inferenceIntervalMilliseconds;
  mediapipe.scheduler.idleIntervalMilliseconds =
    config.idleInterval ?? mediapipe.scheduler.idleIntervalMilliseconds;
  mediapipe.scheduler.idleAfterMilliseconds =
    config.idleAfter ?? mediapipe.scheduler.idleAfterMilliseconds;

  mediapipe.tasks = {};
  mediapipe.mode = "VIDEO";
  mediapipe.enabled = true;
  mediapipe.idle = false;
  mediapipe.previousFrameSentTime = 0;
  mediapipe.scheduler.lastDetectionTime = performance.now();
  resetStats();

  // Only initialize camera if enableCapture is true (default: true for backward compatibility)
  const enableCapture = config.enableCapture ?? true;

  if ( enableCapture ) {
    createVideoCaptureElements();
  }

  if ( mediapipe.config.useWorker ) {
    try {
      await setupWorker();
    } catch( error ) {
      // GPU/OffscreenCanvas may be unavailable inside a worker on some
      // browsers — fall back to main-thread inference instead of failing.
      console.warn(
        "[mediapipe] worker init failed, falling back to main thread:",
        error
      );
      teardownProcessor();
      mediapipe.config.useWorker = false;
      await setupMainThread();
    }
  } else {
    await setupMainThread();
  }
}

function setupWorker() {
  return new Promise( (
    resolve, reject
  ) => {
    const worker = new Worker(
      "/assets/scripts/vision-worker.js",
      {
        type: "module"
      }
    );

    mediapipe.processor.instance = worker;

    worker.onerror = ( event ) => {
      mediapipe.stats.lastError = event.message ?? "vision worker error";
      // Recover the frame loop if the worker dies mid-inference.
      mediapipe.processor.busy = false;
      reject( new Error( mediapipe.stats.lastError ) );
    };

    worker.onmessage = ( e ) => {
      const {
        type
      } = e.data;

      if ( type === "READY" ) {
        mediapipe.processor.ready = true;
        resolve();
      } else if ( type === "INIT_ERROR" ) {
        reject( new Error( e.data.message ) );
      } else if ( type === "LIB_RESULT" ) {
        handleResult( e.data.payload );
      } else if ( type === "FRAME_DONE" ) {
        markFrameDone();
      } else if ( type === "FRAME_ERROR" ) {
        mediapipe.stats.lastError = e.data.message;
        markFrameDone();
      }
    };

    worker.postMessage( {
      type: "INIT",
      tasks: mediapipe.config.tasks,
      taskOptions: mediapipe.config.taskOptions,
      mediapipeLibraryPath: "/assets/libraries/mediapipe"
    } );
  } );
}

async function setupMainThread() {
  const mod = await import( "@/public/assets/scripts/vision-manager.js" );

  VisionManagerClass = mod.VisionManager;
  mediapipe.processor.instance = new VisionManagerClass();
  mediapipe.processor.instance.setResultCallback( handleResult );
  await mediapipe.processor.instance.initialize( {
    tasks: mediapipe.config.tasks,
    taskOptions: mediapipe.config.taskOptions,
    mediapipeLibraryPath: "/assets/libraries/mediapipe"
  } );
  mediapipe.processor.ready = true;
}

function resultHasDetections( result ) {
  if ( !result ) {
    return false;
  }

  if ( Array.isArray( result.landmarks ) ) {
    return result.landmarks.length > 0;
  }

  if ( Array.isArray( result.detections ) ) {
    return result.detections.length > 0;
  }

  // Segmentation masks and other payloads always count as activity.
  return true;
}

function handleResult( {
  lib, result
} ) {
  const entry = mediapipe.tasks[ lib ] = mediapipe.tasks[ lib ] || {};

  entry.result = result;
  entry.updatedAt = performance.now();

  if ( resultHasDetections( result ) ) {
    mediapipe.scheduler.lastDetectionTime = entry.updatedAt;
    mediapipe.idle = false;
  }
}

// Marks the in-flight inference as finished and folds its duration into the
// stats. Called from a try/finally on the main thread and on the worker's
// FRAME_DONE message, so the busy flag can never leak.
function markFrameDone() {
  if ( !mediapipe.processor.busy ) {
    return;
  }

  const now = performance.now();
  const duration = now - mediapipe.processor.busySince;
  const stats = mediapipe.stats;

  stats.inferenceMilliseconds = stats.inferenceMilliseconds === 0
    ? duration
    : stats.inferenceMilliseconds * 0.9 + duration * 0.1;

  if ( lastFrameDoneTime > 0 && now > lastFrameDoneTime ) {
    const rate = 1000 / ( now - lastFrameDoneTime );

    stats.inferencesPerSecond = stats.inferencesPerSecond === 0
      ? rate
      : stats.inferencesPerSecond * 0.9 + rate * 0.1;
  }

  lastFrameDoneTime = now;
  mediapipe.processor.busy = false;
}

function resetStats() {
  lastFrameDoneTime = 0;
  mediapipe.stats.inferenceMilliseconds = 0;
  mediapipe.stats.inferencesPerSecond = 0;
  mediapipe.stats.droppedFrames = 0;
  mediapipe.stats.watchdogRecoveries = 0;
  mediapipe.stats.lastError = null;
}

/**
 * Returns the latest result for a task, or null when there is none or it is
 * older than maxAgeMilliseconds — so a stalled pipeline reads as "nothing
 * detected" instead of replaying a frozen result forever.
 */
export function getTaskResult(
  lib, maxAgeMilliseconds = Infinity
) {
  const entry = mediapipe.tasks[ lib ];

  if ( !entry?.result ) {
    return null;
  }

  if ( performance.now() - entry.updatedAt > maxAgeMilliseconds ) {
    return null;
  }

  return entry.result;
}

// --- Manual Image Prediction ---
export async function predictImage( imageSource ) {
  if ( !mediapipe.processor.ready || mediapipe.processor.busy ) {
    return;
  }

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
  mediapipe.processor.busySince = performance.now();

  // 2. Send Data
  if ( mediapipe.config.useWorker ) {
    try {
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
    } catch( error ) {
      mediapipe.stats.lastError = error?.message ?? String( error );
      mediapipe.processor.busy = false;
    }
  } else {
    try {
      mediapipe.processor.instance.detect(
        imageSource,
        performance.now()
      );
    } catch( error ) {
      mediapipe.stats.lastError = error?.message ?? String( error );
    } finally {
      markFrameDone();
    }
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
  if ( !mediapipe.processor.ready ) {
    return;
  }

  const element = sourceElement || mediapipe.capture.element?.elt;

  if ( !element ) {
    return;
  }

  // 1. Normalize Coordinates (0.0 to 1.0)
  // If using p5 video capture, it might not be in the DOM, so we rely on internal size
  const elWidth = element.width || element.videoWidth;
  const elHeight = element.height || element.videoHeight;

  // Map to normalized coordinates (0.0 to 1.0)
  const normalizedX = x / elWidth;
  const normalizedY = y / elHeight;

  // Create ROI object with keypoint as required by InteractiveSegmenter
  const roi = {
    keypoint: {
      x: normalizedX,
      y: normalizedY
    }
  };

  // 2. Send to Processor
  if ( mediapipe.config.useWorker ) {
    createImageBitmap( element ).then( ( bmp ) => {
      mediapipe.processor.instance.postMessage(
        {
          type: "INTERACT",
          bitmap: bmp,
          roi: roi
        },
        [
          bmp
        ]
      );
    } );
  } else {
    mediapipe.processor.instance.interact(
      element,
      roi
    );
  }
}

function createVideoCaptureElements() {
  const p = getP5();
  const size = mediapipe.config.captureSize;
  const flip = mediapipe.config.captureFlip;

  mediapipe.videoReady = false;
  mediapipe.capture.element = p.createCapture(
    p.VIDEO,
    {
      flipped: flip
    }
  );
  mediapipe.capture.element.size(
    size.width,
    size.height
  );

  // Keep capture.size in sync so interaction utilities can read it
  mediapipe.capture.size = {
    width: size.width,
    height: size.height
  };

  mediapipe.capture.element.hide();
  mediapipe.capture.element.elt.addEventListener(
    "loadeddata",
    () => {
      mediapipe.videoReady = true;
    }
  );

  armFrameCallback( mediapipe.capture.element.elt );
}

// With requestVideoFrameCallback support we know exactly when the camera
// delivered a new frame, so inference never runs twice on the same image
// (cameras are typically ~30 fps while the draw loop is 60 fps).
function armFrameCallback( videoEl ) {
  if ( typeof videoEl.requestVideoFrameCallback !== "function" ) {
    mediapipe.scheduler.usingFrameCallback = false;
    mediapipe.scheduler.freshFrame = true;

    return;
  }

  mediapipe.scheduler.usingFrameCallback = true;
  mediapipe.scheduler.freshFrame = false;

  const onFrame = () => {
    // Stop re-arming once the capture element was replaced or removed.
    if ( mediapipe.capture.element?.elt !== videoEl ) {
      return;
    }

    mediapipe.scheduler.freshFrame = true;
    videoEl.requestVideoFrameCallback( onFrame );
  };

  videoEl.requestVideoFrameCallback( onFrame );
}

events.register(
  "post-draw",
  () => {
  // Only run automatic video loop if we are in VIDEO mode
    if ( mediapipe.mode === "VIDEO" ) {
      sendFrameIfDue();
    }
  }
);

function sendFrameIfDue() {
  if ( !mediapipe.enabled || !mediapipe.processor.ready ) {
    return;
  }

  // Skip if capture element was not initialized
  if ( !mediapipe.capture.element ) {
    return;
  }

  const now = performance.now();
  const scheduler = mediapipe.scheduler;

  // Idle backoff: when nothing has been detected for a while, lower the
  // inference rate. The first detection snaps it back to the active interval.
  mediapipe.idle =
    now - scheduler.lastDetectionTime > scheduler.idleAfterMilliseconds;

  let interval = mediapipe.inferenceIntervalMilliseconds;

  if ( mediapipe.idle ) {
    interval = Math.max(
      interval,
      scheduler.idleIntervalMilliseconds
    );
  }

  if ( !mediapipe.config.useWorker ) {
    interval = Math.max(
      interval,
      mediapipe.stats.inferenceMilliseconds * scheduler.mainThreadHeadroom
    );
  }

  if ( now - mediapipe.previousFrameSentTime < interval ) {
    return;
  }

  // Don't re-infer a frame the camera hasn't refreshed yet.
  if ( scheduler.usingFrameCallback && !scheduler.freshFrame ) {
    return;
  }

  if ( mediapipe.processor.busy ) {
    // Watchdog: a crashed worker or a dropped message would otherwise freeze
    // detection forever — recover after a generous timeout.
    if ( now - mediapipe.processor.busySince > scheduler.busyTimeoutMilliseconds ) {
      mediapipe.processor.busy = false;
      mediapipe.stats.watchdogRecoveries++;
    } else {
      mediapipe.stats.droppedFrames++;

      return;
    }
  }

  const videoEl = mediapipe.capture.element.elt;

  if ( !videoEl || videoEl.readyState < 2 ) {
    return;
  }

  mediapipe.processor.busy = true;
  mediapipe.processor.busySince = now;
  mediapipe.previousFrameSentTime = now;
  scheduler.freshFrame = false;

  if ( mediapipe.config.useWorker ) {
    createImageBitmap( videoEl )
      .then( ( bmp ) => {
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
      .catch( ( error ) => {
        mediapipe.stats.lastError = error?.message ?? String( error );
        mediapipe.processor.busy = false;
      } );
  } else {
    try {
      mediapipe.processor.instance.detect(
        videoEl,
        now
      );
    } catch( error ) {
      mediapipe.stats.lastError = error?.message ?? String( error );
    } finally {
      markFrameDone();
    }
  }
}

// Dynamic enable/disable functions
export function enable() {
  mediapipe.enabled = true;

  // If capture element doesn't exist, create it
  if ( !mediapipe.capture.element ) {
    createVideoCaptureElements();
  }
}

export function disable() {
  mediapipe.enabled = false;

  // Stop any ongoing processing
  mediapipe.processor.busy = false;

  // Clear results to prevent stale data
  Object.keys( mediapipe.tasks ).forEach( ( taskName ) => {
    if ( mediapipe.tasks[ taskName ] ) {
      mediapipe.tasks[ taskName ].result = null;
    }
  } );
}

export function deallocateWebcam() {
  disable();

  // Stop and remove webcam stream
  if ( mediapipe.capture.element?.elt?.srcObject ) {
    const stream = mediapipe.capture.element.elt.srcObject;
    const tracks = stream.getTracks();

    tracks.forEach( ( track ) => track.stop() );
    mediapipe.capture.element.elt.srcObject = null;
  }

  // Remove the video element
  if ( mediapipe.capture.element ) {
    mediapipe.capture.element.remove();
    mediapipe.capture.element = null;
  }

  mediapipe.videoReady = false;
}

function teardownProcessor() {
  const instance = mediapipe.processor.instance;

  if ( instance ) {
    if ( typeof instance.terminate === "function" ) {
      // Worker: terminating reclaims its WASM/GPU memory with it.
      instance.terminate();
    } else if ( typeof instance.close === "function" ) {
      // Main-thread manager: explicitly free the MediaPipe task memory.
      instance.close();
    }
  }

  mediapipe.processor.instance = null;
  mediapipe.processor.ready = false;
  mediapipe.processor.busy = false;
}

/**
 * Full teardown: webcam, processor (worker or main-thread tasks) and results.
 * Call when the sketch goes away; init() can always be called again later.
 */
export function dispose() {
  deallocateWebcam();
  teardownProcessor();
  mediapipe.tasks = {};
  resetStats();
}

export function setEnabled( enabled ) {
  if ( enabled ) {
    enable();
  } else {
    deallocateWebcam(); // This will properly stop the webcam stream
  }
}

export default mediapipe;
