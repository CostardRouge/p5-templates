/**
 * Unified sketch metadata utilities.
 *
 * Works across all engines — the single `src/sketches/metadata.json`
 * carries an `engine` field on every entry so look-ups can be scoped
 * or cross-engine.
 */
import type {
  SketchMetadata
} from "@/engines/types";

import allMetadata from "@/templates/metadata.json";

/* ---- types ------------------------------------------------------- */

export type ResolvedSketchMeta = SketchMetadata & {
  sketchPath: string;
};

/* ---- typed re-export of the raw JSON ----------------------------- */

export function getMetadata(): SketchMetadata[] {
  return allMetadata as SketchMetadata[];
}

/* ---- look-ups ---------------------------------------------------- */

/**
 * Find a single sketch entry by name, scoped to a specific engine.
 *
 * Returns the raw metadata enriched with a pre-computed `sketchPath`
 * (`category/name` when a category exists, otherwise just `name`).
 */
export function findSketchMeta(
  name: string,
  engineId: string,
): ResolvedSketchMeta | undefined {
  const meta = getMetadata()
    .find( ( m ) => m.name === name && m.engine === engineId );

  if ( !meta ) {
    return undefined;
  }

  return {
    ...meta,
    sketchPath: meta.category ? `${ meta.category }/${ name }` : name,
  };
}

/**
 * Return all templates that belong to `engineId`.
 */
export function listTemplatesForEngine( engineId: string, ): SketchMetadata[] {
  return getMetadata().filter( ( m ) => m.engine === engineId );
}

/* ---- path resolution --------------------------------------------- */

/**
 * Convenience wrapper — returns only the directory path for a sketch.
 *
 * Thin wrapper around `findSketchMeta`; prefer using `findSketchMeta`
 * directly when you also need other metadata fields.
 */
export function resolveSketchPath(
  name: string,
  engineId: string,
): string | undefined {
  return findSketchMeta(
    name,
    engineId
  )?.sketchPath;
}
