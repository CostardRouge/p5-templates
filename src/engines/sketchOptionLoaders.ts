import "server-only";

import {
  sketchOptionsJsonLoaders,
  sketchFormLoaders
} from "@/generated/sketchOptionsRegistry";

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
      const loader = sketchOptionsJsonLoaders[ `${ engineId }:${ sketchPath }` ];

      if ( !loader ) {
        return {};
      }

      const mod = await loader();

      return ( mod.default ?? mod ) as Record<string, unknown>;
    },

    async loadSketchForm( sketchPath: string ) {
      const loader = sketchFormLoaders[ `${ engineId }:${ sketchPath }` ];

      if ( !loader ) {
        return {};
      }

      return await loader() as Record<string, unknown>;
    }
  };
}

/**
 * The set of engines that ship at least one option file, derived from the
 * generated registry keys (`<engineId>:<sketchPath>`).
 */
const enginesWithOptions = new Set( [
  ...Object.keys( sketchOptionsJsonLoaders ),
  ...Object.keys( sketchFormLoaders )
].map( ( key ) => key.slice(
  0,
  key.indexOf( ":" )
) ) );

/**
 * Return the server-only option loaders for `engineId`, or `undefined`
 * when the engine has no template option files.
 */
export function getSketchOptionLoaders( engineId: string ): SketchOptionLoaders | undefined {
  if ( !enginesWithOptions.has( engineId ) ) {
    return undefined;
  }

  return buildLoaders( engineId );
}
