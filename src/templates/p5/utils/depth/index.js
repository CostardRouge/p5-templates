// ── Lazy ARPortraitDepth (TensorFlow.js) monocular depth manager ────────────
//
// TensorFlow.js + the depth/segmentation models are heavy, so NOTHING here is
// imported until initDepth() is first called — i.e. only when the depth-map
// mode is actually selected. After that it behaves like the MediaPipe wrapper:
// an async producer that keeps the LATEST depth map, which a sketch samples
// synchronously every frame (the heavy inference runs on its own throttled
// cadence, never blocking the draw loop).
//
// ARPortraitDepth (Google's "Portrait Depth API") internally crops the person
// with a selfie-segmentation pass, so it is a natural fit for our already
// segmented silhouette. Model weights download from TF Hub by default; pass
// depthModelUrl / segmentationModelUrl to self-host them (e.g. under
// public/assets/libraries/) and stay offline-consistent with MediaPipe.

const depth = {
  estimator: null,
  loading: false,
  ready: false,
  failed: false,
  busy: false,
  lastRunAt: 0,
  signature: "",
  // Latest map: { data: Float32Array (0..1, row-major), width, height }.
  latest: null
};

function configSignature( config ) {
  return `${ config.depthModelUrl || "" }|${ config.segmentationModelUrl || "" }`;
}

// Lazily load TF.js + the estimator. Safe to call every frame: it returns
// immediately once loading / ready / permanently failed for this config.
export async function initDepth( config = {} ) {
  const signature = configSignature( config );

  if ( depth.loading ) {
    return;
  }

  if ( ( depth.ready || depth.failed ) && depth.signature === signature ) {
    return;
  }

  depth.loading = true;
  depth.signature = signature;
  depth.ready = false;
  depth.failed = false;

  try {
    const [
      tf,
      depthEstimation
    ] = await Promise.all( [
      import( "@tensorflow/tfjs-core" ),
      import( "@tensorflow-models/depth-estimation" )
    ] );

    // The WebGL backend registers itself as an import side effect.
    await import( "@tensorflow/tfjs-backend-webgl" );
    await tf.setBackend( "webgl" );
    await tf.ready();

    const estimatorConfig = {};

    if ( config.depthModelUrl ) {
      estimatorConfig.depthModelUrl = config.depthModelUrl;
    }

    if ( config.segmentationModelUrl ) {
      estimatorConfig.segmentationModelUrl = config.segmentationModelUrl;
    }

    depth.estimator = await depthEstimation.createEstimator(
      depthEstimation.SupportedModels.ARPortraitDepth,
      Object.keys( estimatorConfig ).length ? estimatorConfig : undefined
    );

    depth.ready = true;
  } catch( error ) {
    depth.failed = true;
    console.warn(
      "[video-point-cloud] depth model init failed:",
      error
    );
  } finally {
    depth.loading = false;
  }
}

// Schedule an inference on `source` (an HTMLVideoElement / HTMLCanvasElement)
// if the estimator is ready, idle, and the throttle interval has elapsed.
// Fire-and-forget: the result lands in depth.latest.
export function detectDepth(
  source, options = {}
) {
  if ( !depth.ready || depth.busy || !source ) {
    return;
  }

  const interval = options.intervalMs ?? 120;
  const now = performance.now();

  if ( now - depth.lastRunAt < interval ) {
    return;
  }

  const width = source.videoWidth || source.width || 0;
  const height = source.videoHeight || source.height || 0;

  if ( !width || !height ) {
    return;
  }

  depth.busy = true;
  depth.lastRunAt = now;

  const minDepth = options.minDepth ?? 0;
  const maxDepth = options.maxDepth ?? 1;

  depth.estimator
    .estimateDepth(
      source,
      {
        minDepth,
        maxDepth,
        flipHorizontal: false
      }
    )
    .then( async( depthMap ) => {
      if ( !depthMap ) {
        return;
      }

      // toTensor() hands back the underlying Tensor2D [height, width]; read it
      // to CPU (data() returns a fresh copy we own) and free the GPU tensor.
      const tensor = depthMap.toTensor();
      const shape = tensor.shape;
      const data = await tensor.data();

      tensor.dispose();

      depth.latest = {
        data,
        height: shape[ 0 ],
        width: shape[ 1 ]
      };
    } )
    .catch( ( error ) => {
      console.warn(
        "[video-point-cloud] depth inference failed:",
        error
      );
    } )
    .finally( () => {
      depth.busy = false;
    } );
}

export function disposeDepth() {
  try {
    depth.estimator?.dispose?.();
  } catch {}

  depth.estimator = null;
  depth.ready = false;
  depth.loading = false;
  depth.failed = false;
  depth.busy = false;
  depth.latest = null;
  depth.signature = "";
}

export default depth;
