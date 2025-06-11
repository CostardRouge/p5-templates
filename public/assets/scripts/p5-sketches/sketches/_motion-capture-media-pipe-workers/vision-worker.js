// =====================  vision-worker.js  =====================
// (Save this as a sibling file next to the main sketch)
// ==============================================================

/*
  Heavy lifting lives here. We keep mutable state inside a single
  top‑level const `workerState` object.
*/

const workerState = {
  segmenter: null,
  handLandmarker: null,
  faceDetector: null,
  ready: false
};

self.onmessage = async( event ) => {
  const message = event.data;

  if ( message.type === "INIT" ) {
    const {
      FilesetResolver,
      ImageSegmenter,
      HandLandmarker,
      FaceDetector
    } = await import( "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0" );

    const resolver = await FilesetResolver.forVisionTasks( message.wasmPath );

    workerState.segmenter = await ImageSegmenter.createFromOptions(
      resolver,
      {
        baseOptions: {
          delegate: "GPU",
          modelAssetPath: "https://storage.googleapis.com/mediapipe-assets/deeplabv3.tflite?generation=1661875711618421"
        },
        outputCategoryMask: true,
        outputConfidenceMasks: false,
        runningMode: "VIDEO"
      }
    );

    workerState.handLandmarker = await HandLandmarker.createFromOptions(
      resolver,
      {
        numHands: 2,
        runningMode: "VIDEO",
        baseOptions: {
          delegate: "GPU",
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        }
      }
    );

    workerState.faceDetector = await FaceDetector.createFromOptions(
      resolver,
      {
        runningMode: "VIDEO",
        baseOptions: {
          delegate: "GPU",
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
        }
      }
    );

    workerState.ready = true;

    postMessage( {
      type: "READY"
    } );
    return;
  }

  if ( message.type === "FRAME" && workerState.ready ) {
    const inputBitmap = message.bitmap;
    const timestamp = message.timestamp;

    const segmentationResult = workerState.segmenter.segmentForVideo(
      inputBitmap,
      timestamp
    );
    const handResult = workerState.handLandmarker.detectForVideo(
      inputBitmap,
      timestamp
    );
    const faceResult = workerState.faceDetector.detectForVideo(
      inputBitmap,
      timestamp
    );

    inputBitmap.close(); // free bitmap memory

    const segmentationMaskBitmap = segmentationResult?.categoryMask?.getAsImageBitmap?.() ?? null;

    postMessage(
      {
        type: "RESULT",
        payload: {
          handLandmarksArray: handResult?.landmarks ?? null,
          faceDetectionsArray: faceResult?.detections ?? null,
          segmentationMaskBitmap
        }
      },
      segmentationMaskBitmap ? [
        segmentationMaskBitmap
      ] : [
      ]
    );
  }
};
