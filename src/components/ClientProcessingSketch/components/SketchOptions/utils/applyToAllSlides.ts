import type {
  FieldValues, UseFormGetValues, UseFormSetValue
} from "react-hook-form";
import deepClone from "@/utils/deepClone";

/**
 * Cross-slide parameter propagation.
 *
 * Each slide stores a full copy of the sketch parameters under
 * `slides.<index>.sketch`. These helpers take the value currently held at a
 * field/block path on the *active* slide and write it onto the same relative
 * path of every other slide — so a user can tweak, say, the `colors` block (or
 * a single global field like `backgroundColor`) once and apply it everywhere.
 *
 * The change goes through `setValue`, so a single Undo reverts the whole
 * propagation via the existing form history.
 */

const SLIDE_SKETCH_PATH = /^slides\.(\d+)\.sketch(?:\.(.+))?$/;

type ParsedSlidePath = {
  /** Index of the slide the path points at. */
  index: number;
  /** Relative path within a slide's `sketch`, dot-prefixed (`""` for the whole sketch). */
  suffix: string;
};

/**
 * Parses a RHF field path of the shape `slides.<index>.sketch[.<suffix>]`.
 * Returns `null` for anything that isn't a slide-scoped sketch path (e.g. the
 * global `sketch.…` path used when no slide is active).
 */
export function parseSlidePath( fullPath: string ): ParsedSlidePath | null {
  const match = SLIDE_SKETCH_PATH.exec( fullPath );

  if ( !match ) {
    return null;
  }

  return {
    index: Number( match[ 1 ] ),
    suffix: match[ 2 ] ? `.${ match[ 2 ] }` : ""
  };
}

/** Number of slides currently in the form, or 0 when there are none. */
export function countSlides( getValues: UseFormGetValues<FieldValues> ): number {
  const slides = getValues( "slides" );

  return Array.isArray( slides ) ? slides.length : 0;
}

/**
 * Whether an "apply to all slides" action is meaningful for this path — i.e. we
 * are editing a slide and there is at least one *other* slide to apply to.
 */
export function canApplyToAllSlides(
  getValues: UseFormGetValues<FieldValues>,
  fullPath: string
): boolean {
  return parseSlidePath( fullPath ) !== null && countSlides( getValues ) > 1;
}

/**
 * Copies the value at `fullPath` (on its own slide) onto the matching path of
 * every other slide. Returns the number of slides written to (0 when the path
 * isn't slide-scoped or there is only a single slide).
 */
export function applyToAllSlides(
  getValues: UseFormGetValues<FieldValues>,
  setValue: UseFormSetValue<FieldValues>,
  fullPath: string
): number {
  const parsed = parseSlidePath( fullPath );

  if ( !parsed ) {
    return 0;
  }

  const slides = getValues( "slides" );

  if ( !Array.isArray( slides ) || slides.length < 2 ) {
    return 0;
  }

  const value = getValues( fullPath );

  let applied = 0;

  for ( let index = 0; index < slides.length; index++ ) {
    if ( index === parsed.index ) {
      continue;
    }

    setValue(
      `slides.${ index }.sketch${ parsed.suffix }`,
      deepClone( value ),
      {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true
      }
    );

    applied++;
  }

  return applied;
}
