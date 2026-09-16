import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer, {
  easingId
} from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov
} from "@/p5/utils/braidShader.js";
import {
  getLetterField,
  SEG_STRIDE
} from "../_letterField.js";

// ─────────────────────────────────────────────────────────────────────────────
// flip v3 — tube cascade.
//
// v2's board is baked cards on turning quads: the geometry is right but the
// lighting is painted on, so a steeply turned tile reads as a lit decal. v3 is
// the same board raymarched in ONE pass, so it is made of v1's tubes for real —
// the normal is taken from the field at the hit point, so the specular travels
// as a tile turns; the ambient occlusion is computed where the tubes actually
// meet; and a tile seen edge-on shows the thickness it has instead of
// vanishing the way a textured quad does.
//
// ── How a board fits in one SDF ─────────────────────────────────────────────
// The obstacle was never the raymarching, it was the lookup: GLSL ES 1.00
// forbids indexing a uniform array by a uniform-derived index, so a cell
// cannot simply read "its" glyph out of a bank. Three things together make it
// a non-problem:
//
//   1. The quadtree leaf containing a point is found ANALYTICALLY, by walking
//      the same recursion the CPU walks in v2 — at most uMaxDepth iterations
//      of "is this node subdivided at its own beat?". No indirection texture,
//      and the structure stays a pure function of the clock.
//   2. Everything else about a cell — its rank, its beat, its angle, its axis,
//      which face it shows — is COMPUTED from the cell's centre, not stored.
//   3. Only the capsules are left, and they are reached with the standard
//      `for (F) if (F == face)` loop, which runs one inner loop per sample.
//
// The price, and it is the sketch's defining constraint: a cell shows ONE
// GLYPH. `text.glyphs` is a bank of single characters, not a list of words.
// That is what keeps the unrolled budget at 8 x 48 capsules — exactly v1's —
// and it is what a grid wants anyway.
//
// ── The wall clamp, and what it costs ───────────────────────────────────────
// Repeated domains holding DIFFERENT content break sphere tracing: the
// distance to this cell's glyph says nothing about a neighbour's, so a ray can
// step clean through a wall. Every distance is therefore also bounded by the
// distance to the cell's own boundary, which is what makes the trace
// conservative — and what costs the extra steps v1 does not need.
//
// It costs one feature too: CAST SHADOWS ARE OFF and not offered. A shadow ray
// crossing the board meets a near-zero distance at every cell wall, and
// softShadow reads that as an occluder, so the board shades itself black.
// Ambient occlusion survives because its taps stay inside one cell.
//
// ── Everything else is v1 and v2 ────────────────────────────────────────────
// The beat, the -90° restart and the rule that the edge-on frame is the only
// place anything may jump come from ../_shared.js; the subdivision schedule,
// the wavefront and the chaos knobs are v2's, ported to GLSL. The geometry is
// ../_letterField.js, the same builder both other sketches use.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FACES = 8; // glyphs in the bank — 8 x 48 capsules is v1's budget
const MAX_DEPTH = 6; // 2^6 = 64 cells
const MAX_STEPS = 128; // higher than v1: the wall clamp shortens every step
const MAX_SEG = MAX_FACES * SEG_STRIDE;

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  uniform vec3  uCamPos;
  uniform vec3  uCamFwd;
  uniform vec3  uCamRight;
  uniform vec3  uCamUp;

  // ── The glyph bank: one face per cell, ${ SEG_STRIDE } capsules each ──
  uniform int   uFaceCount;
  uniform vec4  uSeg[${ MAX_SEG }];        // (ax, ay, bx, by), normalised
  uniform int   uFaceSegCount[${ MAX_FACES }];
  uniform float uFaceRad;                  // shared bounding radius, so every
                                           // glyph is drawn at one size

  // ── The board ──
  uniform vec2  uBoardHalf;                // world half-extents
  uniform float uGutter;
  uniform float uFill;
  uniform float uTubeR;                    // glyph units
  uniform float uSmoothK;
  uniform float uCellDepth;                // z spread by rank, world
  uniform float uBoardDepth;               // half-depth of the box holding every
                                           // tile at every angle

  // ── Layout ──
  uniform int   uLayoutMode;               // 0 = subdivide, 1 = fixed
  uniform vec2  uFixedGrid;
  uniform float uMaxDepth;
  uniform int   uSchedule;                 // 0 = grow, 1 = pingPong
  uniform float uRate;
  uniform float uScatter;

  // ── Clock and wavefront ──
  uniform float uBeats;
  uniform float uHold;
  uniform int   uFlipEasing;
  uniform float uOvershoot;
  uniform float uSpread;
  uniform float uJitter;
  uniform int   uOrder;                    // 0 all … 6 random
  uniform float uNoiseFreq;
  uniform float uSeed;
  uniform int   uAxisMode;                 // 0 follow, 1 y, 2 x, 3 checker, 4 random
  uniform float uCounterSpin;
  uniform float uRogue;
  uniform int   uContentMode;              // 0 chorus, 1 spell, 2 scatter
  uniform float uContentOffset;

  ${ IRIDESCENT_GLSL }

  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  float segDist2D(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h);
  }

  // Seeded hash — every "random" choice goes through it, so a capture
  // reproduces the same chaos frame for frame.
  float hash2(vec2 v) {
    return fract(sin(dot(floor(v) + uSeed, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash2(i);
    float b = hash2(i + vec2(1.0, 0.0));
    float c = hash2(i + vec2(0.0, 1.0));
    float d = hash2(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Where a cell sits in the turn order.
  float rankAt(vec2 c) {
    float r;

    if (uOrder == 0) { r = 0.0; }
    else if (uOrder == 1) { r = c.x; }
    else if (uOrder == 2) { r = c.y; }
    else if (uOrder == 3) { r = (c.x + c.y) * 0.5; }
    else if (uOrder == 4) { r = min(1.0, length(c - 0.5) / 0.7072); }
    else if (uOrder == 5) { r = valueNoise(c * uNoiseFreq); }
    else { r = hash2(c * 997.0); }

    r += (hash2(c * 733.0 + 17.0) - 0.5) * uJitter * 1.6;

    return clamp(r, 0.0, 1.0);
  }

  // The board's generation at a whole beat: grow climbs and drops back,
  // pingPong climbs and unwinds. Both return to 0 on a period, which is what
  // lets the loop close.
  float generationAt(float beatIndex) {
    float st = floor(beatIndex / uRate);

    if (uSchedule == 0) { return mod(st, uMaxDepth + 1.0); }

    float period = max(1.0, uMaxDepth * 2.0);
    float k = mod(st, period);

    return k <= uMaxDepth ? k : period - k;
  }

  float scatterAt(vec2 c) {
    if (uScatter <= 0.0) { return 0.0; }

    return floor((hash2(c * 613.0 + 3.0) - 0.5) * 2.0 * uScatter * 2.4 + 0.5);
  }

  float shapeTurn(float v) {
    float base = applyEasing(uFlipEasing, v);

    if (uOvershoot <= 0.0) { return base; }

    float c = 1.70158 * uOvershoot;
    float u = v - 1.0;
    float back = 1.0 + (c + 1.0) * u * u * u + c * u * u;

    return base + (back - base) * uOvershoot;
  }

  // One beat: turn runs -1 → 0 → +1 — edge-on, face-on, edge-on.
  void flipBeat(float beats, out float idx, out float turn) {
    idx = floor(beats);

    float u = beats - idx;
    float halfSpan = (1.0 - uHold) * 0.5;

    if (halfSpan <= 1e-6) { turn = 0.0; return; }
    if (u < halfSpan) { turn = shapeTurn(u / halfSpan) - 1.0; return; }
    if (u < halfSpan + uHold) { turn = 0.0; return; }

    turn = shapeTurn((u - halfSpan - uHold) / halfSpan);
  }

  float rogueAt(vec2 c) {
    return hash2(c * 409.0 + 71.0) < uRogue ? 2.0 : 1.0;
  }

  // Walk from the root to the leaf holding uv. Every node decides whether it is
  // subdivided from ITS OWN beat, so a split lands on that node's flat frame —
  // the same recursion v2 runs on the CPU, and the reason no structure has to
  // be uploaded.
  void findCell(vec2 uv, out vec2 lo, out vec2 hi, out float depth) {
    lo = vec2(0.0);
    hi = vec2(1.0);
    depth = 0.0;

    if (uLayoutMode == 1) {
      vec2 n = max(uFixedGrid, vec2(1.0));
      vec2 cell = floor(clamp(uv, 0.0, 0.99999) * n);

      lo = cell / n;
      hi = (cell + 1.0) / n;
      depth = mod(cell.x, 2.0);

      return;
    }

    for (int d = 0; d < ${ MAX_DEPTH }; d++) {
      vec2 c = (lo + hi) * 0.5;
      float idx;
      float turn;

      flipBeat((uBeats - rankAt(c) * uSpread) * rogueAt(c), idx, turn);

      float target = clamp(generationAt(idx) + scatterAt(c), 0.0, uMaxDepth);

      if (float(d) >= target) { break; }

      if (mod(float(d), 2.0) < 0.5) {
        if (uv.x < c.x) { hi.x = c.x; } else { lo.x = c.x; }
      } else {
        if (uv.y < c.y) { hi.y = c.y; } else { lo.y = c.y; }
      }

      depth = float(d) + 1.0;
    }
  }

  float faceIndexOf(vec2 c, float beatIdx) {
    float n = float(uFaceCount);

    if (uContentMode == 0) { return mod(beatIdx, n); }
    if (uContentMode == 1) { return mod(beatIdx + floor(c.y * 64.0) + floor(c.x * 8.0), n); }

    return mod(beatIdx + floor(hash2(c * 251.0 + 13.0) * 64.0 * uContentOffset), n);
  }

  // Distance to one face's capsule chain, in glyph units. The face loop is the
  // workaround for the uniform-index rule: only the matching branch runs.
  float faceDist(float faceIndex, vec2 q, float lz) {
    float best = 1e9;
    float kn = max(uSmoothK, 1e-4);

    for (int F = 0; F < ${ MAX_FACES }; F++) {
      if (F >= uFaceCount) { break; }
      if (abs(float(F) - faceIndex) > 0.5) { continue; }

      int cnt = uFaceSegCount[F];
      float d2 = 1e9;

      for (int s = 0; s < ${ SEG_STRIDE }; s++) {
        if (s >= cnt) { break; }

        vec4 seg = uSeg[F * ${ SEG_STRIDE } + s];

        d2 = smin(d2, segDist2D(q, seg.xy, seg.zw), kn);
      }

      best = sqrt(d2 * d2 + lz * lz) - uTubeR;
    }

    return best;
  }

  // Resolve the cell at a world point and return everything the field and the
  // shading need from it.
  void cellAt(
    vec3 p,
    out vec3 local,
    out float faceIndex,
    out float gscale,
    out float wall,
    out float rank
  ) {
    vec2 board = uBoardHalf * 2.0;
    vec2 uv = p.xy / board + 0.5;
    vec2 lo;
    vec2 hi;
    float depth;

    findCell(clamp(uv, 0.0, 1.0), lo, hi, depth);

    vec2 c = (lo + hi) * 0.5;

    rank = rankAt(c);

    float idx;
    float turn;

    flipBeat((uBeats - rank * uSpread) * rogueAt(c), idx, turn);

    faceIndex = faceIndexOf(c, idx);

    // Which way this cell turns. "follow" ties the turn to the cut that made
    // the cell, so it always flips about the axis it was split along.
    bool horizontal;

    if (uAxisMode == 1) { horizontal = false; }
    else if (uAxisMode == 2) { horizontal = true; }
    else if (uAxisMode == 3) { horizontal = mod(floor(c.x * 8.0) + floor(c.y * 8.0), 2.0) > 0.5; }
    else if (uAxisMode == 4) { horizontal = hash2(c * 131.0 + 9.0) < 0.5; }
    else { horizontal = mod(depth, 2.0) > 0.5; }

    float spin = hash2(c * 311.0 + 1.0) < uCounterSpin ? -1.0 : 1.0;
    float angle = turn * spin * 1.5707963;

    vec2 sizeW = (hi - lo) * board;
    vec3 ctrW = vec3((c - 0.5) * board, uCellDepth * (rank - 0.5));
    vec3 rel = p - ctrW;
    float ca = cos(angle);
    float sa = sin(angle);

    // Inverse of the rotation the tile was given, so the field is evaluated in
    // the tile's own upright frame.
    local = horizontal
      ? vec3(rel.x, ca * rel.y + sa * rel.z, -sa * rel.y + ca * rel.z)
      : vec3(ca * rel.x - sa * rel.z, rel.y, sa * rel.x + ca * rel.z);

    float inner = min(sizeW.x, sizeW.y) * (1.0 - uGutter);

    gscale = max(inner * uFill * 0.5 / max(uFaceRad, 1e-3), 1e-4);

    // Distance to this cell's own walls: the trace may not step past them,
    // because the neighbour holds different content.
    vec2 loW = (lo - 0.5) * board;
    vec2 hiW = (hi - 0.5) * board;

    wall = min(
      min(p.x - loW.x, hiW.x - p.x),
      min(p.y - loW.y, hiW.y - p.y)
    );
  }

  float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;

    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
  }

  float mapScene(vec3 p) {
    // Outside the board, the cell lookup is meaningless — uv clamps to an edge
    // cell whose walls are all BEHIND the point, and a wall clamp on a negative
    // distance reads as an instant hit, which paints the whole frame. So the
    // box that holds every tile at every angle answers first, and the cell
    // logic only ever runs on points inside it.
    vec3 boxHalf = vec3(uBoardHalf, uBoardDepth);
    float outside = sdBox(p, boxHalf);

    // Never below the hit threshold: a ray that lands exactly on the bound
    // gets a distance of ~1e-7 from it, and the tracer reads anything under
    // SURF_EPS as a surface — so the bounding box itself renders as a solid
    // slab. A bound must always leave room to step.
    //
    // The slack is ADDED rather than floored. max(outside, slack) would hold
    // the distance down to the floor everywhere outside, and softShadow reads
    // a small distance as an occluder, so the whole board would shade itself
    // black. Adding overestimates by the slack, which is safe here because the
    // box is only a bound — the content is well inside it.
    if (outside > 0.0) { return outside + 0.0025; }

    vec3 local;
    float faceIndex;
    float gscale;
    float wall;
    float rank;

    cellAt(p, local, faceIndex, gscale, wall, rank);

    float d = faceDist(faceIndex, local.xy / gscale, local.z / gscale) * gscale;

    // The neighbour holds different content, so the trace may not step past
    // this cell's walls. The slack keeps the clamped value above SURF_EPS —
    // without it a ray grazing a wall reports a hit on nothing.
    return min(d, max(wall, 0.0) + 0.0025);
  }

  // Which cell owns the hit — drives the per-cell hue offset (uPipeHueShift).
  float nearestPipe(vec3 p) {
    vec3 local;
    float faceIndex;
    float gscale;
    float wall;
    float rank;

    cellAt(p, local, faceIndex, gscale, wall, rank);

    return rank * 4.0 + faceIndex;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS,
    surfEps: 0.0012
  } ) }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);

    gl_FragColor = traceRay(uCamPos, rd);
  }
`;

const boardRenderer = createNoiseFieldRenderer( FRAGMENT );

const ORDERS = [
  "all",
  "columns",
  "rows",
  "diagonal",
  "radial",
  "noise",
  "random"
];
const AXES = [
  "follow",
  "y",
  "x",
  "checker",
  "random"
];
const CONTENT = [
  "chorus",
  "spell",
  "scatter"
];

// Per-instance scratch: the bank packed for the shader. Module-level typed
// arrays would be one set shared by the page and every "sketch" layer.
const state = sketch.state( () => ( {
  seg: new Float32Array( MAX_SEG * 4 ),
  segCount: new Int32Array( MAX_FACES )
} ) );

function indexIn(
  list, value, fallback
) {
  const at = list.indexOf( value );

  return at < 0 ? fallback : at;
}

function gcd(
  a, b
) {
  return b === 0 ? a : gcd(
    b,
    a % b
  );
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const layout = o.layout ?? {};
  const flip = o.flip ?? {};
  const wave = o.wave ?? {};
  const content = o.content ?? {};
  const cell = o.cell ?? {};
  const material = o.material ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const camera = o.camera ?? {};
  const rendering = o.rendering ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  // ── The bank: one glyph per face ──────────────────────────────────────────
  const glyphs = ( textCfg.glyphs ?? "abcd" )
    .toString()
    .split( "" )
    .filter( ( char ) => char.trim().length > 0 )
    .slice(
      0,
      MAX_FACES
    );

  if ( !glyphs.length ) {
    return;
  }

  const fields = glyphs.map( ( char ) => getLetterField( {
    text: char,
    fontName: textCfg.font ?? "martian",
    sampleFactor: textCfg.detail ?? 0.6,
    simplifyThreshold: textCfg.simplify ?? 0,
    contourBreak: 0.2,
    spacing: textCfg.spacing ?? 0.06
  } ) );

  // Font still loading, or a character with no outline — wait rather than show
  // a board with holes in it.
  if ( fields.some( ( field ) => !field ) ) {
    return;
  }

  const seg = state.seg;
  const segCount = state.segCount;

  let faceRadius = 0;

  for ( let f = 0; f < fields.length; f++ ) {
    const field = fields[ f ];
    const count = field.segCount[ 0 ];

    // Every face is the field's first (and only) letter, already centred on
    // its own bounding box by the builder.
    seg.set(
      field.seg.subarray(
        0,
        count * 4
      ),
      f * SEG_STRIDE * 4
    );
    segCount[ f ] = count;
    faceRadius = Math.max(
      faceRadius,
      field.radius[ 0 ]
    );
  }

  for ( let f = fields.length; f < MAX_FACES; f++ ) {
    segCount[ f ] = 0;
  }

  const faceCount = fields.length;

  // ── The clock ─────────────────────────────────────────────────────────────
  const t = animation.angle;
  const loopProgress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const progress = ( wave.headMode ?? "clock" ) === "manual"
    ? Math.max(
      0,
      Math.min(
        wave.head ?? 0,
        1
      )
    )
    : loopProgress;

  const subdividing = ( layout.mode ?? "subdivide" ) === "subdivide";
  const depth = Math.max(
    0,
    Math.min(
      Math.round( layout.depth ?? 4 ),
      MAX_DEPTH
    )
  );
  const rate = Math.max(
    1,
    Math.round( layout.rate ?? 1 )
  );
  const grow = ( layout.schedule ?? "pingPong" ) === "grow";

  // Beats per loop: the generation returns to 0 every `period` beats and the
  // face cycle every `faceCount`, so the loop closes on their least common
  // multiple. Snapped here rather than left to the user.
  const period = subdividing
    ? rate * ( grow ? depth + 1 : Math.max(
      1,
      depth * 2
    ) )
    : 1;
  const beatsPerPass = period * faceCount / gcd(
    period,
    faceCount
  );
  const cycles = Math.max(
    1,
    Math.round( flip.cycles ?? 1 )
  );
  const beats = progress * beatsPerPass * cycles;

  // ── Board and camera ──────────────────────────────────────────────────────
  const aspect = p.width / Math.max(
    p.height,
    1
  );
  const fov = camera.fov ?? 45;
  const focal = focalFromFov( fov );
  const margin = Math.max(
    0,
    Math.min(
      camera.margin ?? 0.08,
      0.6
    )
  );
  const boardHalfY = 1;
  const boardHalfX = aspect;

  // A plane of half-height 1 exactly fills the frame at 2 x focal.
  const distance = 2 * focal * ( 1 + margin ) * ( camera.pullBack ?? 1 );
  const azimuth = camera.azimuth ?? 0;
  const elevation = camera.elevation ?? 0;
  const cosE = Math.cos( elevation );

  const camPos = [
    distance * cosE * Math.sin( azimuth ),
    distance * Math.sin( elevation ),
    -distance * cosE * Math.cos( azimuth )
  ];
  const len = Math.hypot(
    camPos[ 0 ],
    camPos[ 1 ],
    camPos[ 2 ]
  ) || 1;
  const fwd = [
    -camPos[ 0 ] / len,
    -camPos[ 1 ] / len,
    -camPos[ 2 ] / len
  ];
  const rightRaw = [
    fwd[ 2 ],
    0,
    -fwd[ 0 ]
  ];
  const rightLen = Math.hypot(
    rightRaw[ 0 ],
    rightRaw[ 2 ]
  ) || 1;
  const right = [
    rightRaw[ 0 ] / rightLen,
    0,
    rightRaw[ 2 ] / rightLen
  ];
  const up = [
    fwd[ 1 ] * right[ 2 ] - fwd[ 2 ] * right[ 1 ],
    fwd[ 2 ] * right[ 0 ] - fwd[ 0 ] * right[ 2 ],
    fwd[ 0 ] * right[ 1 ] - fwd[ 1 ] * right[ 0 ]
  ];

  const cellDepth = ( cell.depth ?? 0 ) * boardHalfY;
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0 ) * hueSpread );

  boardRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms: {
      uT: progress * p.TAU,
      uCamPos: camPos,
      uCamFwd: fwd,
      uCamRight: right,
      uCamUp: up,
      uFocal: focal,

      uFaceCount: {
        int: faceCount
      },
      uSeg: {
        vec4v: seg
      },
      uFaceSegCount: {
        intv: segCount
      },
      uFaceRad: faceRadius,

      uBoardHalf: [
        boardHalfX,
        boardHalfY
      ],
      uGutter: Math.max(
        0,
        Math.min(
          cell.gutter ?? 0.08,
          0.9
        )
      ),
      uFill: Math.max(
        cell.fill ?? 0.86,
        0.05
      ),
      uTubeR: Math.max(
        material.tube ?? 0.05,
        0.002
      ),
      uSmoothK: Math.max(
        material.fusion ?? 0.03,
        0.001
      ),
      uCellDepth: cellDepth,
      // A tile turned 90° reaches half its own width in z, and the widest tile
      // is the whole board at generation 0.
      uBoardDepth: Math.max(
        boardHalfX,
        boardHalfY
      ) + Math.abs( cellDepth ) * 0.5 + 0.05,

      uLayoutMode: {
        int: subdividing ? 0 : 1
      },
      uFixedGrid: [
        Math.max(
          1,
          Math.round( layout.columns ?? 4 )
        ),
        Math.max(
          1,
          Math.round( layout.rows ?? 3 )
        )
      ],
      uMaxDepth: depth,
      uSchedule: {
        int: grow ? 0 : 1
      },
      uRate: rate,
      uScatter: Math.max(
        0,
        Math.min(
          layout.scatter ?? 0.35,
          1
        )
      ),

      uBeats: beats,
      uHold: Math.max(
        0,
        Math.min(
          flip.hold ?? 0.15,
          0.95
        )
      ),
      uFlipEasing: easingId( flip.easing ?? "easeInOutCubic" ),
      uOvershoot: Math.max(
        0,
        Math.min(
          flip.overshoot ?? 0.4,
          1
        )
      ),
      uSpread: Math.max(
        0,
        Math.min(
          wave.spread ?? 0.55,
          2
        )
      ),
      uJitter: Math.max(
        0,
        Math.min(
          wave.jitter ?? 0.2,
          1
        )
      ),
      uOrder: {
        int: indexIn(
          ORDERS,
          wave.order ?? "radial",
          4
        )
      },
      uNoiseFreq: Math.max(
        1,
        Math.round( wave.frequency ?? 4 )
      ),
      uSeed: Math.round( wave.seed ?? 7 ),
      uAxisMode: {
        int: indexIn(
          AXES,
          flip.axis ?? "follow",
          0
        )
      },
      uCounterSpin: Math.max(
        0,
        Math.min(
          flip.counterSpin ?? 0.2,
          1
        )
      ),
      uRogue: Math.max(
        0,
        Math.min(
          flip.rogue ?? 0.06,
          0.5
        )
      ),
      uContentMode: {
        int: indexIn(
          CONTENT,
          content.mode ?? "scatter",
          2
        )
      },
      uContentOffset: Math.max(
        0,
        content.offset ?? 1
      ),

      uHueSpeed: hueSpread ? hueCycles / hueSpread : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.25,
      uPipeHueShift: colors.cellHueShift ?? 0.7,
      uShimmer: colors.shimmer ?? 2.2,
      uSaturation: colors.saturation ?? 0.9,
      uBrightness: colors.brightness ?? 1.25,

      uLightDir: lightDirFrom(
        light.azimuth ?? -1.1,
        light.elevation ?? 0.45
      ),
      uAmbient: light.ambient ?? 0.48,
      uDiffuse: light.diffuse ?? 0.56,
      uSpecular: light.specular ?? 1.52,
      uSpecPower: light.specPower ?? 31,
      uFresnelPower: light.fresnelPower ?? 1.62,
      uRimStrength: light.rimStrength ?? 0,
      // Always off, and not offered as an option. softShadow estimates its
      // penumbra as uShadowSoft * d / t, and the wall clamp that makes a
      // repeated domain safe to trace hands it a near-zero d at every cell
      // boundary — so a shadow ray crossing the board reads every wall as an
      // occluder and the whole thing goes black (measured: 100% of the lit
      // pixels darkening by an average of 122/255). Cast shadows here need a
      // second, unclamped distance function for the shadow ray, which
      // braidShadingGlsl does not take.
      uShadowSoft: 0,
      uFogDensity: camera.fog ?? 0,
      uFogStart: distance - boardHalfX - Math.abs( cellDepth ),
      uMaxDist: distance + boardHalfX * 2 + Math.abs( cellDepth ) * 2 + 2
    }
  } );
} );
