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
  drawInteractionCameraPreview
} from "@/p5/utils/interaction/overlay.js";
import {
  DURATION_DEFAULT
} from "@/lib/animationConfig";
import {
  renderSplines
} from "../../splines/_shared.js";
import {
  computeCursors,
  drawCursors,
  CURSOR_DEFAULTS
} from "./virtualCursors.js";
import {
  createHoverSounds
} from "./hoverSounds.js";

// ─────────────────────────────────────────────────────────────────────────────
// rings v10 — magnetic fly-by.
//
// The family's cursors stop touching the word. v7–v9 pressed on points and
// dragged (or flicked) them; v10's cursors are a FORMATION flying over the
// canvas — by default a circle of hands that breathes: aligned on an outer
// ring, they close on the canvas centre together, then swell back out, as
// many times per loop as `movement.cycles` asks. Two more flight plans ship
// alongside: a Lissajous curve (integer x/y frequencies, both phases free)
// the cursors ride like beads on a wire, and a horizontal / vertical wiper
// sweep in parallel lanes. Stagger, easing, cycle count and phase shape all
// three.
//
// ── The attraction (why the word notices the fly-by) ────────────────────────
// Nothing is grabbed and nothing clicks. Instead every cursor is a small
// gravity well: a text point inside `attraction.range` of a cursor leans
// toward it — hardest near the cursor, fading to nothing at the rim (the
// falloff easing shapes the well) — and `attraction.strength` caps how far a
// point may be pulled off its home. The pull chases its target through an
// exponential lag (`attraction.speed`, the gravity speed): slow means the
// word bulges and settles like jelly after each pass, fast means it snaps
// taut. When no cursor is near, the same lag carries every point home — the
// release breath is the same physics as the pull. Real pointers (mouse,
// touch, camera-seen fingertips) join the formation as extra gravity wells
// (attraction.manual), so a hand waved over the word tugs it exactly like
// the scripted fly-bys.
//
// ── Hover state + the "on over" sound ───────────────────────────────────────
// A cursor within `cursors.hoverRadius` of a point switches to the `over`
// artwork (open hand) for as long as it covers at least one point — hovering
// is the whole act, so it gets the costume change the old troupes reserved
// for grabbing. Each (cursor, point) pair's rising edge feeds the hover
// sound layer (./hoverSounds.js): one batch per frame, voice-capped. The
// sound FIELD ships empty on purpose — no default fly-by sound is chosen
// yet, so the show is silent until an audio file lands on Sound → On over.
//
// ── Loop safety ─────────────────────────────────────────────────────────────
// The formation is stateless on the loop clock (integer cycles, spins and
// frequencies — see ./virtualCursors.js), the word geometry is static, and
// the attraction is a field of the cursor positions, so the resting frames
// match exactly across the wrap. The only state is the exponential chase,
// and in circle mode frame 0 has every cursor parked on the far rim — the
// wells are empty, the word is at rest, and the loop closes clean; a heavy
// lag with a formation that crosses the word at frame 0 (lissajous / sweep)
// can carry a one-settle transient into the first beat of a capture, which
// reads as the formation arriving — acceptable, and `attraction.speed` at
// the top of its range removes it entirely.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_POINTS = 96; // word points = capsules (uniform array size)
// Outlines kept per text (longest first). Multi-line texts carry one outline
// per letter (plus counters); no more than budget/3 rings can ever earn
// their ≥ 3 points, so this is the natural ceiling.
const MAX_CONTOURS = 21;
const MAX_STEPS = 96; // sphere-trace iterations per ray
const BUILD_SIZE = 100; // glyph sampling size; geometry normalised by it

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Attracted word field (glyph units, scaled to world by uScale) ──
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

  // Distance to the 3D segment a→b (round-capped capsule axis). Attracted
  // points move in their view-parallel plane, so the capsules are genuinely 3D.
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

    // Bounding sphere around the live word (recomputed on the CPU every
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

const flybyRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// Sample a whole text (single letter, word or multi-line block) into up to
// MAX_CONTOURS closed rings: the handle budget spreads proportionally to
// contour perimeter (≥ 3 per ring), each ring resamples to constant arc
// spacing, and everything is normalised to glyph space (text bbox centre at
// the origin, y up). Returns the ring structure (`points`, `next`, `ids`)
// the shader upload needs, plus the bbox half-extents the auto-fit camera
// reads. Same recipe as v9's word builder — v10 just never converts it.
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
  // horizontally, so the text can be a whole stacked block (vertical
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
    MAX_POINTS
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

// ── Live state: where the attraction has carried each point ─────────────────
// One rendered offset per point (glyph units, view-parallel — so genuinely
// 3D once the camera is off-axis), chasing the attraction field through the
// exponential lag. Plus the hover bookkeeping the icons and the "on over"
// sound read: which points each attractor currently covers.
const state = sketch.state( () => ( {
  key: null,
  offsets: [],
  over: new Map(),
  lastNow: null
} ) );

const overs = createHoverSounds();

// ── Camera rig: the shared braidShader orbit camera, mirrored on the CPU ─────
// Exact same basis construction as BRAID_CAMERA_MAIN_GLSL (uRoll stays 0), so
// projectPoint/unprojectPoint agree with the shader to the pixel for any
// yaw/pitch — that agreement is what keeps the attraction glued to the tubes
// it deforms while the camera orbits and sways.

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

// The camera distance at which the text's bbox (plus tube reach and margin)
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

// Point markers (dot + core, perspective-scaled by view depth). A point
// currently covered by a cursor's hover circle wears the white ring the drag
// sketches gave their hovered handles — the fly-by's only "touch".
function drawHandles(
  p, targets, rig, hovered, overlay
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

  hovered.forEach( ( index ) => {
    const target = targets[ index ];

    if ( !target ) {
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
      target.x,
      target.y,
      size * scaleOf( target ) * 1.8 + 10
    );
  } );

  p.pop();
}

// Per-frame capsule scratch (reused to avoid per-frame garbage).
const segA = new Float32Array( MAX_POINTS * 4 );
const segB = new Float32Array( MAX_POINTS * 4 );

sketch.setup( async() => {
  state.key = null;
  state.offsets = [];
  state.over.clear();
  state.lastNow = null;

  overs.reset();

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const material = o.material ?? {};
  const movement = o.movement ?? {};
  const cursorsCfg = o.cursors ?? {};
  const attraction = o.attraction ?? {};
  const interaction = o.interaction ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const rendering = o.rendering ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  // ── The word (single text, multi-line supported — real newlines from the
  // textarea, or a literal "\n") ─────────────────────────────────────────────
  const word = ( textCfg.value ?? "" ).toString().replace(
    /\\n/g,
    "\n"
  )
    .trim();

  const geometry = getWord( {
    word,
    fontName: textCfg.font ?? "agiro",
    sampleFactor: textCfg.detail ?? 1,
    simplifyThreshold: textCfg.simplify ?? 0,
    handles: textCfg.handles ?? 56,
    lineSpacing: textCfg.lineSpacing ?? 1.15
  } );

  // Font still loading (or empty text) — background only until it resolves.
  if ( !geometry ) {
    return;
  }

  // A new word starts at rest: forget the previous text's displacements and
  // hover bookkeeping.
  if ( state.key !== geometry.key ) {
    state.key = geometry.key;
    state.offsets = geometry.points.map( () => ( {
      x: 0,
      y: 0,
      z: 0
    } ) );
    state.over.clear();
  }

  const t = animation.angle;
  const progress = animation.progression;
  const now = animation.loopTime;

  // Frame step on the loop clock, wrap-aware (drives the exponential chase).
  const T = DURATION_DEFAULT;
  let dt = state.lastNow === null ? 0 : now - state.lastNow;

  if ( dt < 0 ) {
    dt += T;
  }

  dt = clamp(
    dt,
    0,
    0.1
  );
  state.lastNow = now;

  const scale = Math.max(
    material.size ?? 2.2,
    0.1
  );
  const tubeR = Math.max(
    material.thickness ?? 0.05,
    0.005
  );

  // ── Camera: static auto-fit (any word stays in frame) ──────────────────────
  const autoFit = camera.autoFit ?? {};
  let distanceOverride = null;

  if ( autoFit.enabled !== false ) {
    const aspect = p.width / Math.max(
      p.height,
      1
    );

    distanceOverride = fitDistance(
      geometry,
      camera,
      scale,
      tubeR,
      aspect,
      autoFit.margin ?? 0.35
    );
  }

  const rig = cameraRig(
    camera,
    t,
    progress,
    distanceOverride
  );

  // Home projections: where each point sits with no attraction. The wells
  // pull RELATIVE TO HOME, so the field is stable (a point never runs away —
  // release it and the chase carries it exactly back).
  const homes = geometry.points.map( ( pt ) => projectPoint(
    p,
    rig,
    [
      pt.x * scale,
      pt.y * scale,
      0
    ]
  ) );

  // ── The gravity wells: the formation + any real pointers ───────────────────
  const cursors = computeCursors(
    movement,
    cursorsCfg.count,
    {
      progress,
      width: p.width,
      height: p.height
    }
  );
  const attractors = cursors.map( ( cursor ) => ( {
    key: cursor.key,
    x: cursor.x,
    y: cursor.y,
    cursor
  } ) );

  // One groups fetch per frame, shared by the attractors and the hand
  // visuals. Every point a source produces (a mouse, each finger of a touch,
  // each camera-seen fingertip) is its own well.
  const groups = getPointerGroups( interaction );
  const handGroups = groups.filter( ( group ) => group.source === "hands" );

  if ( attraction.manual !== false ) {
    groups.forEach( ( group ) => {
      group.points.forEach( (
        pt, index
      ) => {
        attractors.push( {
          key: `${ group.id }:${ index }`,
          x: pt.x,
          y: pt.y
        } );
      } );
    } );
  }

  // ── The attraction field → eased displacements ─────────────────────────────
  const strength = clamp(
    attraction.strength ?? 70,
    0,
    400
  );
  const range = Math.max(
    attraction.range ?? 170,
    1
  );
  const falloffKey = attraction.falloff ?? "smoothstep";
  const falloff = typeof easing[ falloffKey ] === "function" ? easing[ falloffKey ] : ( x ) => x;
  const speed = clamp(
    attraction.speed ?? 9,
    0.1,
    30
  );
  // At the top of the slider the chase is treated as instantaneous (pure
  // field, perfectly loop-safe); anywhere below, an exponential lag whose
  // response time is 1/speed loop-seconds.
  const chase = speed >= 29.5 ? 1 : 1 - Math.exp( -speed * dt );

  for ( let i = 0; i < geometry.count; i++ ) {
    const home = homes[ i ];
    let dx = 0;
    let dy = 0;

    for ( const well of attractors ) {
      const wx = well.x - home.x;
      const wy = well.y - home.y;
      const d = Math.hypot(
        wx,
        wy
      );

      if ( d >= range || d < 1e-3 ) {
        continue;
      }

      // The well's shape: full pull at the centre, nothing at the rim, the
      // falloff easing bending the slope in between. A point is never pulled
      // PAST the cursor — the pull caps at the distance itself.
      const w = falloff( 1 - d / range );
      const pull = Math.min(
        strength * w,
        d
      );

      dx += wx / d * pull;
      dy += wy / d * pull;
    }

    // Several wells may tug at once; the summed pull still respects the
    // strength cap so crossings compress instead of exploding.
    const mag = Math.hypot(
      dx,
      dy
    );

    if ( mag > strength ) {
      dx *= strength / mag;
      dy *= strength / mag;
    }

    // Screen displacement → glyph-space offset, in the view-parallel plane
    // through the point's home (same move as the family's drags), so the
    // deformation tracks the wells exactly for any camera yaw/pitch.
    const offset = state.offsets[ i ];
    let tx = 0;
    let ty = 0;
    let tz = 0;

    if ( mag > 1e-4 ) {
      const world = unprojectPoint(
        p,
        rig,
        {
          x: home.x + dx,
          y: home.y + dy
        },
        home.depth
      );
      const base = geometry.points[ i ];

      tx = world[ 0 ] / scale - base.x;
      ty = world[ 1 ] / scale - base.y;
      tz = world[ 2 ] / scale;
    }

    offset.x += ( tx - offset.x ) * chase;
    offset.y += ( ty - offset.y ) * chase;
    offset.z += ( tz - offset.z ) * chase;
  }

  // ── Live projections (post-attraction) — hover + markers read these ────────
  const glyphAt = ( index ) => {
    const base = geometry.points[ index ];
    const offset = state.offsets[ index ];

    return [
      base.x + offset.x,
      base.y + offset.y,
      offset.z
    ];
  };
  const targets = [];

  for ( let i = 0; i < geometry.count; i++ ) {
    const g = glyphAt( i );

    targets.push( projectPoint(
      p,
      rig,
      [
        g[ 0 ] * scale,
        g[ 1 ] * scale,
        g[ 2 ] * scale
      ]
    ) );
  }

  // ── Hover pass: icons + the "on over" edges ────────────────────────────────
  // A cursor covering at least one live point flips to the `over` artwork;
  // every (attractor, point) pair that newly entered the hover circle this
  // frame counts one rising edge for the sound layer. State is pruned to the
  // attractors actually present, so lifted fingers forget their hovers.
  const hoverRadius = Math.max(
    cursorsCfg.hoverRadius ?? CURSOR_DEFAULTS.hoverRadius,
    1
  );
  const hovered = new Set();
  const present = new Set();
  let enterCount = 0;

  attractors.forEach( ( well ) => {
    present.add( well.key );

    const before = state.over.get( well.key );
    const covered = new Set();

    for ( let i = 0; i < targets.length; i++ ) {
      const d = Math.hypot(
        well.x - targets[ i ].x,
        well.y - targets[ i ].y
      );

      if ( d > hoverRadius ) {
        continue;
      }

      covered.add( i );
      hovered.add( i );

      if ( !before?.has( i ) ) {
        enterCount++;
      }
    }

    state.over.set(
      well.key,
      covered
    );

    if ( well.cursor ) {
      well.cursor.over = covered.size > 0;
    }
  } );

  for ( const key of [
    ...state.over.keys()
  ] ) {
    if ( !present.has( key ) ) {
      state.over.delete( key );
    }
  }

  overs.update(
    enterCount,
    o.sound
  );

  // ── Upload the live capsule field (glyph units) ────────────────────────────
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

  flybyRenderer.render( {
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
      // Fog starts at the word's centre plane: pulled points stay clear,
      // pushed points fade — a depth cue that works even face-on.
      uFogDensity: camera.fogDensity ?? 0.06,
      uFogStart: rig.dist,
      uMaxDist: rig.dist + ( radius + 1 ) * scale + 2,
      uAberration: 0
    }
  } );

  drawHandles(
    p,
    targets,
    rig,
    hovered,
    o.overlay
  );

  // Hands (usual glowing ribbons), the webcam preview — then the formation on
  // top of everything: the fly-by is the show.
  drawHandRibbons(
    handGroups,
    o.hands
  );
  drawInteractionCameraPreview( interaction );
  drawCursors(
    p,
    cursorsCfg,
    cursors
  );
} );
