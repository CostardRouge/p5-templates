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
  lightDirFrom
} from "@/p5/utils/braidShader.js";
import {
  cameraBasis,
  cameraUniforms,
  CAMERA_RIG_UNIFORMS_GLSL,
  CAMERA_RIG_MAIN_GLSL
} from "@/p5/utils/cameraRig.js";
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
// sculpt v4 — sphere.
//
// v1's scatter lattice, given a SKIN: a share of the points sits exactly on
// the sphere, on a Fibonacci spiral, and the rest is thrown inside it, so the
// links cross the volume between the two populations and a wave passing
// through the sculpture shows its inside — the sphere reads as a solid, not a
// shell. `points.placement` picks surface, volume or both; the links, the
// wave (rank + envelope), the drift, the breathing, the spin and the cursor
// wells are v1's, from ../_lattice.js and ../_wave.js.
//
// ── What is v4's own ─────────────────────────────────────────────────────────
// • The camera is the shared rig (utils/cameraRig.js): tilt, spin, distance,
//   an eye offset and a look-at target as plain sliders — so the eye is three
//   bindable coordinates — with `fit` framing the sphere on every export
//   aspect. The cursor wells are projected through the same basis.
// • A tube's growing tip TAPERS (`material.taper`): the drawn segment is iq's
//   exact rounded cone, the head cap thinner than the body while the pose
//   travels, a full capsule once it has arrived. The head fraction rides in
//   the hue vec4 (`uSegA.w = identity + 2 · round( 100 · head )`), so the
//   taper costs no uniform.
// • The budget is 72 points and 128 links, both passed to the lattice
//   builders rather than assumed: a skin needs more points than a scatter.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Everything is v1's: the wave is whole cycles per loop and the phase is
// modular, the drift is seeded value noise on a circle, breathing and spin
// are whole cycles, the rig's motion too. The cursor chase is the only state
// and converges to nothing without a pointer, so a headless export closes.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_POINTS = 72; // uniform-array size for the bulbs
const MAX_LINKS = 128; // uniform-array size for the tubes (two vec4 each)
const MAX_STEPS = 96; // sphere-trace iterations per ray

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }
  ${ CAMERA_RIG_UNIFORMS_GLSL }

  // ── The lattice, in world units ──
  uniform int   uSegCount;               // links present this frame
  uniform vec4  uSegA[${ MAX_LINKS }];   // drawn start: xyz + (hue identity + 2·round(100·head))
  uniform vec4  uSegB[${ MAX_LINKS }];   // drawn end: xyz + tube radius in w
  uniform int   uNodeCount;              // bulbs (0 when material.nodes is 0)
  uniform vec4  uNode[${ MAX_POINTS }];  // centre xyz + radius in w
  uniform float uBoundR;                 // bounding sphere around everything
  uniform float uSmoothK;                // smooth-union fillet
  uniform float uTaper;                  // 0..1 thins the growing tip

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

  // Exact rounded cone (iq): a capsule whose two caps have different radii —
  // the tapered tip of a tube still growing. |r1 − r2| is kept below the
  // length so the shape stays a cone rather than one cap swallowing the other
  // (past that the square root goes negative and the tracer reads NaN as
  // "no hit": flickering holes on freshly born tubes).
  float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
    vec3 ba = b - a;
    float l2 = dot(ba, ba);

    if (l2 < 1e-8) { return length(p - a) - max(r1, r2); }

    float len = sqrt(l2);
    float rr = clamp(r1 - r2, -0.95 * len, 0.95 * len);
    float a2 = l2 - rr * rr;
    float il2 = 1.0 / l2;

    vec3 pa = p - a;
    float y = dot(pa, ba);
    float z = y - l2;
    vec3 w = pa * l2 - ba * y;
    float x2 = dot(w, w);
    float y2 = y * y * l2;
    float z2 = z * z * l2;

    float k = sign(rr) * rr * rr * x2;

    if (sign(z) * a2 * z2 > k) { return sqrt(x2 + z2) * il2 - r2; }
    if (sign(y) * a2 * y2 < k) { return sqrt(x2 + y2) * il2 - r1; }

    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
  }

  // Surface distance to one drawn link. The two vec4 come in as arguments: a
  // uniform array may be indexed by a loop counter, never by a function
  // parameter (GLSL ES 1.00).
  float linkDist(vec3 p, vec4 segA, vec4 segB) {
    float r = segB.w;

    if (uTaper <= 0.0) { return segDist3D(p, segA.xyz, segB.xyz) - r; }

    float head = floor(segA.w / 2.0) / 100.0;

    return sdRoundCone(p, segA.xyz, segB.xyz, r, r * (1.0 - uTaper * (1.0 - head)));
  }

  float mapScene(vec3 p) {
    // Rays far from the sculpture skip both loops entirely.
    float bound = length(p) - uBoundR;

    if (bound > 0.3) { return bound; }

    float kn = max(uSmoothK, 1e-4);
    float d = 1e9;

    for (int s = 0; s < ${ MAX_LINKS }; s++) {
      if (s >= uSegCount) { break; }

      d = smin(d, linkDist(p, uSegA[s], uSegB[s]), kn);
    }

    for (int n = 0; n < ${ MAX_POINTS }; n++) {
      if (n >= uNodeCount) { break; }

      d = smin(d, length(p - uNode[n].xyz) - uNode[n].w, kn);
    }

    return d;
  }

  // Hue identity = the nearest link's (its rank, its index or its source node,
  // per colors.hueBy), decoded from under the packed head. A bulb takes the
  // hue of the nearest link, which is one of its own.
  float nearestPipe(vec3 p) {
    float best = 1e9;
    float ident = 0.0;

    for (int s = 0; s < ${ MAX_LINKS }; s++) {
      if (s >= uSegCount) { break; }

      float d = linkDist(p, uSegA[s], uSegB[s]);

      if (d < best) {
        best = d;
        ident = uSegA[s].w - 2.0 * floor(uSegA[s].w / 2.0);
      }
    }

    return ident;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS,
    look: true
  } ) }

  ${ CAMERA_RIG_MAIN_GLSL }
`;

const sphereRenderer = createNoiseFieldRenderer( FRAGMENT );

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

// ── Screen ↔ world through the rig's basis ───────────────────────────────────
// The same basis CAMERA_RIG_MAIN_GLSL traces with, so a world point projects
// to the pixel the shader shades it at — which is what lets the cursor's pull
// and the `cursor` wave source be read off the canvas exactly.

function vDot(
  a, b
) {
  return a[ 0 ] * b[ 0 ] + a[ 1 ] * b[ 1 ] + a[ 2 ] * b[ 2 ];
}

// World point → canvas pixel (+ its view depth along fwd, needed to invert).
function projectPoint(
  p, basis, world
) {
  const v = [
    world[ 0 ] - basis.ro[ 0 ],
    world[ 1 ] - basis.ro[ 1 ],
    world[ 2 ] - basis.ro[ 2 ]
  ];
  const depth = Math.max(
    vDot(
      v,
      basis.fwd
    ),
    0.05
  );

  return {
    x: p.width / 2 + basis.focal * vDot(
      v,
      basis.right
    ) / depth * p.height,
    y: p.height / 2 - basis.focal * vDot(
      v,
      basis.up
    ) / depth * p.height,
    depth
  };
}

// Canvas pixel + view depth → world point (the inverse of projectPoint).
function unprojectPoint(
  p, basis, point, depth
) {
  const x = ( point.x - p.width / 2 ) / p.height * depth / basis.focal;
  const y = ( p.height / 2 - point.y ) / p.height * depth / basis.focal;

  return [
    basis.ro[ 0 ] + basis.right[ 0 ] * x + basis.up[ 0 ] * y + basis.fwd[ 0 ] * depth,
    basis.ro[ 1 ] + basis.right[ 1 ] * x + basis.up[ 1 ] * y + basis.fwd[ 1 ] * depth,
    basis.ro[ 2 ] + basis.right[ 2 ] * x + basis.up[ 2 ] * y + basis.fwd[ 2 ] * depth
  ];
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

// The share of points on the skin for a placement.
function skinShare(
  placement, share
) {
  if ( placement === "surface" ) {
    return 1;
  }

  if ( placement === "volume" ) {
    return 0;
  }

  return clamp(
    share,
    0,
    1
  );
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
  const aberration = o.aberration ?? {};
  const rendering = o.rendering ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  // ── The lattice (memoised on its parameters): a sphere with a skin ─────────
  const lattice = getLattice( {
    count: pointsCfg.count ?? 56,
    seed: Math.round( pointsCfg.seed ?? 7 ),
    spacing: pointsCfg.spacing ?? 0.6,
    volume: "sphere",
    flatten: 1,
    skin: skinShare(
      pointsCfg.placement ?? "both",
      pointsCfg.skin ?? 0.5
    ),
    max: MAX_POINTS,
    neighbours: linksCfg.neighbours ?? 2,
    reach: linksCfg.reach ?? 0.8,
    density: linksCfg.density ?? 1,
    budget: MAX_LINKS
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
    pointsCfg.radius ?? 1.5,
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
    material.thickness ?? 0.05,
    0.005
  );
  const variation = clamp(
    material.variation ?? 0.2,
    0,
    0.9
  );
  const fusion = Math.max(
    material.fusion ?? 0.08,
    0.001
  );
  const nodeFactor = Math.max(
    material.nodes ?? 0.8,
    0
  );
  const taper = clamp(
    material.taper ?? 0.5,
    0,
    1
  );
  const swell = Math.max(
    wave.swell ?? 0.4,
    0
  );
  const effect = wave.effect ?? "grow";
  const swells = effect === "swell" || effect === "grow-swell";
  const maxTube = thickness * ( 1 + variation ) * ( 1 + swell ) * Math.max(
    nodeFactor,
    1
  );
  const driftAmplitude = Math.max(
    motion.drift ?? 0.05,
    0
  );

  // ── Camera: the shared rig, fitted on the sphere's reach ───────────────────
  const fitRadius = radius * ( 1 + breathe ) * ( 1 + driftAmplitude ) + maxTube;
  const basis = cameraBasis(
    camera,
    {
      radius: fitRadius,
      aspect: p.width / Math.max(
        p.height,
        1
      ),
      progression: loop
    }
  );
  // The eye may be offset from its orbit, so the fog and the ray cutoff read
  // the real eye–target distance rather than the rig's nominal one.
  const eyeDist = Math.hypot(
    basis.target[ 0 ] - basis.ro[ 0 ],
    basis.target[ 1 ] - basis.ro[ 1 ],
    basis.target[ 2 ] - basis.ro[ 2 ]
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
      basis,
      wells[ 0 ],
      eyeDist
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
        basis,
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
          basis,
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
    rise: wave.rise ?? 0.3,
    hold: wave.hold ?? 0.1
  } );
  const easeKey = wave.easing ?? "smoothstep";
  const easeFn = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;
  const waves = wave.count ?? 1;
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

    // The head fraction rides above the identity in whole steps of 2, so the
    // shader can peel it off (floor / 2) and keep the identity (mod 2).
    segA[ w + 3 ] = clamp(
      ident,
      0,
      0.999
    ) + 2 * Math.round( clamp(
      drawn.head,
      0,
      1
    ) * 100 );
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
  // v1's rule: the light rides on the camera's spin so an orbit never passes
  // behind it; off, it is the family's world-fixed light.
  const lightDir = lightDirFrom(
    ( light.azimuth ?? -1.1 ) + ( light.follow !== false ? basis.spin : 0 ),
    light.elevation ?? 0.45
  );

  sphereRenderer.render( {
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
      uTaper: taper,
      ...cameraUniforms( basis ),
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
      // Fog starts at the front of the sphere, so the far side sinks into the
      // background — the depth cue that makes the volume read.
      uFogDensity: camera.fog ?? 0.12,
      uFogStart: eyeDist - fitRadius,
      uMaxDist: eyeDist + fitRadius + 2,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
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
