// Shim for `@mediapipe/selfie_segmentation`.
//
// `@tensorflow-models/body-segmentation` (pulled in transitively by
// ARPortraitDepth in @tensorflow-models/depth-estimation) does a STATIC
// top-level `import { SelfieSegmentation } from "@mediapipe/selfie_segmentation"`
// for its MediaPipe runtime. That package ships as a non-ESM UMD bundle with no
// named exports, which makes Turbopack/webpack fail the build
// ("Export SelfieSegmentation doesn't exist in target module").
//
// We only ever run ARPortraitDepth through the *tfjs* runtime of selfie
// segmentation, so the MediaPipe `SelfieSegmentation` class is never
// instantiated. This stub satisfies the static import binding without bundling
// the broken module. It is wired in via `resolveAlias` / `resolve.alias` in
// next.config.ts.

export class SelfieSegmentation {
  constructor() {
    throw new Error( "[video-point-cloud] MediaPipe SelfieSegmentation runtime is not bundled — " +
        "ARPortraitDepth uses the tfjs runtime instead." );
  }
}

const selfieSegmentation = {
  SelfieSegmentation
};

export default selfieSegmentation;
