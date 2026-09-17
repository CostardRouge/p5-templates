/**
 * Bindings a sketch DECLARES on its own fields, resolved at read time and never
 * written to the document.
 *
 * A field's config can carry `binding: { control: "knob.1" }` — an abstract
 * control address that names no device, no port and no CC number. The editor
 * walks the form config, turns each one into a binding descriptor, and publishes
 * the list here; the engine reads it in `options.js` and resolves `control`
 * against the map of whichever MIDI port is being listened to.
 *
 * Why a module singleton rather than the options store: these must NOT reach the
 * document. Writing them into `interactive.bindings` would put one machine's CC
 * numbers into the saved JSON, the export and `/embed`, dirty the form on every
 * reconnect, and — because `mergeChangedInPlace` treats arrays as leaves — be
 * wiped wholesale by the next form push anyway. The same shape as
 * `audioBridge` / `channelBridge`: live data shared between React and the
 * engine, outside the document, with the engine free to ignore it.
 */

import type {
  BindingKind
} from
  "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/BindingAffordance/bindingUtils";

export interface DeclaredBinding {
  /** Sketch-relative dotted path, e.g. `"noise.speed"` — a binding `target`. */
  target: string;
  /** Abstract control address, e.g. `"knob.1"`. Resolved by the engine. */
  control: string;
  kind: BindingKind;
  /** Range/curve for the kind, built from the field's own config. */
  mapping?: unknown;
  smoothing?: number;
}

export interface DeclaredBindingState {
  bindings: DeclaredBinding[];
}

const EMPTY: DeclaredBindingState = {
  bindings: []
};

let current: DeclaredBindingState = EMPTY;

/** Replace the published state. Pass null to clear it (sketch teardown). */
export function publishDeclaredBindings( next: DeclaredBindingState | null ): void {
  current = next ?? EMPTY;
}

/**
 * The live state. Returns the same object until the next publish, so the
 * engine's per-frame read costs nothing.
 */
export function getDeclaredBindings(): DeclaredBindingState {
  return current;
}
