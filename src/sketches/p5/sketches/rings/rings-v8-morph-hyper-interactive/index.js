import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
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
  createDragClicks
} from "@/p5/utils/interaction/dragClicks.js";
import {
  drawInteractionCameraPreview
} from "@/p5/utils/interaction/overlay.js";
import {
  DURATION_DEFAULT
} from "@/lib/animationConfig";
import {
  renderSplines
} from "../../splines/_shared.js";
import {
  createMorphTroupe,
  buildTransition
} from "./virtualPointers.js";

// ─────────────────────────────────────────────────────────────────────────────
// rings v8 — morph hyper interactive.
//
// v7 let a troupe of virtual pointers sculpt ONE letter at random. v8 gives
// the troupe a SCRIPT: a list of texts (single letters, whole words or
// multi-line blocks — each line centred and stacked by the line spacing), and
// the cursors physically convert each one into the next — the loop is cut
// into one beat per text, each beat holding the finished word legible for a
// configurable fraction and spending the rest as the conversion window.
//
// ── Point bookkeeping (where v8 differs from v4's morph) ─────────────────────
// Texts rarely share a point count or contour structure, so instead of v4's
// fixed slot layout the words meet through a TRANSITION PLAN (see
// virtualPointers.js): matched points are DRAGGED to their new positions,
// missing points are CARRIED IN from outside the canvas by an add-pointer
// cursor, surplus points are grabbed and CARRIED OFF — the cursor's icon
// flipping to the remove-pointer as it retreats. The live shape is a pool of
// point slots: at every beat boundary the pool SNAPS to the finished word
// (positions + ring links), so the conversion may be as messy as it likes —
// including your own mouse meddling mid-show — and the word still lands
// exactly. Carried-in points float as lone beads until the snap splices them
// into the outline.
//
// ── The clicks (Click sounds) ────────────────────────────────────────────────
// The conversion is audible: drop an audio file on "Mouse down" and another on
// "Mouse up" and every grab / release of a point fires them — the two halves of
// a real click. Because the sound layer watches the DRAG layer, not the pointer
// devices, the scripted cursors, the mouse, a finger and a camera pinch all
// click through the same path, and a press over empty canvas stays silent.
// Without an upload a built-in synth click stands in. See
// @/p5/utils/interaction/dragClicks.js.
//
// ── Camera ───────────────────────────────────────────────────────────────────
// Words differ in width, so the camera can auto-fit: the distance eases from
// one text's fitted distance to the next's during the conversion window
// (whole words stay in frame without touching the slider). The fit respects
// the fov and canvas aspect with a margin knob; switch it off to drive the
// distance manually. Everything else — the raymarched capsule material, the
// exact CPU mirror of the shader camera, manual mouse/touch/pinch sculpting
// through the shared drag layer, the SHIFT/middle-pinch depth gesture — is
// v7 unchanged. Nothing persists: the cycle is the artwork.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// The schedule lives on the loop clock: frame 0 is word[0] fully formed with
// every cursor gone, and the final beat reserves time for the exodus — so
// uT = TAU meets uT = 0 exactly, live and in deterministic capture. Colours
// close too: each capsule's hue identity eases from its current word's arc id
// to the id it will carry after the beat snap (rings-v4's continuous uPipeId,
// per point), so no boundary — including the wrap back to word[0] — recolours
// the word abruptly.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_POINTS = 128; // pool slots = capsules (uniform array size)
const MAX_WORD_POINTS = 64; // handle budget cap per text
// Outlines kept per text (longest first). Multi-line texts carry one outline
// per letter (plus counters), and no more than budget/3 rings can ever earn
// their ≥ 3 points anyway — so this is the natural ceiling, not 12.
const MAX_CONTOURS = 21;
const MAX_STEPS = 96; // sphere-trace iterations per ray
const BUILD_SIZE = 100; // glyph sampling size; geometry normalised by it

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Morphing word field (glyph units, scaled to world by uScale) ──
  uniform int   uSegCount;              // capsules active this frame
  uniform vec4  uSegA[${ MAX_POINTS }]; // capsule start: xyz + arc identity in w
  uniform vec4  uSegB[${ MAX_POINTS }]; // capsule end: xyz
  uniform float uRad;                   // bounding radius (live pool)
  uniform float uScale;                 // world size of one glyph unit
  uniform float uTubeR;                 // tube radius (world)
  uniform float uSmoothK;               // smooth-union fillet (world)

  ${ IRIDESCENT_GLSL }

  // Polynomial smooth-minimum (iq): melts nearby capsules into a rounded fillet.
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Distance to the 3D segment a→b (round-capped capsule axis). A lone bead
  // (a == b) degenerates to a sphere — that is how carried points render.
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

    // Bounding sphere around the live pool (recomputed on the CPU every
    // frame) — rays far from the word skip the capsule loop entirely.
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
  // so uPipeHueShift drifts the palette around the word's contours.
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

const morphRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// ── Word geometry (built once per text/font/detail/handles, memoised) ────────
const geometryMemo = new Map();
const GEOMETRY_MEMO_MAX = 16;

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

// Sample a whole text (single letter or word) into up to MAX_CONTOURS closed
// rings: the handle budget spreads proportionally to contour perimeter (≥ 3
// per ring), each ring resamples to constant arc spacing, and everything is
// normalised to glyph space (text bbox centre at the origin, y up). Returns
// the ring structure (`contours`, `next`) the transition plan and the shader
// upload both need, plus the bbox half-extents the auto-fit camera reads.
function buildWord( {
  word,
  fontName,
  sampleFactor,
  simplifyThreshold,
  handles,
  lineSpacing
} ) {
  const p = getP5();
  const font = string.fonts[ fontName ] ?? string.fonts.sans;

  if ( !font?.font || !word ) {
    return null;
  }

  p.push();
  p.textFont( font );
  p.textSize( BUILD_SIZE );

  // Multi-line texts: each line is sampled on its own baseline and centred
  // horizontally, so a cycle entry can be a whole stacked block (vertical
  // reels-style layouts). Blank lines keep their slot as breathing room.
  const lines = word.split( "\n" ).map( ( line ) => line.trim() );
  const lineHeight = BUILD_SIZE * Math.max(
    lineSpacing ?? 1.15,
    0.5
  );
  const raw = [];

  lines.forEach( (
    line, lineIndex
  ) => {
    if ( !line ) {
      return;
    }

    const linePoints = font.textToPoints(
      line,
      0,
      lineIndex * lineHeight,
      BUILD_SIZE,
      {
        sampleFactor,
        simplifyThreshold
      }
    );

    if ( !linePoints.length ) {
      return;
    }

    let lineMinX = Infinity;
    let lineMaxX = -Infinity;

    for ( const pt of linePoints ) {
      lineMinX = Math.min(
        lineMinX,
        pt.x
      );
      lineMaxX = Math.max(
        lineMaxX,
        pt.x
      );
    }

    const lineCtrX = ( lineMinX + lineMaxX ) / 2;

    for ( const pt of linePoints ) {
      raw.push( {
        x: pt.x - lineCtrX,
        y: pt.y
      } );
    }
  } );

  p.pop();

  if ( !raw.length ) {
    return null;
  }

  const outlines = splitContours(
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

  if ( !outlines.length ) {
    return null;
  }

  const budget = clamp(
    Math.round( handles ),
    12,
    MAX_WORD_POINTS
  );
  const totalPerimeter = outlines.reduce(
    (
      sum, outline
    ) => sum + outline.perimeter,
    0
  );
  const counts = outlines.map( ( outline ) => Math.max(
    3,
    Math.round( budget * outline.perimeter / totalPerimeter )
  ) );

  let sum = counts.reduce(
    (
      total, n
    ) => total + n,
    0
  );

  while ( sum > Math.max(
    budget,
    outlines.length * 3
  ) ) {
    const i = counts.indexOf( Math.max( ...counts ) );

    if ( counts[ i ] <= 3 ) {
      break;
    }

    counts[ i ]--;
    sum--;
  }

  const sampled = [];
  const next = [];
  const contours = [];

  outlines.forEach( (
    outline, outlineIndex
  ) => {
    const samples = resampleContour(
      outline.pts,
      outline.perimeter / counts[ outlineIndex ],
      true
    );
    const count = Math.min(
      samples.length,
      MAX_WORD_POINTS - sampled.length
    );

    if ( count < 3 ) {
      return;
    }

    const start = sampled.length;

    for ( let i = 0; i < count; i++ ) {
      sampled.push( samples[ i ] );
      next.push( start + ( i + 1 ) % count );
    }

    contours.push( {
      start,
      count
    } );
  } );

  if ( sampled.length < 3 ) {
    return null;
  }

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
    ids,
    contours,
    halfW: ( maxX - minX ) / 2 / BUILD_SIZE,
    halfH: ( maxY - minY ) / 2 / BUILD_SIZE
  };
}

function getWord( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;
  const fontFamily = font?.font?.names?.fontFamily?.en || "unknown";
  const key = [
    cfg.word,
    fontFamily,
    cfg.sampleFactor,
    cfg.simplifyThreshold,
    cfg.handles,
    cfg.lineSpacing
  ].join( "|" );

  const cached = geometryMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const built = buildWord( cfg );

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

// ── Transition plans (memoised per word pair) ───────────────────────────────
const transitionMemo = new Map();
const TRANSITION_MEMO_MAX = 24;

function getTransition(
  src, dst
) {
  const key = `${ src.key }→${ dst.key }`;
  const cached = transitionMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const transition = buildTransition(
    src,
    dst
  );

  transitionMemo.set(
    key,
    transition
  );

  if ( transitionMemo.size > TRANSITION_MEMO_MAX ) {
    transitionMemo.delete( transitionMemo.keys().next().value );
  }

  return transition;
}

// ── Live pool: the points currently on stage ────────────────────────────────
// Slot layout per beat: [0, srcCount) = the current word's points (active,
// ring-linked), then one slot per planned add (inactive until its cursor
// fetches it; a lone floating bead once alive). Rebuilt — i.e. SNAPPED to the
// beat's word — every time the step or the cycle signature changes.
const state = {
  poolKey: null,
  slots: [],
  // Per-slot hue identity AFTER the snap to the next word (null = the point
  // does not survive the conversion). Uploaded ids ease toward these over the
  // morph window so the snap never recolours a capsule — see "Loop safety".
  dstIds: []
};

const draggable = createDraggable();
const pinch = createPinchTracker();
const troupe = createMorphTroupe();
// Mouse-button sound for every grab and release, real or scripted (Click sounds).
const clicks = createDragClicks();

function rebuildPool(
  src, dst, transition
) {
  const slots = src.points.map( (
    pt, i
  ) => ( {
    x: pt.x,
    y: pt.y,
    z: 0,
    active: true,
    next: src.next[ i ],
    id: src.ids[ i ]
  } ) );
  const dstIds = slots.map( () => null );

  transition.moves.forEach( ( move ) => {
    dstIds[ move.from ] = dst.ids[ move.to ];
  } );

  transition.adds.slice(
    0,
    MAX_POINTS - slots.length
  ).forEach( ( dstIndex ) => {
    // A carried-in bead wears its destination arc id from the start, so the
    // splice at the beat boundary keeps its colour.
    slots.push( {
      x: 0,
      y: 0,
      z: 0,
      active: false,
      next: -1,
      id: dst.ids[ dstIndex ]
    } );
    dstIds.push( dst.ids[ dstIndex ] );
  } );

  state.slots = slots;
  state.dstIds = dstIds;
}

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
// Pool indices moved in depth this frame (drawn with the amber accent).
const depthActive = new Set();

// ── Camera rig: the shared braidShader orbit camera, mirrored on the CPU ─────
// Exact same basis construction as BRAID_CAMERA_MAIN_GLSL (uRoll stays 0), so
// projectPoint/unprojectPoint agree with the shader to the pixel for any
// yaw/pitch — that agreement is what lets the show stay grabbable off-axis.

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
  camera, t, progress, distanceOverride
) {
  const dist = Math.max(
    distanceOverride ?? camera.distance ?? 6.5,
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

// The camera distance at which a shape's bbox (plus tube reach and margin)
// fits both screen axes: uv is normalised by height, so a point fits when
// focal·|y|/d ≤ 0.5 vertically and focal·|x|/d ≤ aspect/2 horizontally.
function fitDistance(
  shape, camera, scale, tubeR, aspect, margin
) {
  const focal = focalFromFov( camera.fov ?? 60 );
  const reach = tubeR * 2;
  const halfW = shape.halfW * scale + reach;
  const halfH = shape.halfH * scale + reach;

  return Math.max(
    2 * focal * halfH,
    2 * focal * halfW / Math.max(
      aspect,
      0.1
    )
  ) * ( 1 + margin );
}

// ── Depth pinch: thumb + MIDDLE finger = grab in z (v7, unchanged) ──────────
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

// Inactive pool slots park their target here — unreachable by any pointer and
// skipped by the marker pass.
const SENTINEL = -1e6;

// Handle markers (dot + core, perspective-scaled by view depth) with the
// hover/grab accents — amber for handles held by a depth grab.
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
    if ( target.x < SENTINEL / 2 ) {
      return;
    }

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
    if ( grabbed.has( index ) || targets[ index ].x < SENTINEL / 2 ) {
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
    if ( targets[ index ].x < SENTINEL / 2 ) {
      return;
    }

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
  state.poolKey = null;
  state.slots = [];
  state.dstIds = [];
  dragCursor.clear();
  depthActive.clear();

  // Re-arm the drag layer's listeners (the engine's event registry is cleared
  // on reset) and forget any hands / schedules from a previous run.
  draggable.attach();
  pinch.clear();
  depthPinch.clear();
  troupe.reset();
  clicks.reset();

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const material = o.material ?? {};
  const morph = o.morph ?? {};
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

  // ── The text cycle: one geometry per entry (letters, words or multi-line
  // blocks — real newlines from the textarea, or a literal "\n") ─────────────
  const wordList = ( Array.isArray( textCfg.words ) ? textCfg.words : [] )
    .map( ( word ) => ( word ?? "" ).toString().replace(
      /\\n/g,
      "\n"
    )
      .trim() )
    .filter( Boolean );

  if ( !wordList.length ) {
    return;
  }

  const shapes = wordList.map( ( word ) => getWord( {
    word,
    fontName: textCfg.font ?? "agiro",
    sampleFactor: textCfg.detail ?? 1,
    simplifyThreshold: textCfg.simplify ?? 0,
    handles: textCfg.handles ?? 48,
    lineSpacing: textCfg.lineSpacing ?? 1.15
  } ) );

  // Font still loading (or an entry produced no outline) — wait it out.
  if ( shapes.some( ( shape ) => !shape ) ) {
    return;
  }

  // ── Beat layout on the loop clock ──────────────────────────────────────────
  const T = DURATION_DEFAULT;
  const t = ( ( animation.loopTime % T ) + T ) % T;
  const stepCount = shapes.length;
  const stepDur = T / stepCount;
  const holdFrac = clamp(
    morph.hold ?? 0.3,
    0,
    0.85
  );
  const holdDur = stepDur * holdFrac;
  const stepIndex = Math.min(
    Math.floor( t / stepDur ),
    stepCount - 1
  );
  const src = shapes[ stepIndex ];
  const dst = shapes[ ( stepIndex + 1 ) % stepCount ];
  const transition = getTransition(
    src,
    dst
  );

  // Snap the pool to this beat's word (finishes the previous conversion and
  // recovers from any scrub) whenever the beat or the cycle itself changes.
  const cycleKey = shapes.map( ( shape ) => shape.key ).join( "," );
  const poolKey = `${ cycleKey }#${ stepIndex }`;

  if ( state.poolKey !== poolKey ) {
    state.poolKey = poolKey;
    rebuildPool(
      src,
      dst,
      transition
    );
  }

  const scale = Math.max(
    material.size ?? 2.2,
    0.1
  );
  const tubeR = Math.max(
    material.thickness ?? 0.05,
    0.005
  );

  // Progress through this beat's conversion window (0 through the hold, then
  // 0 → 1 across the morph) — drives the camera auto-fit ease and the hue
  // identity blend toward the next word.
  const morphU = clamp(
    ( t - stepIndex * stepDur - holdDur ) / Math.max(
      stepDur - holdDur,
      1e-4
    ),
    0,
    1
  );

  // ── Camera: auto-fit distance eases from this word to the next ─────────────
  const autoFit = camera.autoFit ?? {};
  let distanceOverride = null;

  if ( autoFit.enabled !== false ) {
    const aspect = p.width / Math.max(
      p.height,
      1
    );
    const margin = autoFit.margin ?? 0.35;
    const fitSrc = fitDistance(
      src,
      camera,
      scale,
      tubeR,
      aspect,
      margin
    );
    const fitDst = fitDistance(
      dst,
      camera,
      scale,
      tubeR,
      aspect,
      margin
    );

    // The zoom rides an easing curve instead of the raw morph progress, so it
    // coasts into each word's framing with a decelerating tail (pick a Back
    // ease for a touch of overshoot) rather than stopping dead at the beat
    // boundary. Every curve lands on exactly 0/1 at the ends, so the hold
    // windows and the loop wrap stay seamless.
    const fitEaseKey = autoFit.easing ?? "easeInOutCubic";
    const fitEase = typeof easing[ fitEaseKey ] === "function" ? easing[ fitEaseKey ] : ( x ) => x;

    distanceOverride = fitSrc + ( fitDst - fitSrc ) * fitEase( morphU );
  }

  const progress = t / T;
  const rig = cameraRig(
    camera,
    t,
    progress,
    distanceOverride
  );

  // ── Live pool projections = the drag targets ───────────────────────────────
  // Fixed length for the whole beat so drag indices stay stable; inactive
  // slots sit on the sentinel where no pointer can reach them.
  const targets = state.slots.map( ( slot ) => {
    if ( !slot.active ) {
      return {
        x: SENTINEL,
        y: SENTINEL,
        depth: rig.dist
      };
    }

    return projectPoint(
      p,
      rig,
      [
        slot.x * scale,
        slot.y * scale,
        slot.z * scale
      ]
    );
  } );

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

  // ── The stage crew ─────────────────────────────────────────────────────────
  const vpCfg = interaction.virtualPointers ?? {};
  const steps = shapes.map( (
    shape, k
  ) => ( {
    srcCount: shape.count,
    transition: getTransition(
      shape,
      shapes[ ( k + 1 ) % stepCount ]
    )
  } ) );
  const virtualPointers = troupe.update( {
    now: t,
    config: vpCfg,
    steps,
    stepDur,
    holdDur,
    targets,
    projectShapePoint: (
      k, i
    ) => {
      const pt = shapes[ k ].points[ i ] ?? {
        x: 0,
        y: 0
      };

      return projectPoint(
        p,
        rig,
        [
          pt.x * scale,
          pt.y * scale,
          0
        ]
      );
    },
    activatePoint: (
      i, screenPt
    ) => {
      const slot = state.slots[ i ];

      if ( !slot || slot.active ) {
        return;
      }

      // The new point pops into existence under the add pointer, off-canvas:
      // unproject at the word plane's depth so the bead hangs on the cursor.
      const world = unprojectPoint(
        p,
        rig,
        screenPt,
        rig.dist
      );

      slot.x = world[ 0 ] / scale;
      slot.y = world[ 1 ] / scale;
      slot.z = 0;
      slot.active = true;
      slot.next = -1;

      targets[ i ] = projectPoint(
        p,
        rig,
        [
          slot.x * scale,
          slot.y * scale,
          0
        ]
      );
    },
    deactivatePoint: ( i ) => {
      const slot = state.slots[ i ];

      if ( !slot || !slot.active ) {
        return;
      }

      slot.active = false;

      // Splice the ring shut behind the departed point.
      state.slots.forEach( ( other ) => {
        if ( other.next === i ) {
          other.next = slot.next === i ? -1 : slot.next;
        }
      } );
      slot.next = -1;
      targets[ i ].x = SENTINEL;
      targets[ i ].y = SENTINEL;
    },
    width: p.width,
    height: p.height,
    signature: [
      cycleKey,
      stepCount,
      holdFrac,
      JSON.stringify( vpCfg.timing ?? {} ),
      vpCfg.count ?? "",
      vpCfg.easing ?? ""
    ].join( "|" )
  } );

  // A troupe grab must never miss its point. When a task slice is compressed
  // (long words, many tasks, the exodus-shortened final beat) the cursor's
  // first pressed frame can already sit outside the pick-up radius, and a
  // proximity pick would leave the point behind — it would then pop into
  // place at the beat snap instead of being carried in like the others. The
  // schedule knows exactly which slot each cursor holds, so bind the drag
  // explicitly; a slot already held by another pointer (mouse, touch, pinch)
  // is left alone.
  const heldSlots = new Set( draggable.drags.values() );

  virtualPointers.forEach( ( pointer ) => {
    if ( !pointer.pressed || pointer.targetIndex === undefined ) {
      return;
    }

    if (
      draggable.drags.get( pointer.key ) === pointer.targetIndex
        || heldSlots.has( pointer.targetIndex )
        || !state.slots[ pointer.targetIndex ]?.active
    ) {
      return;
    }

    draggable.drags.set(
      pointer.key,
      pointer.targetIndex
    );
    heldSlots.add( pointer.targetIndex );
  } );

  const {
    hovers,
    grabbed
  } = draggable.update( {
    targets,
    radius: grab.radius ?? 44,
    groups,
    extraPointers: [
      ...camPointers,
      ...depthPointers,
      ...virtualPointers
    ],
    onMove: (
      index, pointer
    ) => {
      const slot = state.slots[ index ];

      if ( !slot || !slot.active ) {
        return;
      }

      const last = dragCursor.get( pointer.key );
      const depthMode = pointer.kind === "cameraZ"
        || ( pointer.kind === "mouse" && shiftDown );

      if ( depthMode ) {
        // Vertical pointer travel → push/pull along world z, converted through
        // the word-plane pixel scale so hand travel and depth travel feel 1:1.
        if ( last ) {
          const pxPerWorld = rig.focal / rig.dist * p.height;
          const gain = grab.depthGain ?? 1;

          slot.z = clamp(
            slot.z + ( last.y - pointer.y ) / pxPerWorld * gain / scale,
            -1.5,
            1.5
          );
        }

        depthActive.add( index );
      } else {
        // Move in the view-parallel plane through the point (its view depth
        // stays what it was this frame), so the marker tracks the pointer
        // exactly for any camera yaw/pitch.
        const world = unprojectPoint(
          p,
          rig,
          pointer,
          targets[ index ].depth
        );

        slot.x = clamp(
          world[ 0 ] / scale,
          -6,
          6
        );
        slot.y = clamp(
          world[ 1 ] / scale,
          -6,
          6
        );
      }

      const projected = projectPoint(
        p,
        rig,
        [
          slot.x * scale,
          slot.y * scale,
          slot.z * scale
        ]
      );

      targets[ index ].x = projected.x;
      targets[ index ].y = projected.y;
      targets[ index ].depth = projected.depth;
      dragCursor.set(
        pointer.key,
        {
          x: pointer.x,
          y: pointer.y
        }
      );
    }
  } );

  // The sound of the show: one click when a pointer takes a point, another
  // when it lets go — the mouse-down / mouse-up pair. Reading the drag layer's
  // own state means a mouse, a finger, a camera pinch and a scripted cursor all
  // click on exactly the frame they take hold, and a press over empty canvas
  // stays silent.
  clicks.update(
    draggable.drags,
    o.sound
  );

  // Forget delta anchors of pointers that stopped dragging. Nothing persists
  // in v8 — the cycle itself is the artwork.
  for ( const key of [
    ...dragCursor.keys()
  ] ) {
    if ( !draggable.drags.has( key ) ) {
      dragCursor.delete( key );
    }
  }

  // ── Upload the live capsule field (glyph units) ────────────────────────────
  let written = 0;
  let radius = 0;

  state.slots.forEach( (
    slot, index
  ) => {
    if ( !slot.active || written >= MAX_POINTS ) {
      return;
    }

    const linked = slot.next >= 0 ? state.slots[ slot.next ] : null;
    const other = linked?.active ? linked : slot;

    radius = Math.max(
      radius,
      Math.hypot(
        slot.x,
        slot.y,
        slot.z
      )
    );

    // Ease the hue identity toward what the snap will assign, so the beat
    // boundary (and the loop wrap) never recolours the finished word.
    const dstId = state.dstIds[ index ] ?? null;
    const hueId = dstId === null
      ? slot.id
      : slot.id + ( dstId - slot.id ) * morphU;

    const w = written * 4;

    segA[ w ] = slot.x;
    segA[ w + 1 ] = slot.y;
    segA[ w + 2 ] = slot.z;
    segA[ w + 3 ] = hueId;
    segB[ w ] = other.x;
    segB[ w + 1 ] = other.y;
    segB[ w + 2 ] = other.z;
    segB[ w + 3 ] = 0;
    written++;
  } );

  const timeScale = o.timeScale ?? 1;
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

  if ( written > 0 ) {
    morphRenderer.render( {
      columns: 1,
      rows: 1,
      resolutionScale: rendering.resolutionScale ?? 0.7,
      uniforms: {
        uT: animation.angle,
        uSegCount: {
          int: written
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
        // Fog starts at the word's centre plane: pulled points stay clear,
        // pushed points fade — a depth cue that works even face-on.
        uFogDensity: camera.fogDensity ?? 0.06,
        uFogStart: rig.dist,
        uMaxDist: rig.dist + ( radius + 1 ) * scale + 2,
        uAberration: 0
      }
    } );
  }

  drawHandles(
    p,
    targets,
    rig,
    hovers,
    grabbed,
    o.overlay
  );

  // Hands (usual glowing ribbons), the per-hand pinch markers, the webcam
  // preview — then the stage crew on top of everything: they are the show.
  drawHandRibbons(
    handGroups,
    o.hands
  );
  pinch.draw();
  depthPinch.draw();
  drawInteractionCameraPreview( interaction );
  troupe.draw(
    p,
    vpCfg,
    t
  );
} );
