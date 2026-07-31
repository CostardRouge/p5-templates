import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import string from "@/p5/utils/string.js";
import {
  splitContours,
  resampleContour,
  distance
} from "@/p5/utils/letterPaths.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl,
  BRAID_CAMERA_MAIN_GLSL,
  lightDirFrom,
  focalFromFov
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
// rings v6 — letter sculpt.
//
// ONE glyph of v4's liquid tube material sits at the centre — but instead of
// melting on its own clock, it is SCULPTED by hand: every outline sample is a
// draggable handle, and braid-v6-interactive-ring's interaction contract
// (mouse + touch + camera-tracked hand pinches, several hands at once) is
// applied to the letter's own points. Pinch thumb + index on a handle and pull
// to stretch the stroke; the capsule field re-fuses around wherever the points
// go. No automatic morph — v6 deliberately keeps a single letter so the whole
// loop budget belongs to the sculptor. (Later versions may reintroduce
// letter-to-letter morphs driven by the same hands.)
//
// ── Geometry (glyph → sculpt handles) ────────────────────────────────────────
// textToPoints → splitContours → resampleContour, the family recipe — but where
// v4 forced a fixed slot layout for morph correspondence, v6 has no morph and
// simply spreads a "handles" budget over the glyph's contours proportionally to
// their perimeter (≥ 3 per ring). Each handle is a base point (glyph space,
// bbox-centred, y up) plus a persisted sculpt OFFSET — a full 3D displacement:
// the letter starts flat in the z = 0 plane and gains relief as handles are
// pushed and pulled. Offsets live in the saved options (signature-guarded:
// letter / font / detail / handle-count changes reset the sculpt) so a sculpted
// letter survives reloads and is exported with the template.
//
// ── Screen ↔ world (why sculpting stays exact off-axis) ──────────────────────
// braid-v6 locked its camera face-on to keep the drag mapping invertible. v6
// instead mirrors the shared braidShader orbit camera IN FULL on the CPU
// (same ro / right / up / fwd basis, same focal), so any world point projects
// to the exact pixel the shader shades it at — for ANY yaw / pitch. Dragging
// unprojects the pointer at the handle's current view depth (a move in the
// view-parallel plane through the point), so a marker never slides off the
// tube it deforms even while the camera sways.
//
// ── Depth sculpting (the z gesture) ──────────────────────────────────────────
// XY dragging is the usual thumb + INDEX pinch (or mouse / finger). Depth uses
// a second same-hand gesture: pinch thumb + MIDDLE finger (index kept clear —
// the tracker requires it extended, so the two pinches never fight) and move
// the hand vertically to push the grabbed point away / pull it toward the
// camera along world z. With the mouse, hold SHIFT while dragging for the same
// push/pull. Give the camera a bit of yaw/elevation (or sway) and the relief
// reads immediately; fog adds a depth cue on pushed points.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Geometry is static within a frame (only user edits move it). Camera sway
// snaps to whole cycles per loop, orbit to whole turns, and the hue scroll to
// whole palette periods — uT = TAU matches uT = 0, capture stays seamless.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_POINTS = 64; // sculpt handles = capsules (uniform array size)
const MAX_CONTOURS = 4; // outlines kept per glyph (longest first)
const MAX_STEPS = 96; // sphere-trace iterations per ray
const BUILD_SIZE = 100; // glyph sampling size; geometry normalised by it

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Sculpted letter field (glyph units, scaled to world by uScale) ──
  uniform int   uSegCount;              // capsules active this frame
  uniform vec4  uSegA[${ MAX_POINTS }]; // capsule start: xyz + arc identity in w
  uniform vec4  uSegB[${ MAX_POINTS }]; // capsule end: xyz
  uniform float uRad;                   // bounding radius (offsets included)
  uniform float uScale;                 // world size of one glyph unit
  uniform float uTubeR;                 // tube radius (world)
  uniform float uSmoothK;               // smooth-union fillet (world)

  ${ IRIDESCENT_GLSL }

  // Polynomial smooth-minimum (iq): melts nearby capsules into a rounded fillet.
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Distance to the 3D segment a→b (round-capped capsule axis). The letter is
  // no longer a flat extrusion — sculpted points leave the z = 0 plane, so the
  // capsules are genuinely 3D.
  float segDist3D(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h);
  }

  float mapScene(vec3 p) {
    float inv = 1.0 / max(uScale, 1e-4);
    float tubeRn = uTubeR * inv;
    float kn = max(uSmoothK * inv, 1e-4);
    vec3 q = p * inv;

    // Bounding sphere around the sculpt (recomputed on the CPU every frame) —
    // rays far from the letter skip the capsule loop entirely.
    float bound = length(q) - uRad - tubeRn - kn;

    if (bound > 0.3) { return bound * uScale; }

    float d = 1e9;

    for (int s = 0; s < ${ MAX_POINTS }; s++) {
      if (s >= uSegCount) { break; }

      d = smin(d, segDist3D(q, uSegA[s].xyz, uSegB[s].xyz), kn);
    }

    return (d - tubeRn) * uScale;
  }

  // Hue identity = the nearest capsule's arc position along the outline (0..1),
  // so uPipeHueShift drifts the palette around the letter's contours.
  float nearestPipe(vec3 p) {
    vec3 q = p / max(uScale, 1e-4);
    float best = 1e9;
    float ident = 0.0;

    for (int s = 0; s < ${ MAX_POINTS }; s++) {
      if (s >= uSegCount) { break; }

      float d = segDist3D(q, uSegA[s].xyz, uSegB[s].xyz);

      if (d < best) { best = d; ident = uSegA[s].w; }
    }

    return ident;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const sculptRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// ── Letter geometry (built once per letter/font/detail/handles, memoised) ────
const geometryMemo = new Map();
const GEOMETRY_MEMO_MAX = 8;

function perimeterOf( points ) {
  let total = 0;

  for ( let i = 0; i < points.length; i++ ) {
    total += distance(
      points[ i ],
      points[ ( i + 1 ) % points.length ]
    );
  }

  return total;
}

// Sample ONE glyph into up to MAX_CONTOURS closed rings of handles: the
// `handles` budget is spread proportionally to contour perimeter (≥ 3 per
// ring), each ring is resampled to constant arc spacing, and everything is
// normalised to glyph space (bbox centre at the origin, y up). `next` closes
// each ring (index → following index within the same contour) and `ids` is the
// 0..1 arc identity the shader uses for the outline hue drift.
function buildLetter( {
  letter,
  fontName,
  sampleFactor,
  simplifyThreshold,
  handles
} ) {
  const p = getP5();
  const font = string.fonts[ fontName ] ?? string.fonts.sans;

  if ( !font?.font || !letter ) {
    return null;
  }

  p.push();
  p.textFont( font );
  p.textSize( BUILD_SIZE );

  const raw = font.textToPoints(
    letter,
    0,
    0,
    BUILD_SIZE,
    {
      sampleFactor,
      simplifyThreshold
    }
  );

  p.pop();

  if ( !raw.length ) {
    return null;
  }

  const contours = splitContours(
    raw,
    0.2 * BUILD_SIZE
  )
    .filter( ( pts ) => pts.length >= 3 )
    .map( ( pts ) => ( {
      pts,
      perimeter: perimeterOf( pts )
    } ) )
    .sort( (
      a, b
    ) => b.perimeter - a.perimeter )
    .slice(
      0,
      MAX_CONTOURS
    );

  if ( !contours.length ) {
    return null;
  }

  const budget = clamp(
    Math.round( handles ),
    12,
    MAX_POINTS
  );
  const totalPerimeter = contours.reduce(
    (
      sum, contour
    ) => sum + contour.perimeter,
    0
  );
  const counts = contours.map( ( contour ) => Math.max(
    3,
    Math.round( budget * contour.perimeter / totalPerimeter )
  ) );

  // Trim the largest rings until the budget fits the uniform array (the ≥ 3
  // floors can push the proportional split past it).
  let sum = counts.reduce(
    (
      total, n
    ) => total + n,
    0
  );

  while ( sum > budget ) {
    const i = counts.indexOf( Math.max( ...counts ) );

    if ( counts[ i ] <= 3 ) {
      break;
    }

    counts[ i ]--;
    sum--;
  }

  const sampled = [];
  const next = [];

  contours.forEach( (
    contour, contourIndex
  ) => {
    // Spacing = perimeter / n yields exactly n ring samples (the closing
    // duplicate is dropped by the util).
    const samples = resampleContour(
      contour.pts,
      contour.perimeter / counts[ contourIndex ],
      true
    );
    const count = Math.min(
      samples.length,
      MAX_POINTS - sampled.length
    );

    if ( count < 3 ) {
      return;
    }

    const start = sampled.length;

    for ( let i = 0; i < count; i++ ) {
      sampled.push( samples[ i ] );
      next.push( start + ( i + 1 ) % count );
    }
  } );

  if ( sampled.length < 3 ) {
    return null;
  }

  // Glyph bbox centre — the anchor everything is normalised around.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for ( const pt of sampled ) {
    minX = Math.min(
      minX,
      pt.x
    );
    maxX = Math.max(
      maxX,
      pt.x
    );
    minY = Math.min(
      minY,
      pt.y
    );
    maxY = Math.max(
      maxY,
      pt.y
    );
  }

  const ctrX = ( minX + maxX ) / 2;
  const ctrY = ( minY + maxY ) / 2;

  const points = sampled.map( ( pt ) => ( {
    x: ( pt.x - ctrX ) / BUILD_SIZE,
    y: -( pt.y - ctrY ) / BUILD_SIZE
  } ) );
  const ids = points.map( (
    _, i
  ) => i / points.length );

  return {
    count: points.length,
    points,
    next,
    ids
  };
}

function getLetter( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;
  const fontFamily = font?.font?.names?.fontFamily?.en || "unknown";
  const key = [
    cfg.letter,
    fontFamily,
    cfg.sampleFactor,
    cfg.simplifyThreshold,
    cfg.handles
  ].join( "|" );

  const cached = geometryMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const built = buildLetter( cfg );

  // Font still loading → don't cache the null, retry next frame.
  if ( !built ) {
    return null;
  }

  const geometry = {
    key,
    ...built
  };

  geometryMemo.set(
    key,
    geometry
  );

  if ( geometryMemo.size > GEOMETRY_MEMO_MAX ) {
    geometryMemo.delete( geometryMemo.keys().next().value );
  }

  return geometry;
}

// ── Sculpt offsets: working copy ↔ saved options ─────────────────────────────
// Same contract as braid-v6's control points: the working copy is the truth
// while dragging, the options store is the truth otherwise (form edits,
// reloads, resets), and every release persists — so a sculpt survives reloads
// and is exported with the template. The signature ties offsets to the glyph
// build they belong to; any letter/font/detail/handles change resets the relief.
const state = {
  // Working copy: one { x, y, z } offset (glyph units) per handle.
  offsets: [],
  // Geometry key the offsets belong to.
  signature: null,
  // JSON of the items last exchanged with the store (detects external edits).
  syncHash: null
};

const draggable = createDraggable();
const pinch = createPinchTracker();

function isOffset( value ) {
  return !!value
    && typeof value.x === "number"
    && typeof value.y === "number"
    && typeof value.z === "number";
}

function adoptOffsets( items ) {
  state.offsets = items.map( ( n ) => ( {
    x: n.x,
    y: n.y,
    z: n.z
  } ) );
  state.syncHash = JSON.stringify( items );
}

function persistOffsets( signature ) {
  const items = state.offsets.map( ( n ) => ( {
    x: n.x,
    y: n.y,
    z: n.z
  } ) );

  state.syncHash = JSON.stringify( items );

  // deepMerge preserves the sibling keys (range, depthGain…); origin "p5" so
  // the options module skips its own change handler (no feedback loop).
  setSketchOptions(
    {
      sketch: {
        sculpt: {
          signature,
          offsets: items
        }
      }
    },
    "p5"
  );
}

function resetOffsets(
  count, signature
) {
  adoptOffsets( new Array( count )
    .fill( null )
    .map( () => ( {
      x: 0,
      y: 0,
      z: 0
    } ) ) );
  persistOffsets( signature );
}

// Reconcile the working copy with the stored options (skipped while a drag is
// in flight so a grabbed handle isn't snapped back to a stale value).
function syncOffsets(
  cfg, geometry
) {
  const items = Array.isArray( cfg.offsets ) ? cfg.offsets : [];
  const valid = cfg.signature === geometry.key
    && items.length === geometry.count
    && items.every( isOffset );

  if ( state.signature !== geometry.key ) {
    if ( valid ) {
      adoptOffsets( items );
    } else {
      resetOffsets(
        geometry.count,
        geometry.key
      );
    }

    state.signature = geometry.key;

    return;
  }

  if ( !valid ) {
    resetOffsets(
      geometry.count,
      geometry.key
    );

    return;
  }

  if ( JSON.stringify( items ) !== state.syncHash ) {
    adoptOffsets( items );
  }
}

// ── Camera rig: the shared braidShader orbit camera, mirrored on the CPU ─────
// Exact same basis construction as BRAID_CAMERA_MAIN_GLSL (uRoll stays 0), so
// projectPoint/unprojectPoint agree with the shader to the pixel for any
// yaw/pitch — that agreement is what lets the sculpt stay grabbable off-axis.

function vNormalize( v ) {
  const len = Math.hypot(
    v[ 0 ],
    v[ 1 ],
    v[ 2 ]
  ) || 1;

  return [
    v[ 0 ] / len,
    v[ 1 ] / len,
    v[ 2 ] / len
  ];
}

function vCross(
  a, b
) {
  return [
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
  ];
}

function vDot(
  a, b
) {
  return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
}

function cameraRig(
  camera, t, progress
) {
  const dist = Math.max(
    camera.distance ?? 6.5,
    0.5
  );
  const focal = focalFromFov( camera.fov ?? 60 );
  const orbitTurns = Math.round( camera.orbit ?? 0 ); // whole turns: loop-safe
  const yaw = ( camera.phase ?? 0 ) + progress * orbitTurns * 2 * Math.PI;
  const sway = camera.sway ?? 0;
  const swayCycles = Math.round( camera.swayCycles ?? 2 ); // whole cycles: loop-safe
  const pitch = clamp(
    ( camera.elevation ?? 0 ) + sway * Math.sin( swayCycles * t ),
    -1.4,
    1.4
  );

  const cp = Math.cos( pitch );
  const sp = Math.sin( pitch );
  const cy = Math.cos( yaw );
  const sy = Math.sin( yaw );

  const ro = [
    dist * cp * sy,
    dist * sp,
    -dist * cp * cy
  ];
  const fwd = vNormalize( [
    -ro[ 0 ],
    -ro[ 1 ],
    -ro[ 2 ]
  ] );
  const right = vNormalize( vCross(
    [
      0,
      1,
      0
    ],
    fwd
  ) );
  const up = vCross(
    fwd,
    right
  );

  return {
    ro,
    right,
    up,
    fwd,
    focal,
    dist,
    yaw,
    pitch
  };
}

// World point → canvas pixel (+ its view depth along fwd, needed to invert).
function projectPoint(
  p, rig, world
) {
  const v = [
    world[ 0 ] - rig.ro[ 0 ],
    world[ 1 ] - rig.ro[ 1 ],
    world[ 2 ] - rig.ro[ 2 ]
  ];
  const depth = Math.max(
    vDot(
      v,
      rig.fwd
    ),
    0.05
  );
  const x = vDot(
    v,
    rig.right
  );
  const y = vDot(
    v,
    rig.up
  );

  return {
    x: p.width / 2 + rig.focal * x / depth * p.height,
    y: p.height / 2 - rig.focal * y / depth * p.height,
    depth
  };
}

// Canvas pixel + view depth → world point (the inverse of projectPoint).
function unprojectPoint(
  p, rig, point, depth
) {
  const x = ( point.x - p.width / 2 ) / p.height * depth / rig.focal;
  const y = ( p.height / 2 - point.y ) / p.height * depth / rig.focal;

  return [
    rig.ro[ 0 ] + rig.right[ 0 ] * x + rig.up[ 0 ] * y + rig.fwd[ 0 ] * depth,
    rig.ro[ 1 ] + rig.right[ 1 ] * x + rig.up[ 1 ] * y + rig.fwd[ 1 ] * depth,
    rig.ro[ 2 ] + rig.right[ 2 ] * x + rig.up[ 2 ] * y + rig.fwd[ 2 ] * depth
  ];
}

// ── Depth pinch: thumb + MIDDLE finger = grab in z ──────────────────────────
// The XY layer's counterpart for the third axis. Same hand-group contract as
// the shared pinch tracker (trailing five points are the fingertips in
// MediaPipe order), same hysteresis latch — but it only ENGAGES while the
// index is clearly extended, so it can never fight the thumb+index XY pinch:
// closing all three fingers reads as an XY grab, thumb-to-middle with the
// index up reads as a depth grab.
function createDepthPinch() {
  const hands = new Map();
  const smooth = new Map();
  const latch = new Map();

  return {
    hands,

    update(
      groups, {
        pinch: pinchDist = 70,
        smoothing = 0.4,
        releaseRatio = 1.6,
        indexClearRatio = 1.25
      } = {}
    ) {
      const present = new Set( groups.map( ( group ) => group.id ) );

      for ( const id of [
        ...hands.keys()
      ] ) {
        if ( !present.has( id ) ) {
          hands.delete( id );
          smooth.delete( id );
          latch.delete( id );
        }
      }

      const lag = clamp(
        smoothing,
        0,
        0.95
      );
      const pointers = [];

      groups.forEach( ( group ) => {
        const points = group.points;

        if ( !points || points.length < 5 ) {
          return;
        }

        const thumb = points[ points.length - 5 ];
        const index = points[ points.length - 4 ];
        const middle = points[ points.length - 3 ];
        const gap = Math.hypot(
          thumb.x - middle.x,
          thumb.y - middle.y
        );
        const indexGap = Math.hypot(
          thumb.x - index.x,
          thumb.y - index.y
        );
        const engaged = latch.get( group.id )
          ? gap < pinchDist * releaseRatio
          : gap < pinchDist && indexGap > pinchDist * indexClearRatio;

        const rawX = ( thumb.x + middle.x ) / 2;
        const rawY = ( thumb.y + middle.y ) / 2;
        let mid = smooth.get( group.id );

        if ( !mid ) {
          mid = {
            x: rawX,
            y: rawY
          };
          smooth.set(
            group.id,
            mid
          );
        }

        mid.x += ( rawX - mid.x ) * ( 1 - lag );
        mid.y += ( rawY - mid.y ) * ( 1 - lag );

        latch.set(
          group.id,
          engaged
        );
        hands.set(
          group.id,
          {
            thumb,
            middle,
            mid,
            pinching: engaged
          }
        );

        pointers.push( {
          key: `camz-${ group.id }`,
          x: mid.x,
          y: mid.y,
          pressed: engaged,
          kind: "cameraZ"
        } );
      } );

      return pointers;
    },

    // Thumb + middle markers (amber while a depth grab is engaged) so the
    // second gesture is as visible as the shared tracker's first.
    draw() {
      if ( hands.size === 0 ) {
        return;
      }

      const p = getP5();

      p.push();

      hands.forEach( ( hand ) => {
        const color = hand.pinching
          ? [
            255,
            180,
            80
          ]
          : [
            255,
            255,
            255
          ];

        p.stroke(
          ...color,
          hand.pinching ? 230 : 90
        );
        p.strokeWeight( hand.pinching ? 4 : 2 );
        p.line(
          hand.thumb.x,
          hand.thumb.y,
          hand.middle.x,
          hand.middle.y
        );

        p.noStroke();
        p.fill(
          ...color,
          hand.pinching ? 255 : 100
        );
        p.circle(
          hand.mid.x,
          hand.mid.y,
          hand.pinching ? 14 : 8
        );
      } );

      p.pop();
    },

    clear() {
      hands.clear();
      smooth.clear();
      latch.clear();
    }
  };
}

const depthPinch = createDepthPinch();

// SHIFT state for the mouse depth gesture, tracked at module scope: p5's own
// keyIsDown depends on per-instance window bindings the engine tears down and
// recreates between runs, so one global listener is both simpler and reliable.
let shiftDown = false;

if ( typeof window !== "undefined" ) {
  window.addEventListener(
    "keydown",
    ( event ) => {
      if ( event.key === "Shift" ) {
        shiftDown = true;
      }
    }
  );
  window.addEventListener(
    "keyup",
    ( event ) => {
      if ( event.key === "Shift" ) {
        shiftDown = false;
      }
    }
  );
  window.addEventListener(
    "blur",
    () => {
      shiftDown = false;
    }
  );
}

// Last pointer position per drag key, for delta-based depth moves.
const dragCursor = new Map();
// Handle indices moved in depth this frame (drawn with the amber accent).
const depthActive = new Set();

function clampOffset(
  offset, range
) {
  const len = Math.hypot(
    offset.x,
    offset.y,
    offset.z
  );

  if ( len > range ) {
    const s = range / len;

    offset.x *= s;
    offset.y *= s;
    offset.z *= s;
  }
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

// Handle markers (dot + core, perspective-scaled by view depth) with the
// braid-v6 hover/grab accents — plus amber for handles held by a depth grab.
function drawHandles(
  p, targets, rig, hovers, grabbed, overlay
) {
  const cfg = overlay?.points ?? {};

  if ( cfg.show === false ) {
    return;
  }

  const size = cfg.size ?? 14;
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

  const scaleOf = ( target ) => clamp(
    rig.dist / target.depth,
    0.55,
    2
  );

  p.push();
  p.noStroke();

  targets.forEach( ( target ) => {
    const s = size * scaleOf( target );

    p.fill( ...color );
    p.circle(
      target.x,
      target.y,
      s
    );
    p.fill( ...coreColor );
    p.circle(
      target.x,
      target.y,
      s * coreRatio
    );
  } );

  p.noFill();

  hovers.forEach( ( index ) => {
    if ( grabbed.has( index ) ) {
      return;
    }

    const target = targets[ index ];

    p.stroke(
      255,
      255,
      255,
      170
    );
    p.strokeWeight( 2 );
    p.circle(
      target.x,
      target.y,
      size * scaleOf( target ) * 1.8 + 10
    );
  } );

  grabbed.forEach( ( index ) => {
    const target = targets[ index ];
    const accent = depthActive.has( index )
      ? [
        255,
        180,
        80
      ]
      : [
        120,
        200,
        255
      ];

    p.stroke(
      ...accent,
      230
    );
    p.strokeWeight( 3 );
    p.circle(
      target.x,
      target.y,
      size * scaleOf( target ) * 2.1 + 12
    );
  } );

  p.pop();
}

// Per-frame capsule scratch (reused to avoid per-frame garbage).
const segA = new Float32Array( MAX_POINTS * 4 );
const segB = new Float32Array( MAX_POINTS * 4 );

sketch.setup( async() => {
  state.offsets = [];
  state.signature = null;
  state.syncHash = null;
  dragCursor.clear();
  depthActive.clear();

  // Re-arm the drag layer's listeners (the engine's event registry is cleared
  // on reset) and forget any hands from a previous run.
  draggable.attach();
  pinch.clear();
  depthPinch.clear();

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const material = o.material ?? {};
  const sculpt = o.sculpt ?? {};
  const interaction = o.interaction ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const rendering = o.rendering ?? {};
  const grab = o.grab ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const geometry = getLetter( {
    letter: [
      ...( textCfg.value ?? "R" ).toString().trim()
    ][ 0 ] ?? "",
    fontName: textCfg.font ?? "agiro",
    sampleFactor: textCfg.detail ?? 1,
    simplifyThreshold: textCfg.simplify ?? 0,
    handles: sculpt.handles ?? 48
  } );

  // Font still loading (or empty text) — background only until it resolves.
  if ( !geometry ) {
    return;
  }

  // Re-sync from the store only when nothing is being dragged — except on a
  // geometry change, which must win (it releases stale drags via the target
  // count anyway).
  if ( !draggable.dragging || state.signature !== geometry.key ) {
    syncOffsets(
      sculpt,
      geometry
    );
  }

  const t = animation.angle;
  const progress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const rig = cameraRig(
    camera,
    t,
    progress
  );

  const scale = Math.max(
    material.size ?? 3,
    0.1
  );
  const range = sculpt.range ?? 1;

  // Sculpted handle positions (glyph units) and their screen projections —
  // the drag targets. onMove mutates entries in place so later pointers in the
  // same frame see updated positions.
  const glyphAt = ( index ) => {
    const base = geometry.points[ index ];
    const offset = state.offsets[ index ];

    return [
      base.x + ( offset?.x ?? 0 ),
      base.y + ( offset?.y ?? 0 ),
      offset?.z ?? 0
    ];
  };
  const targets = [];

  for ( let i = 0; i < geometry.count; i++ ) {
    const g = glyphAt( i );
    const projected = projectPoint(
      p,
      rig,
      [
        g[ 0 ] * scale,
        g[ 1 ] * scale,
        g[ 2 ] * scale
      ]
    );

    targets.push( projected );
  }

  // One groups fetch per frame, shared by the drag layer (mouse + touch), both
  // pinch trackers and the hand visuals.
  const groups = getPointerGroups( interaction );
  const handGroups = groups.filter( ( group ) => group.source === "hands" );
  const pinchCfg = {
    pinch: grab.pinch ?? 70,
    smoothing: grab.cameraSmoothing ?? 0.4
  };
  const camPointers = pinch.update(
    handGroups,
    pinchCfg
  );
  const depthPointers = depthPinch.update(
    handGroups,
    pinchCfg
  );

  depthActive.clear();

  const refreshTarget = ( index ) => {
    const g = glyphAt( index );
    const projected = projectPoint(
      p,
      rig,
      [
        g[ 0 ] * scale,
        g[ 1 ] * scale,
        g[ 2 ] * scale
      ]
    );

    targets[ index ].x = projected.x;
    targets[ index ].y = projected.y;
    targets[ index ].depth = projected.depth;
  };

  const {
    hovers,
    grabbed,
    released
  } = draggable.update( {
    targets,
    radius: grab.radius ?? 44,
    groups,
    extraPointers: [
      ...camPointers,
      ...depthPointers
    ],
    onMove: (
      index, pointer
    ) => {
      const offset = state.offsets[ index ];

      if ( !offset ) {
        return;
      }

      const last = dragCursor.get( pointer.key );
      const depthMode = pointer.kind === "cameraZ"
        || ( pointer.kind === "mouse" && shiftDown );

      if ( depthMode ) {
        // Vertical pointer travel → push/pull along world z, converted through
        // the letter-plane pixel scale so hand travel and depth travel feel
        // 1:1 on screen (then scaled by the depth gain).
        if ( last ) {
          const pxPerWorld = rig.focal / rig.dist * p.height;
          const gain = sculpt.depthGain ?? 1;

          offset.z += ( last.y - pointer.y ) / pxPerWorld * gain / scale;
        }

        depthActive.add( index );
      } else {
        // Move in the view-parallel plane through the handle (its view depth
        // stays what it was this frame), so the marker tracks the pointer
        // exactly for any camera yaw/pitch.
        const world = unprojectPoint(
          p,
          rig,
          pointer,
          targets[ index ].depth
        );
        const base = geometry.points[ index ];

        offset.x = world[ 0 ] / scale - base.x;
        offset.y = world[ 1 ] / scale - base.y;
      }

      clampOffset(
        offset,
        range
      );
      refreshTarget( index );
      dragCursor.set(
        pointer.key,
        {
          x: pointer.x,
          y: pointer.y
        }
      );
    }
  } );

  // Forget delta anchors of pointers that stopped dragging.
  for ( const key of [
    ...dragCursor.keys()
  ] ) {
    if ( !draggable.drags.has( key ) ) {
      dragCursor.delete( key );
    }
  }

  if ( released ) {
    persistOffsets( geometry.key );
  }

  // ── Upload the sculpted capsule field (glyph units) ────────────────────────
  let radius = 0;

  for ( let i = 0; i < geometry.count; i++ ) {
    const a = glyphAt( i );
    const b = glyphAt( geometry.next[ i ] );

    radius = Math.max(
      radius,
      Math.hypot(
        a[ 0 ],
        a[ 1 ],
        a[ 2 ]
      )
    );

    segA[ i * 4 ] = a[ 0 ];
    segA[ i * 4 + 1 ] = a[ 1 ];
    segA[ i * 4 + 2 ] = a[ 2 ];
    segA[ i * 4 + 3 ] = geometry.ids[ i ];
    segB[ i * 4 ] = b[ 0 ];
    segB[ i * 4 + 1 ] = b[ 1 ];
    segB[ i * 4 + 2 ] = b[ 2 ];
    segB[ i * 4 + 3 ] = 0;
  }

  const timeScale = o.timeScale ?? 1;
  const tubeR = Math.max(
    material.thickness ?? 0.06,
    0.005
  );
  const smoothK = Math.max(
    material.fusion ?? 0.12,
    0.001
  );

  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * timeScale * p.TAU * hueSpread );

  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.45
  );

  sculptRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms: {
      uT: t,
      uSegCount: {
        int: geometry.count
      },
      uSegA: {
        vec4v: segA
      },
      uSegB: {
        vec4v: segB
      },
      uRad: radius,
      uScale: scale,
      uTubeR: tubeR,
      uSmoothK: smoothK,
      uCamDist: rig.dist,
      uYaw: rig.yaw,
      uPitch: rig.pitch,
      uRoll: 0,
      uFocal: rig.focal,
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.25,
      uPipeHueShift: colors.pipeHueShift ?? 0.6,
      uShimmer: colors.shimmer ?? 2.2,
      uSaturation: colors.saturation ?? 0.8,
      uBrightness: colors.brightness ?? 1.25,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.75,
      uSpecular: light.specular ?? 1.1,
      uSpecPower: light.specPower ?? 42,
      uFresnelPower: light.fresnelPower ?? 2.2,
      uRimStrength: light.rimStrength ?? 0.6,
      uShadowSoft: light.shadowSoftness ?? 0,
      // Fog starts at the letter's centre plane: pulled points stay clear,
      // pushed points fade — a depth cue that works even face-on.
      uFogDensity: camera.fogDensity ?? 0.06,
      uFogStart: rig.dist,
      uMaxDist: rig.dist + radius * scale + 2,
      uAberration: 0
    }
  } );

  drawHandles(
    p,
    targets,
    rig,
    hovers,
    grabbed,
    o.overlay
  );

  // Hands (usual glowing ribbons), the per-hand XY pinch markers, the depth
  // pinch markers and the optional webcam preview, drawn last so they stack on
  // top of the letter. All no-op unless Vision is on / a hand is seen.
  drawHandRibbons(
    handGroups,
    o.hands
  );
  pinch.draw();
  depthPinch.draw();
  drawInteractionCameraPreview( interaction );
} );
