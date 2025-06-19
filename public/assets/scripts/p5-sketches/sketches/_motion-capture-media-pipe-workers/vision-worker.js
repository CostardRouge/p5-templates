const workerState = {
  segmenter: {
    task: null,
    enabled: false
  },
  poses: {
    task: null,
    enabled: false
  },
  hands: {
    task: null,
    enabled: false
  },
  faces: {
    task: null,
    enabled: false
  },
  ready: false
};

self.onmessage = async( event ) => {
  const message = event.data;

  if ( message.type === "TOGGLE" ) {
    return;
  }

  if ( message.type === "INIT" ) {
    const {
      FilesetResolver,
      PoseLandmarker,
      ImageSegmenter,
      HandLandmarker,
      FaceDetector
    } = await import( "/assets/scripts/mediapipe/vision_bundle.js" );

    const resolver = await FilesetResolver.forVisionTasks( message.wasmPath );

    // workerState.segmenter.task = await ImageSegmenter.createFromOptions(
    //   resolver,
    //   {
    //     baseOptions: {
    //       delegate: "GPU",
    //       modelAssetPath: "/assets/scripts/mediapipe/deeplabv3.tflite"
    //     },
    //     outputCategoryMask: true,
    //     outputConfidenceMasks: false,
    //     runningMode: "VIDEO"
    //   }
    // );

    workerState.hands.task = await HandLandmarker.createFromOptions(
      resolver,
      {
        numHands: 2,
        runningMode: "VIDEO",
        baseOptions: {
          delegate: "GPU",
          modelAssetPath: "/assets/scripts/mediapipe/hand_landmarker.task"
        }
      }
    );

    // workerState.poses.task = await PoseLandmarker.createFromOptions(
    //   resolver,
    //   {
    //     numPoses: 2,
    //     runningMode: "VIDEO",
    //     baseOptions: {
    //       delegate: "GPU",
    //       modelAssetPath: "/assets/scripts/mediapipe/pose_landmarker_heavy.task"
    //     }
    //   }
    // );

    // workerState.faces.task = await FaceDetector.createFromOptions(
    //   resolver,
    //   {
    //     runningMode: "VIDEO",
    //     baseOptions: {
    //       delegate: "GPU",
    //       modelAssetPath: "/assets/scripts/mediapipe/blaze_face_short_range.tflite"
    //     }
    //   }
    // );

    workerState.ready = true;

    postMessage( {
      type: "READY"
    } );
    return;
  }

  if ( message.type === "FRAME" && workerState.ready ) {
    const inputBitmap = message.bitmap;
    const timestamp = message.timestamp;

    // workerState.segmenter.task.segmentForVideo(
    //   inputBitmap,
    //   timestamp,
    //   result => {
    //     postLibResult(
    //       "segmenter",
    //       result
    //     );
    //   }
    // );

    // postLibResult(
    //   "hands",
    //   result
    // );

    // workerState.poses.task.detectForVideo(
    //   inputBitmap,
    //   timestamp,
    //   result => {
    //     postLibResult(
    //       "poses",
    //       result
    //     );
    //   }
    // );

    postLibResult(
      "hands",
      workerState.hands.task.detectForVideo(
        inputBitmap,
        timestamp,
      )
    );

    // workerState.faces.task.detectForVideo(
    //   inputBitmap,
    //   timestamp,
    //   result => {
    //     postLibResult(
    //       "faces",
    //       result
    //     );
    //   }
    // );

    inputBitmap.close(); // free bitmap memory

    // postMessage(
    //   {
    //     type: "RESULT",
    //     payload: {
    //       handLandmarksArray: handResult?.landmarks ?? null,
    //       // poseLandmarksArray: poseResult?.landmarks ?? null,
    //       // faceDetectionsArray: faceResult?.detections ?? null,
    //       // segmentationMaskBitmap
    //     }
    //   },
    //   segmentationMaskBitmap ? [
    //     segmentationMaskBitmap
    //   ] : [
    //   ]
    // );
  }
};

function postLibResult(
  lib, result
) {
  // console.log( lib );
  postMessage(
    {
      type: "LIB_RESULT",
      payload: {
        lib,
        result
      }
    },
    [
    ]
  );
}