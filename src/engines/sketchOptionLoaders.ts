import "server-only";

/**
 * Server-only loaders for a template's filesystem-backed option files
 * (`options.json` / `options.ts`).
 *
 * Why this is a separate, server-only module:
 *
 *  - `EngineRegistration` is bundled into the **browser** (engines render
 *    client-side, e.g. `EngineSketchRenderer` does `import "@/engines/index"`).
 *  - Some `options.ts` files execute server-only code at import time — e.g.
 *    the `photo/*` p5 templates call `getTestImagePaths()`, which reads
 *    `public/assets/images/test` via `fs/promises`.
 *
 * The loaders pull from `@/generated/sketchOptionsRegistry`, which is itself
 * `server-only` and built from **literal** dynamic imports (one code-split
 * point per option file). This keeps two earlier constraints satisfied without
 * a wildcard `import("@/p5/sketches/${path}/options.ts")` — which would build a
 * context module over every matching file and drag their `fs/promises` deps
 * into whatever bundle reaches it:
 *
 *  1. The option modules only ever land in the server bundle.
 *  2. Missing files resolve to `{}` instead of erroring on an empty glob.
 *
 * `getSketchOptions.ts` is the sole consumer and is itself only reached from
 * the server route.
 */

export type SketchOptionLoaders = {
  /** Import `<sketchPath>/options.json`; resolves to `{}` when none exists. */
  loadOptionsJson( sketchPath: string ): Promise<Record<string, unknown>>;
  /** Import `<sketchPath>/options.ts` (its `formValues`/`formConfiguration`). */
  loadSketchForm( sketchPath: string ): Promise<Record<string, unknown>>;
};

function buildLoaders( engineId: string ): SketchOptionLoaders {
  return {
    async loadOptionsJson( sketchPath: string ) {
      const {
        sketchOptionsJsonLoaders
      } = await import( "@/generated/sketchOptionsRegistry" );
      const loader = sketchOptionsJsonLoaders[ `${ engineId }:${ sketchPath }` ];

      if ( !loader ) {
        return {};
      }

      const mod = await loader();

      return ( mod.default ?? mod ) as Record<string, unknown>;
    },

    async loadSketchForm( sketchPath: string ) {
      const {
        sketchFormLoaders
      } = await import( "@/generated/sketchOptionsRegistry" );
      const loader = sketchFormLoaders[ `${ engineId }:${ sketchPath }` ];

      if ( !loader ) {
        return {};
      }

      return await loader() as Record<string, unknown>;
    }
  };
}

/**
 * Return the server-only option loaders for `engineId`.
 *
 * Always returns a loader pair: each loader resolves to `{}` when the generated
 * registry has no entry for the key, so callers don't need a separate
 * "does this engine ship option files?" guard. The registry (`@/generated/
 * sketchOptionsRegistry`, ~280 literal import() code-split points) is imported
 * *inside* the loaders rather than at module top level, so those split points
 * stay off the sketch route's initial server compile — they are only paid once
 * a loader actually runs while rendering a sketch that has options.
 */
export function getSketchOptionLoaders( engineId: string ): SketchOptionLoaders {
  return buildLoaders( engineId );
}
