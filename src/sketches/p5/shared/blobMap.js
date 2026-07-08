/**
 * Compatibility shim. The real implementation lives in
 * `@/lib/assets/blobMap` so it can be used by any engine, not just p5.
 * Remove this file once all consumers import from `@/lib/assets` directly.
 */
export {
  registerBlob
} from "@/lib/assets/blobMap";
