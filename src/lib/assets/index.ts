export {
  registerBlob, getBlobURL, revokeBlob
} from "./blobMap";
export {
  resolveAssetURL
} from "./resolveAssetURL";
export {
  getScopeAssetPath
} from "./getScopeAssetPath";
export type {
  AssetScope
} from "./getScopeAssetPath";

export type {
  AssetInstance,
  AssetKind,
  AssetPreviewProps,
  AssetLayoutPreviewProps,
  AssetParamsEditorProps
} from "./types";
export {
  registerAssetKind, getAssetKind, listAssetKinds
} from "./registry";

// Side-effect: registers built-in kinds (images, videos, …). Importing
// `@/lib/assets` anywhere guarantees the registry is populated.
import "./kinds";

export {
  default as ControlledAssetInput
} from "./components/ControlledAssetInput";
export {
  default as ControlledAssetStackInput
} from "./components/ControlledAssetStackInput";

export {
  defaultVideoParams, computeVideoPhase, computeVideoLayout
} from "./kinds/videos/types";
export type {
  VideoParams, VideoLoopMode, VideoFit, Rect
} from "./kinds/videos/types";
export {
  loadVideoAsset
} from "./kinds/videos/loadVideoAsset";
export type {
  VideoSource, LoadVideoOptions, VideoSourceInput
} from "./kinds/videos/loadVideoAsset";
export {
  createVideoSync
} from "./kinds/videos/createVideoSync";
export type {
  VideoSync, VideoSyncOptions
} from "./kinds/videos/createVideoSync";

export {
  trackPendingMedia, awaitPendingMedia
} from "./pendingMedia";

export {
  IMAGE_INPUT_ACCEPT, normalizeImageFile
} from "./exotic";
