/**
 * Option helpers for GSAP/HTML templates.
 *
 * Templates receive `options` as a prop, but these helpers let utility code
 * (outside the React tree) read the same live values from the shared
 * `syncSketchOptions` store.
 */
import {
  getSketchOptions
} from "@/lib/syncSketchOptions";

export const DEFAULT_SIZE = {
  width: 1080,
  height: 1350
};

export const DEFAULT_ANIMATION = {
  framerate: 60,
  duration: 12
};

export const getOptions = () => getSketchOptions() ?? {};

export const getSize = () => getOptions().size ?? DEFAULT_SIZE;

export const getAnimation = () => getOptions().animation ?? DEFAULT_ANIMATION;

/** The per-template form values live under `options.sketch`. */
export const getSketch = () => getOptions().sketch ?? {};

/**
 * Read a dotted path from the options object with a fallback.
 * `getOption("sketch.text.value", "Hello")`.
 */
export function getOption(
  path, fallback
) {
  const segments = String( path ).split( "." );
  let value = getOptions();

  for ( const segment of segments ) {
    if ( value == null ) {
      return fallback;
    }

    value = value[ segment ];
  }

  return value === undefined ? fallback : value;
}
