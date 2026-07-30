import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  BRAID_CAMERA_MAIN_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov,
  lipschitzDivisor
} from "@/p5/utils/braidShader.js";
import {
  setSketchOptions
} from "@/p5/shared/syncSketchOptions.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  createDraggable
} from "@/p5/utils/interaction/draggable.js";
import {
  createPinchTracker
} from "@/p5/utils/interaction/handPinch.js";
import {
  drawInteractionCameraPreview
} from "@/p5/utils/interaction/overlay.js";
import {
  renderSplines
} from "../../splines/_shared.js";

// ─────────────────────────────────────────────────────────────────────────────
// braid v6 — interactive ring.
//
// The Turk's-head weave of v5, but the ring it is woven around is no longer a
// perfect circle: its centerline is a periodic spline through DRAGGABLE control
// points, so the braid becomes a hand-mouldable loop — splines-v2-draggable's
// interaction contract applied to the family's raymarched rope.
//
// ── Deformable geometry (polar ring profile) ─────────────────────────────────
// The centerline stays in the z = 0 plane, described in polar form R(θ): each
// control point contributes its (angle, radius) about the canvas centre, and
// the shader interpolates a periodic non-uniform Catmull-Rom (Hermite with
// finite-difference tangents) through the sorted samples. Single-valued R(θ)
// means the loop can bulge and dent but never self-intersect, and the SDF stays
// the family's cheap cross-section form: at toroidal angle u the tube centre
// sits at radius R(u), and v5's two counter-helix families weave around it
// unchanged (over-under by ±depth·cos(N·leads·u), clearance floors enforced on
// the CPU). Bending space is even less isometric than v5's — dR/dθ joins the
// weave drift in the CPU Lipschitz divisor, same recipe as v1/v2/v4/v5.
//
// ── Screen ↔ world alignment ─────────────────────────────────────────────────
// The camera is locked face-on (pitch = yaw = roll = 0) so the z = 0 plane
// projects to the canvas through one scale factor k = focal/distance · height.
// Control points live NORMALIZED in options (like splines-v2: resize-proof,
// saved/exported with the template), are dragged in canvas pixels, and map
// through k to the exact world radii the shader marches — so a marker always
// sits ON the tube it deforms.
//
// ── Interactivity (and where the "virtual hands" plug in) ────────────────────
// Mouse and touch drag through the shared draggable layer. Camera hands go
// through the shared pinch tracker (utils/interaction/handPinch.js): every
// tracked hand's thumb+index pinch is an independent pointer, so several hands
// can each drag their own control point at once (raise Vision → Hands → Max
// hands). Detected hands are also drawn with the usual hand-capture visuals —
// a glowing spline through the fingertips — plus the per-hand pinch markers.
//
// Everything hand-related is consumed through collectHandGroups() below, the
// single seam for the planned pre-recorded "virtual hands": replayed clips
// shaped like live hand groups ({ id, points }) will render, pinch and drag
// through the exact same path — mixed freely with real hands.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// R(θ) is static within a frame (only user edits move it), integer `leads`
// closes every strand, and the poloidal spin and hue scroll snap to whole
// turns per loop — capture stays seamless.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CTRL = 12; // control points (uniform array size)
const MAX_PER_FAMILY = 8; // strands per family (the "strands" slider max)
const MAX_STEPS = 192; // sphere-trace iterations (deformed field marches slower)

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Deformable ring ──
  uniform float uCtrlAngle[${ MAX_CTRL }];  // sorted ascending in [0, TAU)
  uniform float uCtrlRadius[${ MAX_CTRL }]; // world radii at those angles
  uniform float uCtrlCount;
  uniform float uMinorR;    // lay radius on the tube (CPU-floored: clearance)
  uniform float uWireR;     // strand thickness
  uniform float uWeaveDepth;// radial over-under (CPU-floored: clearance)
  uniform float uStrands;   // strands per family
  uniform float uLeads;     // poloidal wraps per toroidal turn (integer: closes)
  uniform float uWeaveN;    // = strands·leads (over-under alternation rate)
  uniform float uSpin;      // poloidal roll over time (whole turns/loop)
  uniform float uLipschitz; // CPU safety divisor for the bent-space march
  uniform float uReach;     // tube half-extent around the centerline
  uniform float uBandLow;   // enclosing cylinder band (CPU, overshoot-padded)
  uniform float uBandHigh;

  ${ IRIDESCENT_GLSL }

  // Periodic Catmull-Rom radius profile through the control points. Hermite on
  // the segment that contains u, with finite-difference tangents over the
  // non-uniform angles; array access sticks to loop indices (compared against
  // the computed neighbour slots) to stay within GLSL ES 1.0 indexing rules.
  float ringRadiusAt(float u) {
    int count = int(uCtrlCount + 0.5);

    if (count < 3) { return uCtrlRadius[0]; }

    // Wrap u into [first, first + TAU) — every control angle is in [0, TAU).
    float first = uCtrlAngle[0];
    float uu = mod(u - first, TAU) + first;

    // The segment [i0, i0+1] containing uu (i0 = count-1 wraps to 0).
    int i0 = 0;

    for (int i = 1; i < ${ MAX_CTRL }; i++) {
      if (i >= count) { break; }
      if (uCtrlAngle[i] <= uu) { i0 = i; }
    }

    int iA = i0 - 1 < 0 ? count - 1 : i0 - 1;
    int iC = i0 + 1 >= count ? 0 : i0 + 1;
    int iD = iC + 1 >= count ? 0 : iC + 1;

    float aA = 0.0; float aB = 0.0; float aC = 0.0; float aD = 0.0;
    float rA = 0.0; float rB = 0.0; float rC = 0.0; float rD = 0.0;

    for (int i = 0; i < ${ MAX_CTRL }; i++) {
      if (i >= count) { break; }

      float a = uCtrlAngle[i];
      float r = uCtrlRadius[i];

      if (i == iA) { aA = a; rA = r; }
      if (i == i0) { aB = a; rB = r; }
      if (i == iC) { aC = a; rC = r; }
      if (i == iD) { aD = a; rD = r; }
    }

    // Unwrap the neighbours so aA < aB <= uu < aC <= aD.
    if (i0 == 0) { aA -= TAU; }
    if (i0 == count - 1) { aC += TAU; }
    if (i0 >= count - 2) { aD += TAU; }

    float span = max(aC - aB, 1e-3);
    float t = clamp((uu - aB) / span, 0.0, 1.0);

    // Finite-difference tangents, rescaled to the segment parameter.
    float mB = (rC - rA) / max(aC - aA, 1e-3) * span;
    float mC = (rD - rB) / max(aD - aB, 1e-3) * span;

    float t2 = t * t;
    float t3 = t2 * t;

    return (2.0 * t3 - 3.0 * t2 + 1.0) * rB
      + (t3 - 2.0 * t2 + t) * mB
      + (-2.0 * t3 + 3.0 * t2) * rC
      + (t3 - t2) * mC;
  }

  // One family's nearest-strand distance in the tube cross-section. dir = +1
  // ascending, −1 descending; the ±depth offset threads the over-under.
  float familyDist(vec2 cs, float u, float dir, out float ident) {
    float base = dir * uLeads * u + uSpin * uT;
    float r = uMinorR + dir * uWeaveDepth * cos(uWeaveN * u);
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PER_FAMILY }; k++) {
      if (float(k) >= uStrands) { break; }

      float th = base + TAU * float(k) / uStrands;
      vec2  c = r * vec2(cos(th), sin(th));
      float d = length(cs - c);

      if (d < best) { best = d; bestK = float(k); }
    }

    ident = bestK;

    return best - uWireR;
  }

  // The face-on camera aims straight down the ring axis, so rays DO cross the
  // p.xy origin where atan(0, 0) is undefined — guard it (the distance there
  // is ~R either way, only the angle needs to be finite).
  float toroidalAngle(vec3 p) {
    return length(p.xy) > 1e-5 ? atan(p.y, p.x) : 0.0;
  }

  float mapScene(vec3 p) {
    float u = toroidalAngle(p);
    float rho = length(p.xy);
    vec2  cs = vec2(rho - ringRadiusAt(u), p.z);
    float ia;
    float ib;
    float da = familyDist(cs, u, 1.0, ia);
    float db = familyDist(cs, u, -1.0, ib);
    float d = min(da, db) / uLipschitz;

    // Cheap TRUE lower bounds keep the march fast where the Lipschitz divisor
    // is needlessly brutal: every surface point lives inside the cylinder band
    // [uBandLow, uBandHigh] intersected with the slab |z| <= uReach, so the
    // distance to that enclosure (projections are 1-Lipschitz) never
    // overshoots. Face-on rays cross the empty half-space in a couple of
    // steps instead of crawling, and a deep drag toward the hole only slows
    // rays actually near the tube.
    d = max(d, uBandLow - rho);
    d = max(d, rho - uBandHigh);
    d = max(d, abs(p.z) - uReach);

    return d;
  }

  // Strand identity for the palette: family A uses 0..3, family B 4..7.
  float nearestPipe(vec3 p) {
    float u = toroidalAngle(p);
    vec2  cs = vec2(length(p.xy) - ringRadiusAt(u), p.z);
    float ia;
    float ib;
    float da = familyDist(cs, u, 1.0, ia);
    float db = familyDist(cs, u, -1.0, ib);

    return da < db ? mod(ia, 4.0) : mod(ib, 4.0) + 4.0;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const ringRenderer = createNoiseFieldRenderer( FRAGMENT );

const state = {
  // Working copy of the control points, normalized [0..1] canvas space.
  points: [],
  // `${count}|${seed}` signature: a change means "regenerate the layout".
  signature: null,
  // JSON of the items we last took from / wrote to the store, so we can tell an
  // external edit (form, reload) apart from our own drag write.
  syncHash: null
};

// Shared grab → move → release drag layer (mouse + touch built in, camera
// pinch pointers fed per frame) + the multi-hand pinch tracker feeding it.
const draggable = createDraggable();
const pinch = createPinchTracker();

function clamp(
  value, min, max
) {
  return Math.min(
    max,
    Math.max(
      min,
      value
    )
  );
}

function clamp01( value ) {
  return clamp(
    value,
    0,
    1
  );
}

function isPoint( value ) {
  return !!value && typeof value.x === "number" && typeof value.y === "number";
}

// ── Screen ↔ world projection (face-on camera) ──────────────────────────────
// A world point (X, Y, 0) projects to canvas px = w/2 + X·k, py = h/2 − Y·k
// with k = focal/distance · height (the braid camera puts world +y up on
// screen). Exact and invertible, so markers, pointers and the SDF agree.

function projectionScale(
  p, camera
) {
  return focalFromFov( camera.fov ?? 50 ) / ( camera.distance ?? 11.5 ) * p.height;
}

function canvasToWorld(
  p, point, k
) {
  return {
    x: ( point.x - p.width / 2 ) / k,
    y: ( p.height / 2 - point.y ) / k
  };
}

function worldToCanvas(
  p, point, k
) {
  return {
    x: p.width / 2 + point.x * k,
    y: p.height / 2 - point.y * k
  };
}

// Clearance-floored weave parameters (v5's recipe), shared by the shader
// uniforms, the radius clamps and the Lipschitz estimate.
function resolveWeave( weave ) {
  const strands = clamp(
    Math.round( weave.strands ?? 3 ),
    1,
    MAX_PER_FAMILY
  );
  const leads = Math.round( weave.leads ?? 5 );
  const wireR = weave.wireRadius ?? 0.09;

  // Over-under clearance: crossings are separated by 2·depth.
  const weaveDepth = Math.max(
    weave.depth ?? 0.14,
    1.15 * wireR
  );

  // Lay clearance: N strands per family are 2π/N apart on the lay circle, and
  // the lay radius must also clear the weave offset + gauge from the tube axis.
  const minorFloor = strands >= 2
    ? ( 1.15 * wireR ) / Math.sin( Math.PI / strands )
    : 0;
  const minorR = Math.max(
    weave.minorRadius ?? 0.45,
    Math.max(
      minorFloor,
      weaveDepth + wireR + 0.02
    )
  );

  return {
    strands,
    leads,
    wireR,
    weaveDepth,
    minorR,
    weaveN: strands * leads,
    // Full radial extent of the tube around its centerline.
    reach: minorR + weaveDepth + wireR
  };
}

// World-radius bounds for a control point: keep the ring's hole open and keep
// the tube inside the canvas.
function radiusBounds(
  p, k, weave
) {
  return {
    min: weave.reach * 1.35,
    max: Math.max(
      Math.min(
        p.width,
        p.height
      ) / ( 2 * k ) - weave.reach * 1.2,
      weave.reach * 1.5
    )
  };
}

// A pixel point clamped into the playable radial band. Applied to every
// control point before it becomes a target/marker/profile sample, so what the
// user sees and grabs is exactly what the shader marches — stored values that
// land outside the band (e.g. the square-canvas defaults on a tall canvas)
// are pulled onto the tube instead of floating beside it.
function clampToBand(
  p, point, k, bounds
) {
  const world = canvasToWorld(
    p,
    point,
    k
  );
  const radius = Math.hypot(
    world.x,
    world.y
  );

  if ( radius >= bounds.min && radius <= bounds.max ) {
    return point;
  }

  const angle = Math.atan2(
    world.y,
    world.x
  );
  const clamped = clamp(
    radius,
    bounds.min,
    bounds.max
  );

  return worldToCanvas(
    p,
    {
      x: Math.cos( angle ) * clamped,
      y: Math.sin( angle ) * clamped
    },
    k
  );
}

// Seeded default layout: evenly spaced angles, jittered radius — a wobbly ring.
function generatePoints(
  count, seed
) {
  const p = getP5();

  p.randomSeed( seed | 0 );

  const base = 0.3 * Math.min(
    p.width,
    p.height
  );
  const items = [];

  for ( let i = 0; i < count; i++ ) {
    const angle = i / count * p.TAU - p.HALF_PI;
    const radius = base * p.random(
      0.85,
      1.15
    );

    items.push( {
      x: clamp01( ( p.width / 2 + Math.cos( angle ) * radius ) / p.width ),
      y: clamp01( ( p.height / 2 + Math.sin( angle ) * radius ) / p.height )
    } );
  }

  return items;
}

// Adopt a list coming from the store (form edit / reload / our own write) as
// the working copy, without writing back.
function adoptPoints( items ) {
  state.points = items.map( ( n ) => ( {
    x: n.x,
    y: n.y
  } ) );
  state.syncHash = JSON.stringify( items );
}

// Persist the working copy into the saved options so it survives reloads and
// is exported with the template. Origin "p5" so the options module skips its
// own change handler (no feedback loop) while React still picks the values up.
function persistPoints() {
  const items = state.points.map( ( n ) => ( {
    x: n.x,
    y: n.y
  } ) );

  state.syncHash = JSON.stringify( items );

  // deepMerge preserves the sibling keys (count, seed), so only items is sent.
  setSketchOptions(
    {
      sketch: {
        points: {
          items
        }
      }
    },
    "p5"
  );
}

function regeneratePoints(
  count, seed
) {
  const items = generatePoints(
    count,
    seed
  );

  adoptPoints( items );
  persistPoints();
}

// Reconcile the working copy with the stored options each frame (skipped while
// a drag is in flight so a grabbed point isn't snapped back to a stale value).
function syncPoints( cfg ) {
  const count = clamp(
    Math.round( cfg.count ?? 8 ),
    3,
    MAX_CTRL
  );
  const seed = cfg.seed ?? 7;
  const signature = `${ count }|${ seed }`;
  const items = Array.isArray( cfg.items ) ? cfg.items : [];
  const valid = items.length === count && items.every( isPoint );

  if ( state.signature === null ) {
    if ( valid ) {
      adoptPoints( items );
    } else {
      regeneratePoints(
        count,
        seed
      );
    }

    state.signature = signature;

    return;
  }

  if ( signature !== state.signature ) {
    regeneratePoints(
      count,
      seed
    );
    state.signature = signature;

    return;
  }

  if ( !valid ) {
    regeneratePoints(
      count,
      seed
    );

    return;
  }

  if ( JSON.stringify( items ) !== state.syncHash ) {
    adoptPoints( items );
  }
}

// ── Ring profile: control points → sorted polar samples + march safety ──────
// Converts the pixel-space markers into the shader's (angle, radius) arrays:
// polar about the world origin, radius clamped to the playable band, sorted by
// angle with a minimum gap so the Hermite tangents stay finite. Also bounds
// |dR/dθ| for the Lipschitz divisor (finite-difference tangents are bounded by
// the neighbouring chord slopes; ×2 covers the Hermite overshoot).
function ringProfile(
  p, pointsPx, k, bounds
) {
  const MIN_GAP = 0.02;
  const entries = pointsPx.map( ( pt ) => {
    const world = canvasToWorld(
      p,
      pt,
      k
    );
    const angle = Math.atan2(
      world.y,
      world.x
    );

    return {
      angle: angle < 0 ? angle + p.TAU : angle,
      radius: clamp(
        Math.hypot(
          world.x,
          world.y
        ),
        bounds.min,
        bounds.max
      )
    };
  } ).sort( (
    a, b
  ) => a.angle - b.angle );

  for ( let i = 1; i < entries.length; i++ ) {
    if ( entries[ i ].angle < entries[ i - 1 ].angle + MIN_GAP ) {
      entries[ i ].angle = entries[ i - 1 ].angle + MIN_GAP;
    }
  }

  const angles = [];
  const radii = [];
  let minRadius = Infinity;
  let maxRadius = 0;
  let maxSlope = 0;

  entries.forEach( (
    entry, i
  ) => {
    const next = entries[ ( i + 1 ) % entries.length ];
    const gap = i === entries.length - 1
      ? Math.max(
        next.angle + p.TAU - entry.angle,
        MIN_GAP
      )
      : Math.max(
        next.angle - entry.angle,
        MIN_GAP
      );

    maxSlope = Math.max(
      maxSlope,
      Math.abs( next.radius - entry.radius ) / gap
    );
    minRadius = Math.min(
      minRadius,
      entry.radius
    );
    maxRadius = Math.max(
      maxRadius,
      entry.radius
    );
    angles.push( entry.angle );
    radii.push( entry.radius );
  } );

  // Pad the uniform arrays to their GLSL size (the shader breaks at count).
  while ( angles.length < MAX_CTRL ) {
    angles.push( angles[ angles.length - 1 ] ?? 0 );
    radii.push( radii[ radii.length - 1 ] ?? 1 );
  }

  return {
    angles,
    radii,
    count: entries.length,
    minRadius,
    maxRadius,
    maxSlope: maxSlope * 2
  };
}

// ── The virtual-hands seam ──────────────────────────────────────────────────
// Every hand consumer below (pinch pointers, glowing ribbons) reads through
// this single collector. Today it returns the live camera hands; the planned
// pre-recorded "virtual hands" — clips of captured pinch/move gestures
// replayed as the same { id, points } group shape, up to a small crowd of them
// reaching in from the canvas edges — will simply be concatenated here and
// inherit rendering, pinching and dragging for free.
function collectHandGroups( groups ) {
  return groups.filter( ( group ) => group.source === "hands" );
}

// The usual hand-capture look for every detected hand: one glowing spline
// through the fingertips (batched in a single GPU pass by renderSplines).
function drawHandRibbons(
  handGroups, cfg
) {
  if ( cfg?.show === false ) {
    return;
  }

  const lists = handGroups
    .map( ( group ) => group.points )
    .filter( ( points ) => points.length >= 2 );

  if ( lists.length === 0 ) {
    return;
  }

  renderSplines(
    lists,
    {
      curve: {
        method: "chaikin",
        closed: false,
        iterations: cfg?.iterations ?? 5
      },
      stroke: {
        weight: cfg?.weight ?? 14,
        glow: cfg?.glow ?? 2,
        hueSpeed: cfg?.hueSpeed ?? 1.5,
        hueSpread: cfg?.hueSpread ?? 2,
        gradient: true
      },
      overlay: {
        polygon: {
          show: false
        },
        points: {
          show: false
        }
      }
    }
  );
}

// Control-point markers (dot + core) with the splines-v2 hover/grab accents.
function drawControlPoints(
  p, pointsPx, hovers, grabbed, overlay
) {
  const cfg = overlay?.points ?? {};

  if ( cfg.show === false ) {
    return;
  }

  const size = cfg.size ?? 18;
  const coreRatio = cfg.coreRatio ?? 0.5;
  const color = cfg.color ?? [
    255,
    255,
    255,
    255
  ];
  const coreColor = cfg.coreColor ?? [
    10,
    10,
    14,
    255
  ];

  p.push();
  p.noStroke();

  pointsPx.forEach( ( pt ) => {
    p.fill( ...color );
    p.circle(
      pt.x,
      pt.y,
      size
    );
    p.fill( ...coreColor );
    p.circle(
      pt.x,
      pt.y,
      size * coreRatio
    );
  } );

  p.noFill();

  hovers.forEach( ( index ) => {
    if ( grabbed.has( index ) ) {
      return;
    }

    p.stroke(
      255,
      255,
      255,
      170
    );
    p.strokeWeight( 2 );
    p.circle(
      pointsPx[ index ].x,
      pointsPx[ index ].y,
      size * 1.8 + 10
    );
  } );

  grabbed.forEach( ( index ) => {
    p.stroke(
      120,
      200,
      255,
      230
    );
    p.strokeWeight( 3 );
    p.circle(
      pointsPx[ index ].x,
      pointsPx[ index ].y,
      size * 2.1 + 12
    );
  } );

  p.pop();
}

sketch.setup( async() => {
  state.points = [];
  state.signature = null;
  state.syncHash = null;

  // Re-arm the drag layer's listeners (the engine's event registry is cleared
  // on reset) and forget any hands from a previous run.
  draggable.attach();
  pinch.clear();

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const cfg = o.points ?? {};
  const interaction = o.interaction ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};
  const rendering = o.rendering ?? {};
  const grabRadius = o.grab?.radius ?? 44;

  // Re-sync from the store only when nothing is being dragged, so a live drag
  // is never snapped back to a stale value.
  if ( !draggable.dragging ) {
    syncPoints( cfg );
  }

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const weave = resolveWeave( o.weave ?? {} );
  const k = projectionScale(
    p,
    camera
  );
  const bounds = radiusBounds(
    p,
    k,
    weave
  );

  const pointsPx = state.points.map( ( n ) => {
    const px = clampToBand(
      p,
      {
        x: n.x * p.width,
        y: n.y * p.height
      },
      k,
      bounds
    );

    return p.createVector(
      px.x,
      px.y
    );
  } );

  // One groups fetch per frame, shared by the drag layer (mouse + touch), the
  // pinch tracker and the hand visuals.
  const groups = getPointerGroups( interaction );
  const handGroups = collectHandGroups( groups );
  const camPointers = pinch.update(
    handGroups,
    {
      pinch: o.grab?.pinch ?? 70,
      smoothing: o.grab?.cameraSmoothing ?? 0.4
    }
  );

  const {
    hovers,
    grabbed,
    released
  } = draggable.update( {
    targets: pointsPx,
    radius: grabRadius,
    groups,
    extraPointers: camPointers,
    onMove: (
      index, pointer
    ) => {
      // Clamp the drag in polar space (hole stays open, tube stays on canvas)
      // so the marker never detaches from the surface it deforms.
      const world = canvasToWorld(
        p,
        pointer,
        k
      );
      const angle = Math.atan2(
        world.y,
        world.x
      );
      const radius = clamp(
        Math.hypot(
          world.x,
          world.y
        ),
        bounds.min,
        bounds.max
      );
      const px = worldToCanvas(
        p,
        {
          x: Math.cos( angle ) * radius,
          y: Math.sin( angle ) * radius
        },
        k
      );
      const moved = {
        x: clamp01( px.x / p.width ),
        y: clamp01( px.y / p.height )
      };

      state.points[ index ] = moved;
      pointsPx[ index ] = p.createVector(
        moved.x * p.width,
        moved.y * p.height
      );
    }
  } );

  if ( released ) {
    persistPoints();
  }

  if ( pointsPx.length >= 3 ) {
    const profile = ringProfile(
      p,
      pointsPx,
      k,
      bounds
    );

    const timeScale = o.timeScale ?? 1;
    const t = animation.angle;
    const spinTurns = Math.round( ( o.weave?.spin ?? 1 ) * timeScale );

    const hueSpread = colors.hueSpread ?? 3.16;
    const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * timeScale * p.TAU * hueSpread );

    // Bent-space Lipschitz: the tube centre drifts with the toroidal angle via
    // the lay winding, the radial weave AND now the ring deformation dR/dθ,
    // over an arc length ≈ (R_min − reach).
    const centreSlope = ( weave.minorR * weave.leads
      + weave.weaveDepth * weave.weaveN
      + profile.maxSlope )
      / Math.max(
        profile.minRadius - weave.reach,
        0.1
      );
    const lipschitz = lipschitzDivisor( centreSlope );

    // Enclosing cylinder band for the shader's fast lower bounds, padded for
    // the Hermite overshoot beyond the sampled radii.
    const bandPad = 0.2 * ( profile.maxRadius - profile.minRadius ) + 0.05;
    const bandLow = Math.max(
      profile.minRadius - weave.reach - bandPad,
      0
    );
    const bandHigh = profile.maxRadius + weave.reach + bandPad;

    const camDist = camera.distance ?? 11.5;
    const lightDir = lightDirFrom(
      light.azimuth ?? -1.1,
      light.elevation ?? 0.5
    );

    ringRenderer.render( {
      columns: 1,
      rows: 1,
      resolutionScale: rendering.resolutionScale ?? 0.6,
      uniforms: {
        uT: t,
        uCtrlAngle: {
          floatv: profile.angles
        },
        uCtrlRadius: {
          floatv: profile.radii
        },
        uCtrlCount: profile.count,
        uMinorR: weave.minorR,
        uWireR: weave.wireR,
        uWeaveDepth: weave.weaveDepth,
        uStrands: weave.strands,
        uLeads: weave.leads,
        uWeaveN: weave.weaveN,
        uSpin: spinTurns,
        uLipschitz: lipschitz,
        uReach: weave.reach + 0.02,
        uBandLow: bandLow,
        uBandHigh: bandHigh,
        uCamDist: camDist,
        uFocal: focalFromFov( camera.fov ?? 50 ),
        // Face-on lock: the screen ↔ world projection above is only exact
        // with the camera on the ring's axis.
        uPitch: 0,
        uYaw: 0,
        uRoll: 0,
        uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
        uHueSpread: hueSpread,
        uHuePhase: colors.huePhase ?? 2.6,
        uLengthHueShift: colors.lengthHueShift ?? 0.35,
        uPipeHueShift: colors.pipeHueShift ?? 0.5,
        uShimmer: colors.shimmer ?? 2,
        uSaturation: colors.saturation ?? 0.75,
        uBrightness: colors.brightness ?? 1.3,
        uLightDir: lightDir,
        uAmbient: light.ambient ?? 0.3,
        uDiffuse: light.diffuse ?? 0.85,
        uSpecular: light.specular ?? 1.2,
        uSpecPower: light.specPower ?? 48,
        uFresnelPower: light.fresnelPower ?? 3,
        uRimStrength: light.rimStrength ?? 0.7,
        uShadowSoft: light.shadowSoftness ?? 22,
        uFogDensity: camera.fogDensity ?? 0.08,
        uFogStart: camDist,
        uMaxDist: camDist + 12,
        uAberration: aberration.amount ?? 0,
        uAberrationMode: {
          int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
        }
      }
    } );
  }

  drawControlPoints(
    p,
    pointsPx,
    hovers,
    grabbed,
    o.overlay
  );

  // Hands (usual glowing ribbons), per-hand pinch markers and the optional
  // webcam preview, drawn last so they stack on top of the braid. All no-op
  // unless Vision is on / a hand is seen.
  drawHandRibbons(
    handGroups,
    o.hands
  );
  pinch.draw();
  drawInteractionCameraPreview( interaction );
} );
