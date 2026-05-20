import "server-only";

/**
 * Server-only loaders for a template's filesystem-backed option files
 * (`options.json` / `options.ts`).
 *
 * Why this is a separate, server-only module — and NOT a method on
 * `EngineRegistration`:
 *
 *  - `EngineRegistration` is bundled into the **browser** (engines render
 *    client-side, e.g. `EngineSketchRenderer` does `import "@/engines/index"`).
 *  - Some `options.ts` files execute server-only code at import time — e.g.
 *    the `photo/*` p5 templates call `getTestImagePaths()`, which reads
 *    `public/assets/images/test` via `fs/promises`.
 *  - A dynamic `import("@/p5/sketches/${path}/options.ts")` makes the bundler
 *    build a context module over every matching `options.ts`. If that lives
 *    anywhere reachable from the client, Turbopack pulls all of them — and
 *    their `fs/promises` deps — into the client bundle and fails to resolve.
 *
 * Keeping the dynamic import here, behind `server-only`, guarantees the
 * context is only ever built for the server bundle (where `fs/promises`
 * resolves). `getSketchOptions.ts` is the sole consumer and is itself only
 * reached from the server route.
 *
 * Two bundler constraints shape the import specifiers below:
 *  1. Fully static alias prefix (`@/p5/sketches/…`, `@/gsap/sketches/…`) — a
 *     shared `@/${engineId}/…` puts a wildcard at the alias root, which
 *     Turbopack cannot resolve.
 *  2. The glob must match at least one file — Turbopack hard-errors on an
 *     empty context (e.g. GSAP ships no `options.json`, so we skip it).
 */

export type SketchOptionLoaders = {
  /** Import `<sketchPath>/options.json`; resolves to `{}` when none exists. */
  loadOptionsJson( sketchPath: string ): Promise<Record<string, unknown>>;
  /** Import `<sketchPath>/options.ts` (its `formValues`/`formConfiguration`). */
  loadSketchForm( sketchPath: string ): Promise<Record<string, unknown>>;
};

const loadersByEngine: Record<string, SketchOptionLoaders> = {
  p5: {
    async loadOptionsJson( sketchPath: string ) {
      const mod = await import( `@/p5/sketches/${ sketchPath }/options.json` );

      return mod.default ?? mod;
    },

    async loadSketchForm( sketchPath: string ) {
      return await import( `@/p5/sketches/${ sketchPath }/options.ts` );
    }
  },

  gsap: {
    // No `options.json` files exist under `@/gsap/sketches`; importing that
    // empty glob would make Turbopack fail the build. GSAP defaults live in
    // `options.ts` (loadSketchForm). Restore the import if a GSAP template
    // ever ships an `options.json`.
    async loadOptionsJson() {
      return {};
    },

    async loadSketchForm( sketchPath: string ) {
      return await import( `@/gsap/sketches/${ sketchPath }/options.ts` );
    }
  }
};

/**
 * Return the server-only option loaders for `engineId`, or `undefined`
 * when the engine is unknown / has no template option files.
 */
export function getSketchOptionLoaders( engineId: string ): SketchOptionLoaders | undefined {
  return loadersByEngine[ engineId ];
}
