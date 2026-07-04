/**
 * Public entry point for the Three.js template toolkit.
 *
 * Sketches import from `@/threejs/utils` to register their lifecycle callbacks
 * and reach the live renderer/scene/camera:
 *
 *   import sketch, { getThree } from "@/threejs/utils";
 *   import options from "@/threejs/utils/options.js";
 */
export {
  default,
  getThree,
  getScene,
  getCamera,
  getRenderer,
  getCanvas
} from "./sketch.js";

export {
  default as options
} from "./options.js";
