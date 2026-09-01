// ── Interactive bindings: the modulation resolver ───────────────────────────
// A binding is serializable data that says "drive this sketch parameter from
// this interaction channel". It is resolved at READ time (not written into the
// store) so the form, undo/redo, persistence and "save defaults" never see the
// transient modulated value — only the base value the user set.
//
// Pipeline per binding:
//   channel → project (vector2d → scalar) → invert → curve → range-map → target
//
// This module is intentionally PURE (no p5 / DOM imports) so the mapping
// pipeline is unit-testable. The impure parts (sampling channels, the current
// frame number) are injected by the caller — see options.js, which wires this
// into the live `options.sketch` proxy.
//
// MVP scope: the "continuous" family (slider / number targets) and the
// "vector2d" passthrough. The boolean / enum families (threshold, hysteresis,
// edge-toggle) extend `applyBinding` later via new `kind` branches.

// The shared easing set (pure math, no p5/DOM) — used to shape the 0..1 signal
// by the same easing keys the form's easing control produces.
import easing from "@/p5/utils/easing.js";

// ── Small numeric helpers ───────────────────────────────────────────────────

function clamp01( v ) {
  if ( v < 0 ) {
    return 0;
  }

  if ( v > 1 ) {
    return 1;
  }

  return v;
}

function num(
  v, fallback
) {
  return typeof v === "number" && Number.isFinite( v ) ? v : fallback;
}

function lerp(
  a, b, t
) {
  return a + ( b - a ) * t;
}

// ── Channel projection (vector2d → scalar) ──────────────────────────────────
// A scalar target needs a single number, so a vector2d channel is projected
// down. Distances/angles are measured from the channel's center (0.5, 0.5) and
// renormalized to 0..1 so the downstream range-map stays uniform.

export function projectChannel(
  channel, project
) {
  if ( !channel ) {
    return 0;
  }

  if ( channel.type === "scalar" ) {
    return clamp01( num(
      channel.value,
      0
    ) );
  }

  const x = clamp01( num(
    channel.x,
    0.5
  ) );
  const y = clamp01( num(
    channel.y,
    0.5
  ) );

  switch ( project ) {
    case "y":
      return y;
    case "mag": {
      // Max center→corner distance is √0.5 ≈ 0.7071; divide to get 0..1.
      const d = Math.hypot(
        x - 0.5,
        y - 0.5
      );

      return clamp01( d / Math.SQRT1_2 );
    }
    case "angle": {
      // atan2 yields -π..π; shift+scale to 0..1.
      const a = Math.atan2(
        y - 0.5,
        x - 0.5
      );

      return ( a + Math.PI ) / ( 2 * Math.PI );
    }
    case "x":
    default:
      return x;
  }
}

// ── Curve shaping ───────────────────────────────────────────────────────────
// `curve` is an easing key from the shared easing set (utils/easing.js) — the
// same keys the form's easing control stores ("linear", "smoothstep",
// "easeOutQuad", …). Unknown/missing keys fall through to the identity.

export function applyCurve(
  s, curve
) {
  const fn = curve && easing[ curve ];

  return typeof fn === "function" ? fn( s ) : s;
}

// ── Generators (computed sources) ───────────────────────────────────────────
// Unlike input channels (sampled from the world), generators compute their 0..1
// value from the sketch's animation progression plus the binding's own params,
// so they are deterministic and recording-safe. `context.progression` is the
// loop-normalized 0..1 position; `context.frame` is a fallback for sketches
// with no loop.

const GENERATOR_SOURCES = new Set( [
  "oscillator",
  "ramp",
  "sequence",
  "noise",
  "random"
] );

export function isGenerator( source ) {
  return GENERATOR_SOURCES.has( source );
}

// Whether any binding in the list is bound to a live "input" channel — as
// opposed to a generator, which computes standalone from the sketch's own
// progression and needs no `interaction` block at all. Shared by the
// server-side seed (getSketchOptions.getSketchMeta, for sketches that ship
// default input-sourced bindings) and the client binding UI
// (BindingAffordance / GenericObjectForm), so a sketch only carries — and
// only shows the settings panel for — the shared Interaction block while it
// actually has a binding that needs it.
export function needsInteractionBlock( bindings ) {
  const list = Array.isArray( bindings ) ? bindings : [];

  return list.some( ( binding ) => binding && binding.source && !isGenerator( binding.source ) );
}

function frac( x ) {
  return x - Math.floor( x );
}

// Deterministic pseudo-random in [0, 1) from a number — the classic sin-hash.
// Pure (no Math.random) so noise/random generators stay recording-safe: the
// same progression always yields the same value.
function hash01( n ) {
  const s = Math.sin( n * 127.1 + 311.7 ) * 43758.5453123;

  return s - Math.floor( s );
}

// Wave shapes over one cycle (phase → 0..1). sine/triangle sweep 0→1→0; square
// is a 50% duty low/high; sawtooth ramps 0→1 then resets.
export function waveValue(
  wave, phase
) {
  const p = frac( phase );

  switch ( wave ) {
    case "triangle":
      return 1 - 2 * Math.abs( p - 0.5 );
    case "square":
      return p < 0.5 ? 0 : 1;
    case "sawtooth":
      return p;
    case "sine":
    default:
      return ( Math.sin( 2 * Math.PI * p - Math.PI / 2 ) + 1 ) / 2;
  }
}

function progressionOf( context ) {
  if ( context && typeof context.progression === "number" ) {
    return context.progression;
  }

  // Fallback for non-looping sketches: a slow drift derived from the frame.
  if ( context && typeof context.frame === "number" ) {
    return context.frame * 0.01;
  }

  return 0;
}

// Oscillator: `cycles` full waves across the loop, shifted by `phase` (0..1).
export function oscillatorValue(
  osc, context
) {
  const o = osc ?? {};

  return waveValue(
    o.wave ?? "sine",
    progressionOf( context ) * num(
      o.cycles,
      1
    ) + num(
      o.phase,
      0
    )
  );
}

// Ramp: an eased 0→1 sweep repeated `count` times across the loop. `yoyo` folds
// each sweep into 0→1→0 before easing (an eased ping-pong).
export function rampValue(
  ramp, context
) {
  const r = ramp ?? {};

  let p = frac( progressionOf( context ) * num(
    r.count,
    1
  ) + num(
    r.phase,
    0
  ) );

  if ( r.yoyo ) {
    p = 1 - 2 * Math.abs( p - 0.5 );
  }

  const fn = r.easing && easing[ r.easing ];

  return clamp01( typeof fn === "function" ? fn( p ) : p );
}

// Sequence: step (or smoothly interpolate) through a list of stop VALUES across
// the loop, `cycles` times. Stops are stored in the target parameter's own
// units (e.g. radius 10, 50, 10); they are normalized here against the binding's
// [min, max] so the standard range-map turns them back into the stop value —
// which makes min/max act as a clamp/window on the sequence, like every other
// source. With no stops it returns 0 (a no-op).
export function sequenceValue(
  seq, context, min, max
) {
  const s = seq ?? {};
  const stops = Array.isArray( s.stops ) ? s.stops : [];

  if ( stops.length === 0 ) {
    return 0;
  }

  const t = frac( progressionOf( context ) * num(
    s.cycles,
    1
  ) + num(
    s.phase,
    0
  ) );

  const n = stops.length;
  const pos = t * n;
  const i0 = Math.floor( pos ) % n;

  let value;

  if ( s.mode === "smooth" ) {
    // Animated transition between consecutive stops — mirrors animation.ease:
    // dwell at the current stop for `hold` of the segment, then ease across to
    // the next stop. With hold 0 and linear easing this is a plain glide.
    const i1 = ( i0 + 1 ) % n;
    const hold = Math.min(
      clamp01( num(
        s.hold,
        0
      ) ),
      0.99
    );

    let f = pos - Math.floor( pos );

    if ( hold > 0 ) {
      f = f <= hold ? 0 : ( f - hold ) / ( 1 - hold );
    }

    const fn = s.easing && easing[ s.easing ];
    const eased = typeof fn === "function" ? fn( f ) : f;

    value = lerp(
      num(
        stops[ i0 ],
        0
      ),
      num(
        stops[ i1 ],
        0
      ),
      eased
    );
  } else {
    value = num(
      stops[ i0 ],
      0
    );
  }

  return max === min ? 0 : clamp01( ( value - min ) / ( max - min ) );
}

// Noise: smooth 1-D value noise over progression — an organic wander, the
// classic alternative to an oscillator. `speed` sets the wander rate, `seed`
// offsets into the noise field. Smoothstep-interpolated for a calm curve.
export function noiseValue(
  noise, context
) {
  const o = noise ?? {};
  const x = progressionOf( context ) * num(
    o.speed,
    1
  ) + num(
    o.seed,
    0
  );
  const i = Math.floor( x );
  const f = x - i;
  const u = f * f * ( 3 - 2 * f );

  return clamp01( lerp(
    hash01( i ),
    hash01( i + 1 ),
    u
  ) );
}

// Random: sample-and-hold. The loop is divided into `steps` slots; each slot
// holds a stable pseudo-random value (deterministic from its index + `seed`),
// giving stepped generative variation. `phase` shifts the slot boundaries.
export function randomValue(
  rnd, context
) {
  const o = rnd ?? {};
  const steps = Math.max(
    1,
    Math.round( num(
      o.steps,
      4
    ) )
  );
  const index = Math.floor( progressionOf( context ) * steps + num(
    o.phase,
    0
  ) );

  return clamp01( hash01( index + num(
    o.seed,
    0
  ) * 1000 + 0.5 ) );
}

// ── Scalar resolution (input projection or generator) ───────────────────────
// The raw 0..1 signal for a continuous binding, before invert/curve. For input
// sources it projects the (already looked-up) channel; for generators it
// computes from the binding's own params + context.
function rawScalar(
  binding, channel, context
) {
  if ( binding.source === "oscillator" ) {
    return oscillatorValue(
      binding.oscillator,
      context
    );
  }

  if ( binding.source === "ramp" ) {
    return rampValue(
      binding.ramp,
      context
    );
  }

  if ( binding.source === "sequence" ) {
    const mapping = binding.mapping ?? {};

    return sequenceValue(
      binding.sequence,
      context,
      num(
        mapping.min,
        0
      ),
      num(
        mapping.max,
        1
      )
    );
  }

  if ( binding.source === "noise" ) {
    return noiseValue(
      binding.noise,
      context
    );
  }

  if ( binding.source === "random" ) {
    return randomValue(
      binding.random,
      context
    );
  }

  return projectChannel(
    channel,
    binding.project
  );
}

// The shaped 0..1 signal: raw → invert → curve. This is both the value that
// maps to the output range and the "tension" the VU meter (and future audio)
// reads.
export function shapedScalar(
  binding, channel, context
) {
  const mapping = binding.mapping ?? {};

  let s = rawScalar(
    binding,
    channel,
    context
  );

  if ( mapping.invert ) {
    s = 1 - s;
  }

  return applyCurve(
    s,
    mapping.curve
  );
}

// ── Mapping families ────────────────────────────────────────────────────────

// Continuous: shaped scalar → range-map. Returns a single number. `channel` is
// the looked-up channel for input sources (ignored for generators).
export function mapContinuous(
  channel, binding, context
) {
  const mapping = binding.mapping ?? {};

  return lerp(
    num(
      mapping.min,
      0
    ),
    num(
      mapping.max,
      1
    ),
    shapedScalar(
      binding,
      channel,
      context
    )
  );
}

// Vector2d passthrough: feed a vector2d channel straight into a {x,y} target,
// each axis range-mapped independently (defaults to 0..1 identity). A scalar
// channel feeds both axes equally.
export function mapVector(
  channel, binding
) {
  const mapping = binding.mapping ?? {};
  const xr = mapping.x ?? {};
  const yr = mapping.y ?? {};

  let fx, fy;

  if ( channel && channel.type === "vector2d" ) {
    fx = clamp01( num(
      channel.x,
      0.5
    ) );
    fy = clamp01( num(
      channel.y,
      0.5
    ) );
  } else {
    fx = fy = projectChannel(
      channel,
      binding.project
    );
  }

  return {
    x: lerp(
      num(
        xr.min,
        0
      ),
      num(
        xr.max,
        1
      ),
      fx
    ),
    y: lerp(
      num(
        yr.min,
        0
      ),
      num(
        yr.max,
        1
      ),
      fy
    )
  };
}

// ── Temporal smoothing (per binding) ────────────────────────────────────────
// Keyed by the binding's identity so each one lags independently. `smoothing`
// is 0..1: 0 disables it, higher lags more (calmer, less responsive).

const _smoothState = new Map();

function bindingKey( binding ) {
  return [
    binding.source,
    binding.project ?? "",
    binding.target,
    binding.kind ?? "continuous"
  ].join( "|" );
}

function smoothNumber(
  key, value, amount
) {
  if ( !( amount > 0 ) ) {
    _smoothState.set(
      key,
      value
    );

    return value;
  }

  const prev = _smoothState.get( key );
  const next = typeof prev === "number"
    ? lerp(
      value,
      prev,
      amount
    )
    : value;

  _smoothState.set(
    key,
    next
  );

  return next;
}

function smoothVector(
  key, value, amount
) {
  if ( !( amount > 0 ) ) {
    _smoothState.set(
      key,
      value
    );

    return value;
  }

  const prev = _smoothState.get( key );
  const next = prev && typeof prev === "object"
    ? {
      x: lerp(
        value.x,
        prev.x,
        amount
      ),
      y: lerp(
        value.y,
        prev.y,
        amount
      )
    }
    : value;

  _smoothState.set(
    key,
    next
  );

  return next;
}

// ── Path writer ─────────────────────────────────────────────────────────────
// Writes `value` at a dotted path (e.g. "ring.radius") into `obj`, creating
// intermediate objects as needed.

export function setPath(
  obj, path, value
) {
  if ( !obj || !path ) {
    return;
  }

  const keys = String( path ).split( "." );
  let node = obj;

  for ( let i = 0; i < keys.length - 1; i++ ) {
    const key = keys[ i ];

    if ( !node[ key ] || typeof node[ key ] !== "object" ) {
      node[ key ] = {};
    }

    node = node[ key ];
  }

  node[ keys[ keys.length - 1 ] ] = value;
}

// Reads `value` at a dotted path; returns undefined when any segment is missing.
export function getPath(
  obj, path
) {
  if ( !obj || !path ) {
    return undefined;
  }

  let node = obj;

  for ( const key of String( path ).split( "." ) ) {
    if ( node == null || typeof node !== "object" ) {
      return undefined;
    }

    node = node[ key ];
  }

  return node;
}

// ── Per-binding value (pre-blend) ───────────────────────────────────────────
// The binding's absolute target value before layering: a number (continuous) or
// an {x,y} (vector2d), or null when an input source has no live channel yet.
// Smoothing is keyed by the binding's id so layered bindings on one target lag
// independently (falling back to the source/target signature for legacy data
// that predates ids).

function bindingValue(
  binding, channels, context
) {
  const generator = isGenerator( binding.source );
  const channel = channels[ binding.source ];

  if ( !generator && !channel ) {
    return null;
  }

  return ( binding.kind ?? "continuous" ) === "vector2d"
    ? mapVector(
      channel,
      binding
    )
    : mapContinuous(
      channel,
      binding,
      context
    );
}

function smoothBindingValue(
  binding, value, kind
) {
  const key = binding.id ?? bindingKey( binding );
  const amount = num(
    binding.smoothing,
    0
  );

  return kind === "vector2d"
    ? smoothVector(
      key,
      value,
      amount
    )
    : smoothNumber(
      key,
      value,
      amount
    );
}

// ── Single-binding application ──────────────────────────────────────────────
// Overwrites the target with this one binding's value. Retained for callers
// that drive a single binding; the layered resolver uses `foldTarget` instead.

export function applyBinding(
  targetObj, binding, channels, context
) {
  if (
    !binding ||
    binding.enabled === false ||
    !binding.target ||
    !binding.source
  ) {
    return;
  }

  const raw = bindingValue(
    binding,
    channels,
    context
  );

  if ( raw === null ) {
    return;
  }

  const kind = binding.kind ?? "continuous";

  setPath(
    targetObj,
    binding.target,
    smoothBindingValue(
      binding,
      raw,
      kind
    )
  );
}

// ── Layering ─────────────────────────────────────────────────────────────────
// Multiple bindings can drive ONE parameter. They are folded in array order
// (later = on top) into an accumulator seeded from the parameter's base value.
// Each layer combines via its `blend` mode (default "replace") and `weight`
// (0..1 opacity / dry-wet): the blended result is crossfaded against the running
// accumulator by the weight, so `replace` at weight 1 fully overrides — exactly
// the pre-layering behavior for a lone binding.

const BLEND_MODES = new Set( [
  "replace",
  "add",
  "multiply",
  "max",
  "min",
  "average"
] );

export function isBlendMode( mode ) {
  return BLEND_MODES.has( mode );
}

function blendAxis(
  prev, layer, mode, weight
) {
  let blended;

  switch ( mode ) {
    case "add":
      blended = prev + layer;
      break;
    case "multiply":
      blended = prev * layer;
      break;
    case "max":
      blended = Math.max(
        prev,
        layer
      );
      break;
    case "min":
      blended = Math.min(
        prev,
        layer
      );
      break;
    case "average":
      blended = ( prev + layer ) / 2;
      break;
    case "replace":
    default:
      blended = layer;
      break;
  }

  return lerp(
    prev,
    blended,
    weight
  );
}

// Fold one target's layers over its base value. Returns the base value untouched
// when no layer produced a value (e.g. all input channels missing).
function foldTarget(
  baseValue, layers, channels, context
) {
  let acc = baseValue;
  let started = false;

  for ( const binding of layers ) {
    const raw = bindingValue(
      binding,
      channels,
      context
    );

    if ( raw === null ) {
      continue;
    }

    const kind = binding.kind ?? "continuous";
    const value = smoothBindingValue(
      binding,
      raw,
      kind
    );
    const weight = clamp01( num(
      binding.weight,
      1
    ) );
    const mode = binding.blend ?? "replace";

    if ( kind === "vector2d" ) {
      const prev = started && acc && typeof acc === "object"
        ? acc
        : ( baseValue && typeof baseValue === "object"
          ? baseValue
          : {
            x: 0,
            y: 0
          } );

      acc = {
        x: blendAxis(
          num(
            prev.x,
            0
          ),
          num(
            value.x,
            0
          ),
          mode,
          weight
        ),
        y: blendAxis(
          num(
            prev.y,
            0
          ),
          num(
            value.y,
            0
          ),
          mode,
          weight
        )
      };
    } else {
      acc = blendAxis(
        started ? num(
          acc,
          0
        ) : num(
          baseValue,
          0
        ),
        num(
          value,
          0
        ),
        mode,
        weight
      );
    }

    started = true;
  }

  return started ? acc : baseValue;
}

// The bindings that actually play, honoring the mixer's enable + solo state:
// disabled (enabled === false / muted) drop out; if ANY binding is soloed,
// only soloed bindings remain.
export function selectActiveBindings( list ) {
  const enabled = ( Array.isArray( list ) ? list : [] ).filter( ( b ) => b && b.enabled !== false );
  const soloed = enabled.filter( ( b ) => b.solo );

  return soloed.length > 0 ? soloed : enabled;
}

// ── Top-level resolver ──────────────────────────────────────────────────────
// Returns a modulated CLONE of `base` (never mutates the store). When `base`
// has no active bindings it returns `base` unchanged — zero overhead for the
// vast majority of sketches that opt out.
//
// Memoized by frame so repeated `options.sketch` reads within one draw() share
// a single snapshot (and smoothing advances exactly once per frame).

let _resolveCache = {
  frame: -2,
  result: null
};

export function resolveBindings(
  base, channels, frame, context
) {
  const active = selectActiveBindings( base?.bindings );

  if ( active.length === 0 ) {
    return base;
  }

  const cacheable = typeof frame === "number" && frame >= 0;

  if ( cacheable && frame === _resolveCache.frame && _resolveCache.result ) {
    return _resolveCache.result;
  }

  let out;

  try {
    out = JSON.parse( JSON.stringify( base ) );
  } catch {
    return base;
  }

  const ch = channels ?? {};

  // Group the active bindings by target so multiple layers on one parameter are
  // folded together (in array order) rather than overwriting each other.
  const groups = new Map();

  for ( const binding of active ) {
    if ( !binding.target || !binding.source ) {
      continue;
    }

    if ( !groups.has( binding.target ) ) {
      groups.set(
        binding.target,
        []
      );
    }

    groups.get( binding.target ).push( binding );
  }

  for ( const [
    target,
    layers
  ] of groups ) {
    try {
      setPath(
        out,
        target,
        foldTarget(
          getPath(
            base,
            target
          ),
          layers,
          ch,
          context
        )
      );
    } catch {
      // A single malformed target must never break the whole sketch.
    }
  }

  if ( cacheable ) {
    _resolveCache = {
      frame,
      result: out
    };
  }

  return out;
}

// ── Per-binding meter signals ───────────────────────────────────────────────
// The normalized 0..1 "tension" of each active binding, keyed by target. The
// impure layer (options.js) publishes these to CSS vars each frame so the UI's
// VU meters reflect the resolved signal regardless of source type (input OR
// generator). Pure so it can be unit-tested.

function vectorMeter( channel ) {
  if ( !channel || channel.type !== "vector2d" ) {
    return 0;
  }

  const x = clamp01( num(
    channel.x,
    0.5
  ) );
  const y = clamp01( num(
    channel.y,
    0.5
  ) );

  return clamp01( Math.hypot(
    x - 0.5,
    y - 0.5
  ) / Math.SQRT1_2 );
}

export function computeBindingSignals(
  base, channels, context
) {
  const out = {};
  const list = Array.isArray( base?.bindings ) ? base.bindings : [];
  const ch = channels ?? {};
  // The bindings that actually play — only their signals contribute to a
  // target's aggregate meter (the field pastille). Per-binding meters (the
  // matrix rows) are emitted for every binding so a soloed-out / disabled layer
  // still shows what it would do.
  const active = new Set( selectActiveBindings( list ) );
  const targetMax = {};

  for ( const binding of list ) {
    if ( !binding || !binding.target || !binding.source ) {
      continue;
    }

    let signal;

    try {
      signal = ( binding.kind ?? "continuous" ) === "vector2d"
        ? vectorMeter( ch[ binding.source ] )
        : clamp01( shapedScalar(
          binding,
          ch[ binding.source ],
          context
        ) );
    } catch {
      // Skip a malformed binding's meter.
      continue;
    }

    // Per-binding signal, keyed by id (ids are uuids — no collision with the
    // dotted target paths used for the aggregate keys below).
    if ( binding.id ) {
      out[ binding.id ] = signal;
    }

    if ( active.has( binding ) ) {
      targetMax[ binding.target ] = Math.max(
        targetMax[ binding.target ] ?? 0,
        signal
      );
    }
  }

  return Object.assign(
    out,
    targetMax
  );
}
