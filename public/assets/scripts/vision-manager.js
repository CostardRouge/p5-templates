const TASK_NAMES = [
  "segmenter",
  "interactive",
  "poses",
  "hands",
  "faces",
  "faceMesh"
];

export class VisionManager {
  constructor() {
    this.state = {
      segmenter: {
        task: null,
        enabled: false
      },
      interactive: {
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
      faceMesh: {
        task: null,
        enabled: false
      },
      ready: false,
      runningMode: "VIDEO" // Default
    };
    this.onResultCallback = null;
    this.lastDetectError = {};
  }

  setResultCallback( fn ) {
    this.onResultCallback = fn;
  }

  async initialize( config ) {
    const {
      tasks,
      mediapipeLibraryPath,
      taskOptions = {}
    } = config;

    tasks.forEach( ( task ) => {
      if ( this.state[ task ] ) {
        this.state[ task ].enabled = true;
      }
    } );

    const {
      FilesetResolver,
      InteractiveSegmenter,
      PoseLandmarker,
      ImageSegmenter,
      HandLandmarker,
      FaceDetector,
      FaceLandmarker
    } = await import( "../../assets/libraries/mediapipe/vision_bundle.js" );

    const resolver = await FilesetResolver.forVisionTasks( `${ mediapipeLibraryPath }/wasm` );
    const errors = [];

    // Try the GPU delegate first, then CPU, so one bad driver or a worker
    // without WebGL doesn't take the whole task down.
    const create = async(
      name, factory
    ) => {
      if ( !this.state[ name ].enabled ) {
        return;
      }

      try {
        this.state[ name ].task = await factory( "GPU" );
      } catch( gpuError ) {
        try {
          this.state[ name ].task = await factory( "CPU" );
        } catch( cpuError ) {
          this.state[ name ].enabled = false;
          errors.push( `${ name }: ${ cpuError?.message ?? cpuError }` );
        }
      }
    };

    await create(
      "segmenter",
      ( delegate ) =>
        ImageSegmenter.createFromOptions(
          resolver,
          {
            baseOptions: {
              delegate,
              modelAssetPath: `${ mediapipeLibraryPath }/deeplabv3.tflite`
            },
            outputCategoryMask: true,
            outputConfidenceMasks: false,
            runningMode: this.state.runningMode
          }
        )
    );

    await create(
      "interactive",
      ( delegate ) =>
        InteractiveSegmenter.createFromOptions(
          resolver,
          {
            baseOptions: {
              delegate,
              modelAssetPath: `${ mediapipeLibraryPath }/magic_touch.tflite` // Needs specific model!
            },
            outputCategoryMask: true,
            outputConfidenceMasks: false
          }
        )
    );

    await create(
      "hands",
      ( delegate ) =>
        HandLandmarker.createFromOptions(
          resolver,
          {
            numHands: taskOptions.hands?.numHands ?? 2,
            minHandDetectionConfidence: taskOptions.hands?.minConfidence ?? 0.5,
            runningMode: "VIDEO",
            baseOptions: {
              delegate,
              modelAssetPath: `${ mediapipeLibraryPath }/hand_landmarker.task`
            }
          }
        )
    );

    await create(
      "faces",
      ( delegate ) =>
        FaceDetector.createFromOptions(
          resolver,
          {
            minDetectionConfidence: taskOptions.faces?.minConfidence ?? 0.5,
            minSuppressionThreshold: 0.3,
            runningMode: "VIDEO",
            baseOptions: {
              delegate,
              modelAssetPath: `${ mediapipeLibraryPath }/blaze_face_short_range.tflite`
            }
          }
        )
    );

    await create(
      "faceMesh",
      ( delegate ) =>
        FaceLandmarker.createFromOptions(
          resolver,
          {
            numFaces: taskOptions.faceMesh?.numFaces ?? 1,
            minFaceDetectionConfidence: taskOptions.faceMesh?.minConfidence ?? 0.5,
            // The 52 expression scores (jawOpen, eyeBlink…, mouthSmile…) the
            // interaction layer surfaces as bindable `face.*` scalars.
            outputFaceBlendshapes: taskOptions.faceMesh?.blendshapes ?? true,
            runningMode: "VIDEO",
            baseOptions: {
              delegate,
              modelAssetPath: `${ mediapipeLibraryPath }/face_landmarker.task`
            }
          }
        )
    );

    await create(
      "poses",
      ( delegate ) =>
        PoseLandmarker.createFromOptions(
          resolver,
          {
            numPoses: taskOptions.poses?.numPoses ?? 2,
            runningMode: "VIDEO",
            baseOptions: {
              delegate,
              // "lite" is ~5× faster than "heavy" and plenty for interaction.
              modelAssetPath: `${ mediapipeLibraryPath }/pose_landmarker_${ taskOptions.poses?.model ?? "heavy" }.task`
            }
          }
        )
    );

    const anyTaskAlive = tasks.some( ( name ) => this.state[ name ]?.task );

    if ( tasks.length > 0 && !anyTaskAlive ) {
      throw new Error( `VisionManager: all tasks failed to initialize (${ errors.join( "; " ) })` );
    }

    if ( errors.length > 0 ) {
      console.warn(
        "VisionManager: some tasks failed to initialize:",
        errors
      );
    }

    this.state.ready = true;
    return true;
  }

  async setMode( mode ) {
    if ( mode === this.state.runningMode ) {
      return;
    }
    this.state.runningMode = mode;

    if ( this.state.segmenter.task ) {
      await this.state.segmenter.task.setOptions( {
        runningMode: mode
      } );
    }
    // Note: Other tasks might need re-initialization if they don't support setOptions
  }

  // Logs a detect error only when its message changes, so a recurring
  // per-frame failure doesn't flood the console.
  warnOnce(
    name, error
  ) {
    const message = error?.message ?? String( error );

    if ( this.lastDetectError[ name ] === message ) {
      return;
    }

    this.lastDetectError[ name ] = message;
    console.warn(
      `VisionManager: ${ name } detect failed:`,
      message
    );
  }

  detect(
    input, timestamp
  ) {
    if ( !this.state.ready ) {
      return;
    }

    if ( this.state.segmenter.enabled && this.state.segmenter.task ) {
      try {
        // Handle different modes
        if ( this.state.runningMode === "IMAGE" ) {
          this.state.segmenter.task.segment(
            input,
            ( result ) =>
              this.processSegmenterResult( result )
          );
        } else {
          this.state.segmenter.task.segmentForVideo(
            input,
            timestamp,
            ( result ) =>
              this.processSegmenterResult( result )
          );
        }
      } catch( error ) {
        this.warnOnce(
          "segmenter",
          error
        );
      }
    }

    if ( this.state.hands.enabled && this.state.hands.task ) {
      try {
        const result = this.state.hands.task.detectForVideo(
          input,
          timestamp
        );

        this.emitResult(
          "hands",
          result
        );
      } catch( error ) {
        this.warnOnce(
          "hands",
          error
        );
      }
    }

    if ( this.state.poses.enabled && this.state.poses.task ) {
      try {
        const result = this.state.poses.task.detectForVideo(
          input,
          timestamp
        );

        this.emitResult(
          "poses",
          result
        );
      } catch( error ) {
        this.warnOnce(
          "poses",
          error
        );
      }
    }

    if ( this.state.faces.enabled && this.state.faces.task ) {
      try {
        const result = this.state.faces.task.detectForVideo(
          input,
          timestamp
        );

        this.emitResult(
          "faces",
          result
        );
      } catch( error ) {
        this.warnOnce(
          "faces",
          error
        );
      }
    }

    if ( this.state.faceMesh.enabled && this.state.faceMesh.task ) {
      try {
        const result = this.state.faceMesh.task.detectForVideo(
          input,
          timestamp
        );

        this.emitResult(
          "faceMesh",
          result
        );
      } catch( error ) {
        this.warnOnce(
          "faceMesh",
          error
        );
      }
    }
  }

  interact(
    input, roi
  ) {
    if ( !this.state.interactive.enabled || !this.state.interactive.task ) {
      return;
    }

    // ROI = Region of Interest (The click coordinates)
    // { keypoint: { x: 0.5, y: 0.5 } }
    this.state.interactive.task.segment(
      input,
      roi,
      ( result ) => {
        // We reuse the same processor because the result format is identical
        this.processSegmenterResult(
          result,
          "interactive"
        );
      }
    );
  }

  processSegmenterResult(
    result, lib = "segmenter"
  ) {
    const {
      categoryMask
    } = result;

    if ( !categoryMask ) {
      return;
    }

    const width = categoryMask.width;
    const height = categoryMask.height;

    // WORKER FIX: We MUST create a copy (new Uint8Array) to guarantee
    // the buffer is detachable and transferable.
    const data = new Uint8Array( categoryMask.getAsUint8Array() );

    categoryMask.close(); // Clean up WASM memory

    this.emitResult(
      lib,
      {
        data,
        width,
        height
      }
    );
  }

  emitResult(
    lib, result
  ) {
    if ( this.onResultCallback ) {
      this.onResultCallback( {
        lib,
        result
      } );
    }
  }

  // Frees the WASM/GPU memory held by every task so the manager can be
  // discarded without leaking across sketch switches.
  close() {
    TASK_NAMES.forEach( ( name ) => {
      const entry = this.state[ name ];

      try {
        entry.task?.close?.();
      } catch {
        // Already closed or never fully initialized.
      }

      entry.task = null;
      entry.enabled = false;
    } );

    this.state.ready = false;
  }
}
