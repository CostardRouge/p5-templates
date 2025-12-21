export class VisionManager {
  constructor() {
    this.state = {
      segmenter: {
        task: null,
        enabled: false,
      },
      interactive: {
        task: null,
        enabled: false,
      },
      poses: {
        task: null,
        enabled: false,
      },
      hands: {
        task: null,
        enabled: false,
      },
      faces: {
        task: null,
        enabled: false,
      },
      ready: false,
      runningMode: "VIDEO", // Default
    };
    this.onResultCallback = null;
  }

  setResultCallback(fn) {
    this.onResultCallback = fn;
  }

  async initialize(config) {
    const { tasks, mediapipeLibraryPath } = config;

    tasks.forEach((task) => {
      if (this.state[task]) this.state[task].enabled = true;
    });

    const {
      FilesetResolver,
      InteractiveSegmenter,
      PoseLandmarker,
      ImageSegmenter,
      HandLandmarker,
      FaceDetector,
    } = await import("../../assets/libraries/mediapipe/vision_bundle.js");

    const resolver = await FilesetResolver.forVisionTasks(
      `${mediapipeLibraryPath}/wasm`
    );

    if (this.state.segmenter.enabled) {
      this.state.segmenter.task = await ImageSegmenter.createFromOptions(
        resolver,
        {
          baseOptions: {
            delegate: "GPU",
            modelAssetPath: `${mediapipeLibraryPath}/deeplabv3.tflite`,
          },
          outputCategoryMask: true,
          outputConfidenceMasks: false,
          runningMode: this.state.runningMode,
        }
      );
    }

    if (this.state.interactive.enabled) {
      this.state.interactive.task =
        await InteractiveSegmenter.createFromOptions(resolver, {
          baseOptions: {
            delegate: "GPU",
            modelAssetPath: `${mediapipeLibraryPath}/magic_touch.tflite`, // Needs specific model!
          },
          outputCategoryMask: true,
          outputConfidenceMasks: false,
        });
    }

    if (this.state.hands.enabled) {
      this.state.hands.task = await HandLandmarker.createFromOptions(resolver, {
        numHands: 2,
        runningMode: "VIDEO",
        baseOptions: {
          delegate: "GPU",
          modelAssetPath: `${mediapipeLibraryPath}/hand_landmarker.task`,
        },
      });
    }

    if (this.state.poses.enabled) {
      this.state.poses.task = await PoseLandmarker.createFromOptions(resolver, {
        numPoses: 2,
        runningMode: "VIDEO",
        baseOptions: {
          delegate: "GPU",
          modelAssetPath: `${mediapipeLibraryPath}/pose_landmarker_heavy.task`,
        },
      });
    }

    this.state.ready = true;
    return true;
  }

  async setMode(mode) {
    if (mode === this.state.runningMode) return;
    this.state.runningMode = mode;

    if (this.state.segmenter.task) {
      await this.state.segmenter.task.setOptions({
        runningMode: mode,
      });
    }
    // Note: Other tasks might need re-initialization if they don't support setOptions
  }

  detect(input, timestamp) {
    if (!this.state.ready) return;

    if (this.state.segmenter.enabled) {
      // Handle different modes
      if (this.state.runningMode === "IMAGE") {
        this.state.segmenter.task.segment(input, (result) =>
          this.processSegmenterResult(result)
        );
      } else {
        this.state.segmenter.task.segmentForVideo(input, timestamp, (result) =>
          this.processSegmenterResult(result)
        );
      }
    }

    if (this.state.hands.enabled) {
      const result = this.state.hands.task.detectForVideo(input, timestamp);

      this.emitResult("hands", result);
    }

    if (this.state.poses.enabled) {
      const result = this.state.poses.task.detectForVideo(input, timestamp);

      this.emitResult("poses", result);
    }
  }

  interact(input, roi) {
    if (!this.state.interactive.enabled || !this.state.interactive.task) return;

    // ROI = Region of Interest (The click coordinates)
    // { keypoint: { x: 0.5, y: 0.5 } }
    this.state.interactive.task.segment(input, roi, (result) => {
      console.log({ result });
      // We reuse the same processor because the result format is identical
      this.processSegmenterResult(result, "interactive");
    });
  }

  processSegmenterResult(result, lib = "segmenter") {
    const { categoryMask } = result;

    if (!categoryMask) return;

    const width = categoryMask.width;
    const height = categoryMask.height;

    // WORKER FIX: We MUST create a copy (new Uint8Array) to guarantee
    // the buffer is detachable and transferable.
    const data = new Uint8Array(categoryMask.getAsUint8Array());

    categoryMask.close(); // Clean up WASM memory

    this.emitResult(lib, {
      data,
      width,
      height,
    });
  }

  emitResult(lib, result) {
    if (this.onResultCallback)
      this.onResultCallback({
        lib,
        result,
      });
  }
}
