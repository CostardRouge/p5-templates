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

// ── Mapping families ────────────────────────────────────────────────────────

// Continuous: project → invert → curve → range-map. Returns a single number.
export function mapContinuous(
  channel, binding
) {
  const mapping = binding.mapping ?? {};

  let s = projectChannel(
    channel,
    binding.project
  );

  if ( mapping.invert ) {
    s = 1 - s;
  }

  s = applyCurve(
    s,
    mapping.curve
  );

  return lerp(
    num(
      mapping.min,
      0
    ),
    num(
      mapping.max,
      1
    ),
    s
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

// ── Single-binding application ──────────────────────────────────────────────

export function applyBinding(
  targetObj, binding, channels
) {
  if (
    !binding ||
    binding.enabled === false ||
    !binding.target ||
    !binding.source
  ) {
    return;
  }

  const channel = channels[ binding.source ];

  if ( !channel ) {
    return;
  }

  const kind = binding.kind ?? "continuous";
  const key = bindingKey( binding );
  const amount = num(
    binding.smoothing,
    0
  );

  let value;

  if ( kind === "vector2d" ) {
    value = smoothVector(
      key,
      mapVector(
        channel,
        binding
      ),
      amount
    );
  } else {
    value = smoothNumber(
      key,
      mapContinuous(
        channel,
        binding
      ),
      amount
    );
  }

  setPath(
    targetObj,
    binding.target,
    value
  );
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
  base, channels, frame
) {
  const bindings = Array.isArray( base?.bindings )
    ? base.bindings.filter( ( b ) => b && b.enabled !== false )
    : [];

  if ( bindings.length === 0 ) {
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

  for ( const binding of bindings ) {
    try {
      applyBinding(
        out,
        binding,
        ch
      );
    } catch {
      // A single malformed binding must never break the whole sketch.
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
