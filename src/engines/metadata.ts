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

import allMetadata from "@/sketches/metadata.json";

/* ---- typed re-export of the raw JSON ----------------------------- */

export function getMetadata(): SketchMetadata[] {
  return allMetadata as SketchMetadata[];
}

/* ---- look-ups ---------------------------------------------------- */

/**
 * Find a single sketch entry by name (optionally scoped to an engine).
 */
export function findSketchMeta(
  name: string,
  engineId?: string,
): SketchMetadata | undefined {
  return getMetadata()
    .find( ( m ) =>
      m.name === name && ( engineId === undefined || m.engine === engineId ), );
}

/**
 * Return all templates that belong to `engineId`.
 */
export function listTemplatesForEngine( engineId: string, ): SketchMetadata[] {
  return getMetadata().filter( ( m ) => m.engine === engineId );
}

/* ---- path resolution --------------------------------------------- */

/**
 * Resolve the directory path for a sketch.
 *
 * If the sketch has a category the path is `category/name`,
 * otherwise just `name`.  This is independent of the engine —
 * the same convention applies everywhere.
 */
export function resolveSketchPath(
  name: string,
  engineId?: string,
): string {
  const meta = findSketchMeta(
    name,
    engineId,
  );

  if ( meta?.category ) {
    return `${ meta.category }/${ name }`;
  }

  return name;
}
