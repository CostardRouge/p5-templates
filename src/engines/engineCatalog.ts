/**
 * Static engine catalogue — id + display label only, with **zero runtime
 * dependencies**.
 *
 * Why this exists separately from `@/engines/index` / the registrations:
 * importing `@/engines/index` pulls every engine *class* (P5Engine, GsapEngine)
 * and their transitive graph (recording adapters, the generated 219-thunk
 * sketch registry, …). The gallery, home and engine-listing pages only need the
 * human label for an engine id — they should not drag the whole engine runtime
 * into their compile graph. They read from this module instead.
 *
 * This is the single source of truth for engine labels: the engine
 * registrations derive their `label` from here too (see `engines/p5/index.ts`
 * and `engines/gsap/index.ts`).
 */

export type EngineCatalogEntry = {
  id: string;
  label: string;
};

export const ENGINE_CATALOG: readonly EngineCatalogEntry[] = [
  {
    id: "p5",
    label: "p5.js"
  },
  {
    id: "gsap",
    label: "GSAP"
  }
];

export const ENGINE_LABELS: Record<string, string> = Object.fromEntries( ENGINE_CATALOG.map( ( entry ) => [
  entry.id,
  entry.label
] ) );

/** Display label for an engine id, falling back to the id itself. */
export function getEngineLabel( id: string ): string {
  return ENGINE_LABELS[ id ] ?? id;
}

/**
 * Whether `id` is a known engine — a static equivalent of the registry's
 * `hasEngine()` that doesn't require the engine runtime to be loaded.
 */
export function isKnownEngine( id: string ): boolean {
  return id in ENGINE_LABELS;
}
