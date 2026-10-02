/**
 * Legacy-shape migration for the interaction-bindings plugin.
 *
 * Bindings used to be stored INSIDE the sketch's own parameter object
 * (`sketch.bindings`, `slides[i].sketch.bindings`), which leaked binding
 * infrastructure into exports, save-defaults, randomize and sketch code. They
 * now live in a sibling namespace — `interactive.bindings` at the root and
 * per-slide — so this moves any legacy array over the first time an old save /
 * import / options.ts default passes through initOptions.
 *
 * NON-MUTATING at the input's expense: `OptionsSchema.parse` passes `sketch`
 * (a `z.any()` key) through BY REFERENCE, so the parsed tree can share objects
 * with the caller's input (page props, the live store). Deleting in place here
 * would strip `bindings` out of those shared objects too — every later parse
 * of the same input would then see no bindings and produce no `interactive`
 * namespace. The touched holder/sketch levels are shallow-copied instead.
 *
 * `sketch.interaction` is deliberately NOT moved: sketches that declare an
 * interaction block in their own options.ts (hand-tracking, audio, …) read it
 * from `options.sketch.interaction` in their sketch code, so it is a real
 * sketch parameter for them. The engine reads interaction as
 * `sketch.interaction ?? interactive.interaction`, which covers both declared
 * blocks and the plugin-managed one.
 *
 * It also makes every slide carry the `interactive` namespace that PLAYS on it
 * (see effectiveSlideInteractive): a slide missing a key ran the root's at
 * runtime while the editor, which only reads the slide's own namespace, showed
 * that slide as unbound.
 */
import deepClone from "@/utils/deepClone";

type AnyRecord = Record<string, any>;

/**
 * The `interactive` namespace that actually plays on a slide. The engine reads
 * each key from the slide when it has one and from the root otherwise
 * (`effectiveInteractive` in options.js, `??` per key), so this does the same,
 * key by key — a spread would let a slide's explicit `undefined` hide a root
 * value the engine still reads.
 *
 * Deep-cloned: `interactive` is `z.any()` and form edits write nested binding
 * fields in place, so a slide sharing the root's objects would edit both.
 * Undefined when neither side carries anything.
 */
export function effectiveSlideInteractive(
  root: AnyRecord | undefined, slide: AnyRecord | undefined
): AnyRecord | undefined {
  const merged: AnyRecord = {};

  for ( const key of new Set( [
    ...Object.keys( root ?? {} ),
    ...Object.keys( slide ?? {} )
  ] ) ) {
    const value = slide?.[ key ] ?? root?.[ key ];

    if ( value !== undefined && value !== null ) {
      merged[ key ] = value;
    }
  }

  return Object.keys( merged ).length > 0 ? deepClone( merged ) : undefined;
}

// True when the slide is missing a key the root would fill in at runtime.
function inheritsFromRoot(
  root: AnyRecord | undefined, slide: AnyRecord | undefined
): boolean {
  return Object.keys( root ?? {} ).some( ( key ) =>
    root?.[ key ] != null && slide?.[ key ] == null );
}

function migrateScope<T extends AnyRecord>( holder: T ): T {
  const sketch = holder?.sketch;

  if ( !sketch || typeof sketch !== "object" || !Array.isArray( sketch.bindings ) ) {
    return holder;
  }

  const {
    bindings, ...sketchRest
  } = sketch;

  return {
    ...holder,
    sketch: sketchRest,
    interactive: {
      ...holder.interactive,
      // An existing interactive.bindings wins — the sketch-scope copy is
      // stale legacy data at that point, and is dropped either way so it
      // stops leaking into sketch-scope consumers.
      bindings: holder.interactive?.bindings ?? bindings
    }
  };
}

export default function migrateInteractiveOptions<T extends AnyRecord>( options: T ): T {
  let migrated = migrateScope( options );

  if ( Array.isArray( migrated?.slides ) ) {
    let slidesChanged = false;
    const rootInteractive = migrated.interactive;
    const slides = migrated.slides.map( ( slide: AnyRecord ) => {
      let next = migrateScope( slide );

      // Render-preserving: the slide gets the keys the engine was already
      // reading from the root, so the picture is unchanged and the editor
      // finally shows what plays.
      if ( inheritsFromRoot(
        rootInteractive,
        next?.interactive
      ) ) {
        next = {
          ...next,
          interactive: effectiveSlideInteractive(
            rootInteractive,
            next.interactive
          )
        };
      }

      slidesChanged ||= next !== slide;

      return next;
    } );

    if ( slidesChanged ) {
      migrated = migrated === options
        ? {
          ...migrated,
          slides
        }
        : Object.assign(
          migrated,
          {
            slides
          }
        );
    }
  }

  return migrated;
}
