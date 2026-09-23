// ── Probes — expose a value a sketch computes inside draw() ─────────────────
//
// A sketch's parameters are already observable: a HUD widget or the specs
// overlay reads them by key-path. What a sketch DERIVES from them — the eased
// head position, the radius after four mappings, how many particles survived
// the cull — only ever existed inside draw(). A probe gives such a value a
// name, and the name makes it a source: `probe:head` in a HUD widget's source
// picker, the Probes inspector in the studio, later a binding channel.
//
//   import probe from "@/p5/utils/probe.js";
//
//   const head = probe( "head", phase * K );              // returns its input
//   probe( "arc.height", height, { label: "Arc", min: -2, max: 2 } );
//
//   for ( … ) {
//     probe.fold( "capsule.r", r, "mean" );              // N writes, one slot
//   }
//
// What deserves a probe — the rule, since sketches are mostly written by an
// agent now (docs/memory/sketches.md): what you would need to understand the
// sketch without reading its code — the phase it is at, the derived value that
// drives a rendering, a decision (how many kept, which branch), the aggregate
// of a loop. Five to fifteen per sketch, namespaced with dots (`arc.t`,
// `capsule.r`), never inside an inner loop without `fold`.
//
// Cost: one Map lookup and a few field writes per call, bounded by the number
// of distinct NAMES when folding is used; nothing is allocated after a name's
// first write. There is no "off" — the registry is always recording — because
// at that price a switch would cost more to keep right than it saves.
//
// Determinism: a probe is computed by the sketch from the sketch's own state,
// never from a device, so it reproduces in headless capture — unlike the
// mouse or a camera. The HUD reads a probe in the same frame it was written
// (widgets draw in post-draw); anything reading from the previous frame gets
// the previous value, which the registry tolerates on purpose (see
// probeRegistry.js, liveness).

import events from "./events.js";
import {
  getSurfaceOverride
} from "./sketch.js";
import {
  createProbeRegistry
} from "./probeRegistry.js";
import {
  PROBE_SOURCE_PREFIX, probeSourceName
} from "./hud/keyPaths.js";
import {
  publishProbes
} from "@/lib/probeBridge";

// Keyed like sketch.state(): the layer's surface proxy, or the page when none
// is drawing — so two layers of one sketch never write into each other's
// slots. Wrapped rather than passed, so this module's top level touches
// nothing of sketch.js while the two are still evaluating (it sits inside the
// existing sketch ↔ options import cycle).
const registry = createProbeRegistry( {
  getKey: () => getSurfaceOverride()
} );

function probe(
  name, value, meta
) {
  return registry.write(
    name,
    value,
    meta
  );
}

/**
 * A probe written many times a frame — inside a loop over particles, cells,
 * letters. The slot reports the fold of every write this frame (`"mean"`,
 * `"min"`, `"max"`, `"sum"`, `"count"`, or `"last"`) instead of whichever
 * write happened to come last.
 */
probe.fold = (
  name, value, mode, meta
) => registry.fold(
  name,
  value,
  mode,
  meta
);

export default probe;

export {
  PROBE_SOURCE_PREFIX
};

/**
 * Resolve a HUD source of the form "probe:<name>" to the probe's current
 * value on the page, or undefined when no such probe is live.
 */
export function readProbeSource( source ) {
  return registry.read( probeSourceName( source ) );
}

/** The probe's display metadata ({ label, unit, … }) for a "probe:<name>" source, or null. */
export function probeSourceMeta( source ) {
  return registry.meta( probeSourceName( source ) );
}

/** Test seam: the registry behind the default probe. */
export function getProbeRegistry() {
  return registry;
}

let _lastPublishedCount = -1;

function publishFrame() {
  const entries = registry.snapshot();

  // A sketch with no probes must not cost the studio a subscriber call per
  // frame: publish the empty snapshot once, then stay quiet until a probe
  // appears.
  if ( entries.length === 0 && _lastPublishedCount === 0 ) {
    return;
  }

  _lastPublishedCount = entries.length;
  publishProbes( entries );
}

function resetForNewSketch() {
  registry.reset();
  _lastPublishedCount = -1;
  publishProbes( [] );
}

/**
 * Register the per-frame lifecycle on the sketch's event bus. Called from
 * options.js's registerEvents() on every sketch start, since a restart clears
 * the registry of handlers.
 */
export function registerProbeEvents() {
  events.register(
    "pre-setup",
    resetForNewSketch
  );
  events.register(
    "pre-draw",
    registry.beginFrame
  );
  events.register(
    "post-draw",
    publishFrame
  );
}
