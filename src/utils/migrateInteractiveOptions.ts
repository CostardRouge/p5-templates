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
 */

type AnyRecord = Record<string, any>;

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
    const slides = migrated.slides.map( ( slide: AnyRecord ) => {
      const next = migrateScope( slide );

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
