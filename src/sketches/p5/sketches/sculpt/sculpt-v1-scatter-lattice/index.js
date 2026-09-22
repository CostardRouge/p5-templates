import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import easing from "@/p5/utils/easing.js";
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
  MAX_POINTS,
  MAX_LINKS,
  getLattice,
  driftAt
} from "../_lattice.js";
import {
  rankAt,
  wavePhase,
  envelopeTimings,
  envelopeAt,
  linkStateAt
} from "../_wave.js";

// ─────────────────────────────────────────────────────────────────────────────
// sculpt v1 — scatter lattice.
//
// A cloud of points thrown into a volume by a seed, a graph of links to their
// nearest neighbours, and every link a tube of the rings material — the same
// capsule-field recipe as rings v6/v10 (CPU computes a few dozen capsules per
// frame, uploads them as uniform arrays, the shader takes their smooth union
// behind a bounding sphere). What makes it move is a WAVE: a rank per link,
// from where the link sits along the wave's direction, offsets the loop clock,
// and an envelope poses the tube from its source end, holds it, and withdraws
// it — or swells it, or pops it — as the front passes. Geometry and wave live
// in ../_lattice.js and ../_wave.js and know nothing about the material, so a
// later sculpt draws the same lattice in another style.
//
// ── The lattice is the constant, the tubes come and go ───────────────────────
// Points are the sculpture's permanent skeleton (bulbs at the nodes, sized by
// `material.nodes`, 0 for none); the links are what the wave lays and takes
// back. Links are computed on the REST positions: drift, breathing and the
// cursor's pull move the nodes the links are drawn between, never which nodes
// are linked, so nothing rewires mid-loop.
//
// ── The wave is defined in the sculpture's own frame ─────────────────────────
// Ranks come from the unspun, undrifted rest positions. A `motion.spin` turns
// the sculpture with its wave, like a texture, rather than sweeping a
// world-fixed front over a turning object — that keeps a link's orientation
// (lower rank → higher rank, so material flows away from the source) stable
// for the whole loop. The one mode where the orientation can flip mid-pose is
// `cursor`, whose source moves: a link whose bisector the cursor crosses
// swaps ends. Accepted; it is the price of the source being live.
//
// ── The cursor: the only thing with state ────────────────────────────────────
// Real pointers (mouse, touch, camera hands through the shared interaction
// module) are gravity wells in screen space, rings v10's physics verbatim:
// a point inside `cursor.range` of a well leans toward (or away from) it in
// its view-parallel plane, capped by `strength`, chased through an
// exponential lag. With no pointer, as in a headless export, the wells are
// empty and nothing has anything to converge to — so the loop closes. A
// scripted VIRTUAL cursor (circle / lissajous / sweep, stateless on the loop
// clock) stands in when the effect should be part of the export, and it is
// also what gives the `cursor` wave mode a source without a mouse.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Waves, drift and breathing cycles, spin and orbit turns, and the hue scroll
// all snap to whole numbers per loop; the drift samples a seeded value noise
// on a circle in noise space. Frame 0 and frame N differ only by the cursor
// chase, and only while a pointer is over the canvas.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 96; // sphere-trace iterations per ray

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── The lattice, in world units ──
  uniform int   uSegCount;               // links present this frame
  uniform vec4  uSegA[${ MAX_LINKS }];   // drawn start: xyz + hue identity in w
  uniform vec4  uSegB[${ MAX_LINKS }];   // drawn end: xyz + tube radius in w
  uniform int   uNodeCount;              // bulbs (0 when material.nodes is 0)
  uniform vec4  uNode[${ MAX_POINTS }];  // centre xyz + radius in w
  uniform float uBoundR;                 // bounding sphere around everything
  uniform float uSmoothK;                // smooth-union fillet

  ${ IRIDESCENT_GLSL }

  // Polynomial smooth-minimum (iq): melts touching tubes into a rounded fillet.
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Distance to the 3D segment a→b (round-capped capsule axis).
  float segDist3D(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h);
  }

  float mapScene(vec3 p) {
    // Rays far from the sculpture skip both loops entirely.
    float bound = length(p) - uBoundR;

    if (bound > 0.3) { return bound; }

    float kn = max(uSmoothK, 1e-4);
    float d = 1e9;

    for (int s = 0; s < ${ MAX_LINKS }; s++) {
      if (s >= uSegCount) { break; }

      d = smin(d, segDist3D(p, uSegA[s].xyz, uSegB[s].xyz) - uSegB[s].w, kn);
    }

    for (int n = 0; n < ${ MAX_POINTS }; n++) {
      if (n >= uNodeCount) { break; }

      d = smin(d, length(p - uNode[n].xyz) - uNode[n].w, kn);
    }

    return d;
  }

  // Hue identity = the nearest link's (its rank, its index or its source node,
  // per colors.hueBy). A bulb takes the hue of the nearest link, which is one
  // of its own — continuous with the tube meeting it, and one loop cheaper.
  float nearestPipe(vec3 p) {
    float best = 1e9;
    float ident = 0.0;

    for (int s = 0; s < ${ MAX_LINKS }; s++) {
      if (s >= uSegCount) { break; }

      float d = segDist3D(p, uSegA[s].xyz, uSegB[s].xyz) - uSegB[s].w;

      if (d < best) { best = d; ident = uSegA[s].w; }
    }

    return ident;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS,
    look: true
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const latticeRenderer = createNoiseFieldRenderer( FRAGMENT );

const VIRTUALS = [
  "none",
  "circle",
  "lissajous",
  "sweep"
];

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

// ── Per-instance state ───────────────────────────────────────────────────────
// The chased pull per point (world, view-parallel) is the sketch's only
// frame-to-frame state; the typed arrays are the shader's scratch.
const state = sketch.state( () => ( {
  latticeKey: null,
  pull: [],
  lastNow: null,
  segA: new Float32Array( MAX_LINKS * 4 ),
  segB: new Float32Array( MAX_LINKS * 4 ),
  nodes: new Float32Array( MAX_POINTS * 4 )
} ) );

// ── Camera rig: the shared braidShader orbit camera, mirrored on the CPU ─────
// Same basis as BRAID_CAMERA_MAIN_GLSL (uRoll stays 0), so a world point
// projects to the pixel the shader shades it at — which is what lets the
// cursor's pull and the `cursor` wave source be read off the canvas exactly.

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
  camera, loop, distance
) {
  const dist = Math.max(
    distance,
    0.5
  );
  const focal = focalFromFov( camera.fov ?? 55 );
  const orbitTurns = Math.round( camera.orbit ?? 0 ); // whole turns: loop-safe
  const yaw = ( camera.yaw ?? 0 ) + loop * orbitTurns * 2 * Math.PI;
  const swayCycles = Math.round( camera.swayCycles ?? 2 ); // whole cycles: loop-safe
  const pitch = clamp(
    ( camera.elevation ?? 0 ) + ( camera.sway ?? 0 ) * Math.sin( swayCycles * loop * 2 * Math.PI ),
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

  return {
    x: p.width / 2 + rig.focal * vDot(
      v,
      rig.right
    ) / depth * p.height,
    y: p.height / 2 - rig.focal * vDot(
      v,
      rig.up
    ) / depth * p.height,
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

// The distance at which a sphere of `radius` fits the frame on its tighter
// axis — the auto-fit reads the fov and the canvas aspect, so a portrait
// export frames the same sculpture a landscape one does. The frustum is read
// off the shader's own camera, not off the fov slider: BRAID_CAMERA_MAIN_GLSL
// spans uv in [-0.5, 0.5] against uFocal, so the frame's true half-angle is
// atan( 0.5 / focal ) — about half the slider's value, which is the family's
// convention (flip v3 fits a half-height-1 plane at 2 × focal for the same
// reason). Fitting on the slider's angle put the sculpture's rim outside the
// frame, measured: tubes cut at both edges of a square capture.
function fitDistance(
  p, focal, radius
) {
  const tanV = 0.5 / focal;
  const tanH = tanV * ( p.width / Math.max(
    p.height,
    1
  ) );
  const half = Math.max(
    Math.atan( Math.min(
      tanV,
      tanH
    ) ),
    0.02
  );

  return radius / Math.sin( half );
}

// The scripted stand-in for a pointer: stateless on the loop clock, whole
// cycles per loop, in canvas pixels.
function virtualCursorAt(
  mode, loop, {
    cycles,
    radius,
    width,
    height
  }
) {
  const cx = width / 2;
  const cy = height / 2;
  const r = radius * Math.min(
    width,
    height
  ) / 2;
  const c = Math.max(
    1,
    Math.round( cycles )
  );
  const a = loop * 2 * Math.PI * c;

  if ( mode === "circle" ) {
    return {
      x: cx + Math.cos( a ) * r,
      y: cy + Math.sin( a ) * r
    };
  }

  if ( mode === "lissajous" ) {
    return {
      x: cx + Math.sin( a * 3 ) * r,
      y: cy + Math.cos( a * 2 ) * r * 0.8
    };
  }

  if ( mode === "sweep" ) {
    const u = ( loop * c ) % 1;
    const tri = 1 - Math.abs( 2 * u - 1 );

    return {
      x: cx + ( tri * 2 - 1 ) * r,
      y: cy
    };
  }

  return null;
}

// Rotate about the y axis (the sculpture's spin).
function spinY(
  v, angle
) {
  const c = Math.cos( angle );
  const s = Math.sin( angle );

  return [
    v[ 0 ] * c - v[ 2 ] * s,
    v[ 1 ],
    v[ 0 ] * s + v[ 2 ] * c
  ];
}

sketch.setup( async() => {
  state.latticeKey = null;
  state.pull = [];
  state.lastNow = null;

  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const pointsCfg = o.points ?? {};
  const linksCfg = o.links ?? {};
  const wave = o.wave ?? {};
  const motion = o.motion ?? {};
  const cursorCfg = o.cursor ?? {};
  const interaction = o.interaction ?? {};
  const material = o.material ?? {};
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

  // ── The lattice (memoised on its parameters) ───────────────────────────────
  const lattice = getLattice( {
    count: pointsCfg.count ?? 40,
    seed: Math.round( pointsCfg.seed ?? 7 ),
    spacing: pointsCfg.spacing ?? 0.6,
    volume: pointsCfg.volume ?? "sphere",
    flatten: pointsCfg.flatten ?? 0.55,
    neighbours: linksCfg.neighbours ?? 2,
    reach: linksCfg.reach ?? 0.7,
    density: linksCfg.density ?? 1
  } );
  const points = lattice.points;
  const links = lattice.links;

  if ( state.latticeKey !== lattice.key ) {
    state.latticeKey = lattice.key;
    state.pull = points.map( () => [
      0,
      0,
      0
    ] );
  }

  // ── The clock ──────────────────────────────────────────────────────────────
  const loopProgress = ( ( animation.progression % 1 ) + 1 ) % 1;
  const loop = ( wave.headMode ?? "clock" ) === "manual"
    ? clamp(
      wave.head ?? 0,
      0,
      1
    )
    : loopProgress;

  // Frame step on the loop clock, wrap-aware (drives the cursor chase only).
  const now = animation.loopTime;
  let dt = state.lastNow === null ? 0 : now - state.lastNow;

  if ( dt < 0 ) {
    dt += DURATION_DEFAULT;
  }

  dt = clamp(
    dt,
    0,
    0.1
  );
  state.lastNow = now;

  // ── Sizes ──────────────────────────────────────────────────────────────────
  const radius = Math.max(
    pointsCfg.radius ?? 1.6,
    0.2
  );
  const breathe = clamp(
    motion.breathe ?? 0,
    0,
    0.9
  );
  const breatheCycles = Math.max(
    1,
    Math.round( motion.breatheCycles ?? 1 )
  );
  const breatheScale = 1 + breathe * Math.sin( breatheCycles * loop * 2 * Math.PI );
  const spinAngle = Math.round( motion.spin ?? 0 ) * loop * 2 * Math.PI;

  const thickness = Math.max(
    material.thickness ?? 0.06,
    0.005
  );
  const variation = clamp(
    material.variation ?? 0.3,
    0,
    0.9
  );
  const fusion = Math.max(
    material.fusion ?? 0.08,
    0.001
  );
  const nodeFactor = Math.max(
    material.nodes ?? 1.8,
    0
  );
  const swell = Math.max(
    wave.swell ?? 0.8,
    0
  );
  const effect = wave.effect ?? "grow-swell";
  const swells = effect === "swell" || effect === "grow-swell";
  const maxTube = thickness * ( 1 + variation ) * ( 1 + swell ) * Math.max(
    nodeFactor,
    1
  );
  const driftAmplitude = Math.max(
    motion.drift ?? 0.08,
    0
  );

  // ── Camera ─────────────────────────────────────────────────────────────────
  const fov = camera.fov ?? 55;
  const fitRadius = radius * ( 1 + breathe ) * ( 1 + driftAmplitude ) * ( 1 + ( camera.margin ?? 0.1 ) ) + maxTube;
  const distance = camera.autoFit !== false
    ? fitDistance(
      p,
      focalFromFov( fov ),
      fitRadius
    )
    : ( camera.distance ?? 6 );
  const rig = cameraRig(
    camera,
    loop,
    distance
  );

  // ── The wells: real pointers + the virtual cursor ──────────────────────────
  const groups = getPointerGroups( interaction );
  const wells = [];

  groups.forEach( ( group ) => {
    group.points.forEach( ( pt ) => {
      wells.push( {
        x: pt.x,
        y: pt.y,
        virtual: false
      } );
    } );
  } );

  const virtualMode = VIRTUALS.includes( cursorCfg.virtual ) ? cursorCfg.virtual : "none";
  const virtual = virtualCursorAt(
    virtualMode,
    loop,
    {
      cycles: cursorCfg.virtualCycles ?? 1,
      radius: clamp(
        cursorCfg.virtualRadius ?? 0.6,
        0,
        1.5
      ),
      width: p.width,
      height: p.height
    }
  );

  if ( virtual ) {
    wells.push( {
      ...virtual,
      virtual: true
    } );
  }

  // The `cursor` wave mode's source: the first well, brought back into the
  // lattice's own frame (unspun, unit radius) where ranks are computed.
  let cursorUnit = null;

  if ( wells.length ) {
    const world = unprojectPoint(
      p,
      rig,
      wells[ 0 ],
      rig.dist
    );
    const local = spinY(
      world,
      -spinAngle
    );
    const inv = 1 / ( radius * breatheScale );

    cursorUnit = {
      x: local[ 0 ] * inv,
      y: local[ 1 ] * inv,
      z: local[ 2 ] * inv
    };
  }

  // ── Home positions: rest + drift, breathed and spun ────────────────────────
  const driftCfg = {
    amplitude: driftAmplitude,
    cycles: motion.driftCycles ?? 1,
    scale: motion.driftScale ?? 1.2,
    seed: Math.round( pointsCfg.seed ?? 7 ) + 101
  };
  const homes = points.map( ( pt ) => {
    const d = driftAt(
      pt,
      loop,
      driftCfg
    );

    return spinY(
      [
        ( pt.x + d[ 0 ] ) * radius * breatheScale,
        ( pt.y + d[ 1 ] ) * radius * breatheScale,
        ( pt.z + d[ 2 ] ) * radius * breatheScale
      ],
      spinAngle
    );
  } );

  // ── The pull: wells in screen space → chased view-parallel offsets ─────────
  const pullMode = cursorCfg.pull ?? "attract";
  const minSide = Math.min(
    p.width,
    p.height
  );
  const rangePx = Math.max(
    ( cursorCfg.range ?? 0.3 ) * minSide,
    1
  );
  const strengthPx = Math.max(
    ( cursorCfg.strength ?? 0.12 ) * minSide,
    0
  );
  const falloffKey = cursorCfg.falloff ?? "smoothstep";
  const falloff = typeof easing[ falloffKey ] === "function" ? easing[ falloffKey ] : ( x ) => x;
  const speed = clamp(
    cursorCfg.speed ?? 4,
    0.1,
    30
  );
  // At the top of the slider the chase is instantaneous (a pure field); below
  // it, an exponential lag whose response time is 1/speed loop-seconds.
  const chase = speed >= 29.5 ? 1 : 1 - Math.exp( -speed * dt );
  const sign = pullMode === "repel" ? -1 : 1;

  for ( let i = 0; i < points.length; i++ ) {
    const pull = state.pull[ i ];
    let tx = 0;
    let ty = 0;
    let tz = 0;

    if ( pullMode !== "none" && wells.length && strengthPx > 0 ) {
      const home = projectPoint(
        p,
        rig,
        homes[ i ]
      );
      let dx = 0;
      let dy = 0;

      for ( const well of wells ) {
        const wx = well.x - home.x;
        const wy = well.y - home.y;
        const d = Math.hypot(
          wx,
          wy
        );

        if ( d >= rangePx || d < 1e-3 ) {
          continue;
        }

        // Full pull at the centre, nothing at the rim; a point is never pulled
        // PAST the well (the pull caps at the distance itself).
        const w = falloff( 1 - d / rangePx );
        const amount = sign > 0
          ? Math.min(
            strengthPx * w,
            d
          )
          : strengthPx * w;

        dx += wx / d * amount * sign;
        dy += wy / d * amount * sign;
      }

      const mag = Math.hypot(
        dx,
        dy
      );

      if ( mag > strengthPx ) {
        dx *= strengthPx / mag;
        dy *= strengthPx / mag;
      }

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

        tx = world[ 0 ] - homes[ i ][ 0 ];
        ty = world[ 1 ] - homes[ i ][ 1 ];
        tz = world[ 2 ] - homes[ i ][ 2 ];
      }
    }

    pull[ 0 ] += ( tx - pull[ 0 ] ) * chase;
    pull[ 1 ] += ( ty - pull[ 1 ] ) * chase;
    pull[ 2 ] += ( tz - pull[ 2 ] ) * chase;
  }

  const finals = homes.map( (
    home, i
  ) => [
    home[ 0 ] + state.pull[ i ][ 0 ],
    home[ 1 ] + state.pull[ i ][ 1 ],
    home[ 2 ] + state.pull[ i ][ 2 ]
  ] );

  // ── The wave: ranks, envelopes, the capsules to draw ───────────────────────
  const mode = wave.mode ?? "radial-out";
  const rankCtx = {
    seed: Math.round( pointsCfg.seed ?? 7 ),
    jitter: clamp(
      wave.jitter ?? 0,
      0,
      1
    ),
    frequency: Math.max(
      wave.frequency ?? 1.5,
      0.1
    ),
    cursor: cursorUnit
  };
  const ranks = points.map( ( pt ) => rankAt(
    pt,
    mode,
    {
      ...rankCtx,
      id: pt.id
    }
  ) );
  const timings = envelopeTimings( {
    rise: wave.rise ?? 0.25,
    hold: wave.hold ?? 0.2
  } );
  const easeKey = wave.easing ?? "easeInOutCubic";
  const easeFn = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;
  const waves = wave.count ?? 2;
  const spread = clamp(
    wave.spread ?? 1,
    0,
    2
  );
  const hueBy = colors.hueBy ?? "rank";

  const segA = state.segA;
  const segB = state.segB;
  const nodeBump = new Array( points.length ).fill( 0 );
  let segCount = 0;
  let maxReach = 0;

  for ( const link of links ) {
    const ra = ranks[ link.a ];
    const rb = ranks[ link.b ];
    // Walk from the lower rank to the higher: material flows away from the
    // source. Ties keep the lower index first, so the orientation is stable.
    const from = ra <= rb ? link.a : link.b;
    const to = from === link.a ? link.b : link.a;
    const rank = ( ra + rb ) / 2;
    const envelope = envelopeAt(
      wavePhase(
        loop,
        waves,
        rank,
        spread
      ),
      timings,
      easeFn
    );

    if ( swells ) {
      nodeBump[ link.a ] = Math.max(
        nodeBump[ link.a ],
        envelope.bump
      );
      nodeBump[ link.b ] = Math.max(
        nodeBump[ link.b ],
        envelope.bump
      );
    }

    const drawn = linkStateAt(
      effect,
      envelope,
      swell
    );

    if ( !drawn.present || segCount >= MAX_LINKS ) {
      continue;
    }

    const A = finals[ from ];
    const B = finals[ to ];
    const tube = thickness * ( 1 + ( link.u - 0.5 ) * 2 * variation ) * drawn.radius;
    let ident = rank;

    if ( hueBy === "link" ) {
      ident = link.id / Math.max(
        links.length,
        1
      );
    } else if ( hueBy === "node" ) {
      ident = from / Math.max(
        points.length,
        1
      );
    }

    const w = segCount * 4;

    for ( let c = 0; c < 3; c++ ) {
      segA[ w + c ] = A[ c ] + ( B[ c ] - A[ c ] ) * drawn.tail;
      segB[ w + c ] = A[ c ] + ( B[ c ] - A[ c ] ) * drawn.head;
    }

    segA[ w + 3 ] = ident;
    segB[ w + 3 ] = tube;
    segCount++;
  }

  // ── The bulbs ──────────────────────────────────────────────────────────────
  const nodes = state.nodes;
  const nodeCount = nodeFactor > 0 ? points.length : 0;

  for ( let i = 0; i < points.length; i++ ) {
    const f = finals[ i ];
    const bulb = thickness * nodeFactor * ( 1 + ( swells ? swell * 0.6 * nodeBump[ i ] : 0 ) );

    maxReach = Math.max(
      maxReach,
      Math.hypot(
        f[ 0 ],
        f[ 1 ],
        f[ 2 ]
      )
    );

    if ( nodeCount ) {
      nodes[ i * 4 ] = f[ 0 ];
      nodes[ i * 4 + 1 ] = f[ 1 ];
      nodes[ i * 4 + 2 ] = f[ 2 ];
      nodes[ i * 4 + 3 ] = bulb;
    }
  }

  // ── Palette / lighting / render ────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.5 ) * p.TAU * hueSpread );
  // The family's light is a world direction, which an orbiting camera passes
  // behind once per turn — half the loop is then backlit tubes with nothing
  // but rim glow (measured: the lit pixel count roughly halves). `light.follow`
  // rides the light on the camera's yaw so the sculpture stays lit from the
  // same side of the frame all the way round; off, it is the world light.
  const lightDir = lightDirFrom(
    ( light.azimuth ?? -1.1 ) + ( light.follow !== false ? rig.yaw : 0 ),
    light.elevation ?? 0.45
  );

  latticeRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms: {
      uT: loop * p.TAU,
      uSegCount: {
        int: segCount
      },
      uSegA: {
        vec4v: segA
      },
      uSegB: {
        vec4v: segB
      },
      uNodeCount: {
        int: nodeCount
      },
      uNode: {
        vec4v: nodes
      },
      uBoundR: maxReach + maxTube + fusion + 0.05,
      uSmoothK: fusion,
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
      // The look: tube (the material above) or fringe (its rim term alone).
      uLook: {
        int: ( material.look ?? "tube" ) === "fringe" ? 1 : 0
      },
      uFringeWidth: Math.max(
        material.fringeWidth ?? 1,
        0.05
      ),
      uFringeGlow: material.fringeGlow ?? 3,
      uFringeBody: material.fringeBody ?? 0.1,
      uShadowSoft: light.shadowSoftness ?? 0,
      // Fog starts at the front of the sculpture, so the far side fades.
      uFogDensity: camera.fog ?? 0.05,
      uFogStart: rig.dist - fitRadius,
      uMaxDist: rig.dist + fitRadius + 2,
      uAberration: 0
    }
  } );

  // ── Cursor markers (real and virtual), then the optional vision preview ────
  if ( cursorCfg.showCursor !== false && wells.length ) {
    p.push();
    p.noFill();

    wells.forEach( ( well ) => {
      p.stroke(
        255,
        255,
        255,
        well.virtual ? 120 : 220
      );
      p.strokeWeight( well.virtual ? 1.5 : 2 );
      p.circle(
        well.x,
        well.y,
        18
      );

      if ( pullMode !== "none" ) {
        p.stroke(
          255,
          255,
          255,
          well.virtual ? 24 : 40
        );
        p.strokeWeight( 1 );
        p.circle(
          well.x,
          well.y,
          rangePx * 2
        );
      }
    } );

    p.pop();
  }

  drawInteractionCameraPreview( interaction );
} );
