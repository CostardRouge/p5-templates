/**
 * Public entry point for GSAP/HTML template authors.
 *
 *   import { useTimeline, gsap, toWords } from "@/gsap/utils";
 */
export {
  default as runtime,
  useTimeline,
  updateSketchOptions,
  gsap,
  RuntimeContext,
  type TimelineBuildArgs,
  type TimelineBuilder
} from "./runtime";

export * from "./options";
export * from "./dom";
export * from "./easing";
export * from "./images";
export * from "./style";
export * from "./random";
export * from "./motion";
