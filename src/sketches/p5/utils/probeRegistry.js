// ── Probe registry — the pure core ──────────────────────────────────────────
//
// A "probe" is a value a sketch computes inside draw() and chooses to expose
// under a stable name, so the HUD can display it and, later, a binding can
// follow it. This module is the registry those values land in. It is PURE (no
// p5, no window, no runtime imports) so it can be unit-tested with a fake
// instance key and a hand-advanced frame; `probe.js` wires one instance of it
// to the running sketch.
//
// Three rules shape it, each already paid for elsewhere in this repo:
//
//   • One module evaluation backs several running instances (the page, plus
//     every "sketch" content-item layer embedding the same module — see
//     instanceState.js). So slots are kept PER INSTANCE, keyed the way
//     `sketch.state()` keys: by the surface override, null for the page.
//
//   • Cardinality, not call cost, is the performance risk: `probe( "r", x )`
//     inside a loop over 5 000 particles is 5 000 writes to one slot, and the
//     last one means nothing. So every slot counts its writes per frame — the
//     inspector shows the count — and `fold()` turns a name written N times
//     into one tenable number (min / max / mean / sum / count) in O(1) a call.
//
//   • Zero allocation after the first write: a slot is a plain object reused
//     across frames, stamped with the frame it was last written in. Reads and
//     the per-frame snapshot check that stamp instead of anything being
//     cleared, so an idle frame costs nothing and there is no per-frame sweep.
//
// Liveness: a slot is "live" when it was written this frame or the previous
// one. The one-frame tolerance is deliberate — the HUD renders in post-draw,
// after the page's draw, but a sketch LAYER draws inside that same post-draw
// pass and may land after the widget reading it; without the tolerance such a
// probe would flicker between a value and nothing every frame. A probe that
// stops being written for longer is absent, never a frozen last value: same
// rule as a live interaction channel (interaction-bindings.md).

export const FOLD_MODES = [
  "last",
  "min",
  "max",
  "mean",
  "sum",
  "count"
];

const FOLDS = new Set( FOLD_MODES );

/**
 * The value shape a probe carries, as the pickers and widgets sort them: a
 * point widget can only read a point, the scalar pickers list the rest.
 */
export function probeShape( value ) {
  if ( typeof value === "number" ) {
    return "scalar";
  }

  if ( typeof value === "boolean" ) {
    return "boolean";
  }

  if ( typeof value === "string" ) {
    return "text";
  }

  if ( Array.isArray( value ) ) {
    return "list";
  }

  if (
    value &&
    typeof value === "object" &&
    typeof value.x === "number" &&
    typeof value.y === "number"
  ) {
    return "point";
  }

  return "other";
}

function makeSlot( name ) {
  return {
    name,
    frame: -1,
    value: undefined,
    count: 0,
    fold: "last",
    min: Infinity,
    max: -Infinity,
    sum: 0,
    meta: null
  };
}

// A number goes through the fold accumulators; anything else is "last" only
// (there is no min of a string), and its count still tells the inspector when
// a name is written more than once a frame.
function accumulate(
  slot, value
) {
  slot.count += 1;
  slot.value = value;

  if ( typeof value === "number" && Number.isFinite( value ) ) {
    if ( value < slot.min ) {
      slot.min = value;
    }

    if ( value > slot.max ) {
      slot.max = value;
    }

    slot.sum += value;
  }
}

function foldedValue( slot ) {
  // There is no mean of a string: a non-numeric value reads as its last write
  // whatever mode the fold asked for.
  if ( typeof slot.value !== "number" ) {
    return slot.value;
  }

  switch ( slot.fold ) {
    case "min":
      return slot.min === Infinity ? undefined : slot.min;
    case "max":
      return slot.max === -Infinity ? undefined : slot.max;
    case "mean":
      return slot.count > 0 && slot.sum !== undefined ? slot.sum / slot.count : undefined;
    case "sum":
      return slot.sum;
    case "count":
      return slot.count;
    default:
      return slot.value;
  }
}

/**
 * @param {object} [options]
 * @param {() => unknown} [options.getKey] - the instance drawing right now; a
 *   nullish key is the page. Defaults to "always the page".
 */
export function createProbeRegistry( options = {} ) {
  const getKey = options.getKey ?? ( () => null );

  // Records: one per instance. The page's record is held strongly (it outlives
  // any one p5 instance, like the page's sketch.state() record); a layer's is
  // held weakly and dies with the layer. A layer's probes are recorded so they
  // never bleed into the page's, but they are not read or published yet — a
  // WeakMap cannot be walked, and naming a layer is an open decision
  // (docs/probe-system.md, "layer addressing").
  let host = new Map();
  const layerRecords = new WeakMap();
  let frame = 0;

  function recordFor( key ) {
    if ( !key ) {
      return host;
    }

    let record = layerRecords.get( key );

    if ( !record ) {
      record = new Map();
      layerRecords.set(
        key,
        record
      );
    }

    return record;
  }

  function slotFor(
    record, name
  ) {
    let slot = record.get( name );

    if ( !slot ) {
      slot = makeSlot( name );
      record.set(
        name,
        slot
      );
    }

    // First write of a frame: reset the per-frame accumulators in place.
    if ( slot.frame !== frame ) {
      slot.frame = frame;
      slot.count = 0;
      slot.min = Infinity;
      slot.max = -Infinity;
      slot.sum = 0;
    }

    return slot;
  }

  function isLive( slot ) {
    return frame - slot.frame <= 1;
  }

  /**
   * Record `value` under `name` for the instance drawing now, and hand it back
   * unchanged so the call drops into an expression. `meta` (label, unit, min,
   * max, decimals) is display-only and kept from the first call that passes
   * one.
   */
  function write(
    name, value, meta
  ) {
    const slot = slotFor(
      recordFor( getKey() ),
      String( name )
    );

    slot.fold = "last";
    accumulate(
      slot,
      value
    );

    if ( meta && !slot.meta ) {
      slot.meta = meta;
    }

    return value;
  }

  /**
   * Like `write`, for a name written many times a frame: the slot reports the
   * fold of everything written this frame rather than whichever write came
   * last. Non-numeric values fold as "last" whatever the mode asks.
   */
  function fold(
    name, value, mode = "mean", meta
  ) {
    const slot = slotFor(
      recordFor( getKey() ),
      String( name )
    );

    slot.fold = FOLDS.has( mode ) ? mode : "last";
    accumulate(
      slot,
      value
    );

    if ( meta && !slot.meta ) {
      slot.meta = meta;
    }

    return value;
  }

  /**
   * The current value of a probe on the PAGE, or undefined when it has not
   * been written this frame or the previous one. Layer probes are not
   * addressable by name yet — see docs/probe-system.md, "layer addressing".
   */
  function read( name ) {
    const slot = host.get( String( name ) );

    if ( !slot || !isLive( slot ) ) {
      return undefined;
    }

    return foldedValue( slot );
  }

  /** Display metadata for a page probe, or null. */
  function meta( name ) {
    const slot = host.get( String( name ) );

    return slot?.meta ?? null;
  }

  /** Advance the frame. Called once per rendered frame, before the draw. */
  function beginFrame() {
    frame += 1;
  }

  function entryOf( slot ) {
    const value = foldedValue( slot );

    return {
      name: slot.name,
      value,
      shape: probeShape( value ),
      count: slot.count,
      fold: slot.fold,
      label: slot.meta?.label ?? null,
      unit: slot.meta?.unit ?? null,
      min: typeof slot.meta?.min === "number" ? slot.meta.min : null,
      max: typeof slot.meta?.max === "number" ? slot.meta.max : null,
      decimals: typeof slot.meta?.decimals === "number" ? slot.meta.decimals : null
    };
  }

  /**
   * Every live page probe, in first-written order: what the bridge publishes
   * to the studio each frame.
   */
  function snapshot() {
    const entries = [];

    for ( const slot of host.values() ) {
      if ( isLive( slot ) ) {
        entries.push( entryOf( slot ) );
      }
    }

    return entries;
  }

  /** Forget everything — a new sketch is starting. */
  function reset() {
    host = new Map();
    frame = 0;
  }

  return {
    write,
    fold,
    read,
    meta,
    beginFrame,
    snapshot,
    reset,
    get frame() {
      return frame;
    }
  };
}
