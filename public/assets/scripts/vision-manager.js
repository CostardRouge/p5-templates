export class VisionManager {
  constructor() {
    this.state = {
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
      ready: false,
      runningMode: "VIDEO" // Default
    };
    this.onResultCallback = null;
  }

  setResultCallback( fn ) {
    this.onResultCallback = fn;
  }

  async initialize( config ) {
    const {
      tasks, mediapipeLibraryPath
    } = config;

    tasks.forEach( task => { if( this.state[ task ] ) this.state[ task ].enabled = true; } );

    const {
      FilesetResolver, PoseLandmarker, ImageSegmenter, HandLandmarker, FaceDetector
    } =
      await import( "../../assets/libraries/mediapipe/vision_bundle.js" );

    const resolver = await FilesetResolver.forVisionTasks( `${ mediapipeLibraryPath }/wasm` );

    if ( this.state.segmenter.enabled ) {
      this.state.segmenter.task = await ImageSegmenter.createFromOptions(
        resolver,
        {
          baseOptions: {
            delegate: "GPU",
            modelAssetPath: `${ mediapipeLibraryPath }/deeplabv3.tflite`
          },
          outputCategoryMask: true,
          outputConfidenceMasks: false,
          runningMode: this.state.runningMode
        }
      );
    }

    // ... (Initialize other tasks similarly) ...

    this.state.ready = true;
    return true;
  }

  async setMode( mode ) {
    if ( mode === this.state.runningMode ) return;
    this.state.runningMode = mode;

    if ( this.state.segmenter.task ) {
      await this.state.segmenter.task.setOptions( {
        runningMode: mode
      } );
    }
    // Note: Other tasks might need re-initialization if they don't support setOptions
  }

  detect(
    input, timestamp
  ) {
    if ( !this.state.ready ) return;

    if ( this.state.segmenter.enabled ) {
      // Handle different modes
      if ( this.state.runningMode === "IMAGE" ) {
        this.state.segmenter.task.segment(
          input,
          ( result ) => this.processSegmenterResult( result )
        );
      } else {
        this.state.segmenter.task.segmentForVideo(
          input,
          timestamp,
          ( result ) => this.processSegmenterResult( result )
        );
      }
    }

    // ... (Other detectors) ...
  }

  processSegmenterResult( result ) {
    const {
      categoryMask
    } = result;

    if ( !categoryMask ) return;

    const width = categoryMask.width;
    const height = categoryMask.height;

    // WORKER FIX: We MUST create a copy (new Uint8Array) to guarantee
    // the buffer is detachable and transferable.
    const data = new Uint8Array( categoryMask.getAsUint8Array() );

    categoryMask.close(); // Clean up WASM memory

    this.emitResult(
      "segmenter",
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
    if ( this.onResultCallback ) this.onResultCallback( {
      lib,
      result
    } );
  }
}