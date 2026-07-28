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
  hashedRandom
} from "@/p5/utils/letterPaths.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov
} from "@/p5/utils/braidShader.js";
import easing from "@/p5/utils/easing.js";

// ─────────────────────────────────────────────────────────────────────────────
// rings v5 — constellation.
//
// The letters of v2, unchained from the circuit: each glyph floats at its own
// SCATTERED position in a 3D cloud — radius, height and angular slot all
// jittered by a seeded hash — and the camera flies a closed Catmull-Rom spline
// threaded through every letter in word order, weaving through the
// constellation and passing through each glyph's open gap. A `scatter` of 0
// collapses the cloud back to a tidy v2-style circuit; turning it up (and the
// seed) shuffles the word into space.
//
// ── Geometry ─────────────────────────────────────────────────────────────────
// Identical letter pipeline to v2: textToPoints → splitContours →
// resampleContour, capsule chains fused with a polynomial smooth-minimum, each
// glyph recentred on its largest-empty-circle (the pole of inaccessibility of
// its outline) and the tube radius capped against the tightest gap — so the
// flight path always threads an opening, never a stroke.
//
// ── Placement / path ─────────────────────────────────────────────────────────
// Letter k keeps its angular SLOT around the loop (so the visiting order stays
// the word order and the spline never has to double back), but inside that slot
// the seeded hash jitters its azimuth, pushes its radius in or out, and lifts
// it up or down. The camera path is a closed uniform Catmull-Rom through the
// scattered centres — C1-smooth, passing exactly through every gap — and each
// letter's plane faces the spline tangent at its own position, so every glyph
// is read head-on during its approach and then flown through.
//
// ── Camera / loop ────────────────────────────────────────────────────────────
// Flow/Ease motion lifted from v2, driven along the spline instead of the
// parametric circle: Flow glides with a look-ahead, Ease settles into each
// letter (gaze easing onto the next centre) with the family's easing/glide
// knobs, and both bank into turns. One spline lap per loop and hue scroll in
// whole periods keep uT = TAU equal to uT = 0.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LETTERS = 8; // letters rendered (word is truncated past this)
const SEG_STRIDE = 48; // capsules stored per letter (fixed stride: GLSL ES 1.00
// forbids indexing a uniform array by a uniform-derived index, so each letter
// occupies a fixed [L*STRIDE, L*STRIDE+count) slice indexed by loop vars only)
const MAX_TOTAL_SEG = MAX_LETTERS * SEG_STRIDE; // flat capsule array size
const MAX_STEPS = 96; // sphere-trace iterations per ray
const BUILD_SIZE = 100; // glyph sampling size; geometry normalised by it

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Letter field (normalised glyph space; per-letter plane in world) ──
  uniform int   uLetterCount;
  uniform vec3  uLetCtr[${ MAX_LETTERS }];   // letter centre (gap) in world
  uniform vec3  uLetRt[${ MAX_LETTERS }];    // in-plane right (unit)
  uniform vec3  uLetUp[${ MAX_LETTERS }];    // in-plane up (unit)
  uniform float uLetRad[${ MAX_LETTERS }];   // bounding radius (normalised)
  uniform int   uLetSegCount[${ MAX_LETTERS }]; // valid capsules in this letter's slice
  uniform vec4  uSeg[${ MAX_TOTAL_SEG }];    // (ax, ay, bx, by) normalised capsules, ${ SEG_STRIDE }/letter
  uniform float uLetScale;                   // world size of one glyph unit
  uniform float uTubeR;                       // tube radius (world)
  uniform float uSmoothK;                     // smooth-union fillet (world)

  ${ IRIDESCENT_GLSL }

  // Polynomial smooth-minimum (iq): melts nearby capsules into a rounded fillet.
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) - k * h * (1.0 - h);
  }

  // Distance from a 2D point to segment a→b (round-capped capsule axis).
  float segDist2D(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);

    return length(pa - ba * h);
  }

  // Exact distance to a flat disc of radius R in the plane (for cheap culling).
  float discBound(vec2 q, float lz, float r) {
    float radial = max(length(q) - r, 0.0);

    return sqrt(radial * radial + lz * lz);
  }

  // All maths runs in normalised glyph space; the result is scaled to world at
  // the end (every letter shares uLetScale). uLetRad, uSeg are normalised;
  // uTubeR / uSmoothK are world, converted with inv = 1 / uLetScale.
  float mapScene(vec3 p) {
    float best = 1e9;
    float inv = 1.0 / max(uLetScale, 1e-4);
    float tubeRn = uTubeR * inv;
    float kn = max(uSmoothK * inv, 1e-4);

    for (int L = 0; L < ${ MAX_LETTERS }; L++) {
      if (L >= uLetterCount) { break; }

      vec3 rel = p - uLetCtr[L];
      vec3 rt = uLetRt[L];
      vec3 up = uLetUp[L];
      vec3 nrm = cross(rt, up);
      float lz = dot(rel, nrm) * inv;
      vec2 q = vec2(dot(rel, rt), dot(rel, up)) * inv;

      float bound = discBound(q, lz, uLetRad[L]) - tubeRn - kn;

      if (bound > 0.3) { best = min(best, bound); continue; }

      int cnt = uLetSegCount[L];
      float d2 = 1e9;

      for (int s = 0; s < ${ SEG_STRIDE }; s++) {
        if (s >= cnt) { break; }

        vec4 seg = uSeg[L * ${ SEG_STRIDE } + s];

        d2 = smin(d2, segDist2D(q, seg.xy, seg.zw), kn);
      }

      best = min(best, sqrt(d2 * d2 + lz * lz) - tubeRn);
    }

    return best * uLetScale;
  }

  // Which letter owns the hit — drives the per-letter hue offset (uPipeHueShift).
  float nearestPipe(vec3 p) {
    float best = 1e9;
    float bestL = 0.0;
    float inv = 1.0 / max(uLetScale, 1e-4);
    float tubeRn = uTubeR * inv;
    float kn = max(uSmoothK * inv, 1e-4);

    for (int L = 0; L < ${ MAX_LETTERS }; L++) {
      if (L >= uLetterCount) { break; }

      vec3 rel = p - uLetCtr[L];
      vec3 rt = uLetRt[L];
      vec3 up = uLetUp[L];
      vec3 nrm = cross(rt, up);
      float lz = dot(rel, nrm) * inv;
      vec2 q = vec2(dot(rel, rt), dot(rel, up)) * inv;

      float bound = discBound(q, lz, uLetRad[L]) - tubeRn - kn;

      if (bound > 0.3) {
        if (bound < best) { best = bound; bestL = float(L); }
        continue;
      }

      int cnt = uLetSegCount[L];
      float d2 = 1e9;

      for (int s = 0; s < ${ SEG_STRIDE }; s++) {
        if (s >= cnt) { break; }

        vec4 seg = uSeg[L * ${ SEG_STRIDE } + s];

        d2 = smin(d2, segDist2D(q, seg.xy, seg.zw), kn);
      }

      float tube = sqrt(d2 * d2 + lz * lz) - tubeRn;

      if (tube < best) { best = tube; bestL = float(L); }
    }

    return bestL;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  // First-person camera fed by CPU look-at basis (same as rings v2).
  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);

    gl_FragColor = traceRay(uCamPos, rd);
  }
`;

// The camera basis uniforms this sketch feeds (not in BRAID_UNIFORMS_GLSL).
const CAMERA_UNIFORMS = `
  uniform vec3 uCamPos;
  uniform vec3 uCamFwd;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
`;

const constellationRenderer = createNoiseFieldRenderer( CAMERA_UNIFORMS + FRAGMENT );

// ── Vector helpers (arrays as [x, y, z]) ─────────────────────────────────────
function sub(
  a, b
) {
  return [
    a[ 0 ] - b[ 0 ],
    a[ 1 ] - b[ 1 ],
    a[ 2 ] - b[ 2 ]
  ];
}

function cross(
  a, b
) {
  return [
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
  ];
}

function normalize( v ) {
  const l = Math.hypot(
    v[ 0 ],
    v[ 1 ],
    v[ 2 ]
  );

  return l > 1e-6
    ? [
      v[ 0 ] / l,
      v[ 1 ] / l,
      v[ 2 ] / l
    ]
    : [
      1,
      0,
      0
    ];
}

function lerp3(
  a, b, t
) {
  return [
    a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t,
    a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t,
    a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t
  ];
}

// Distance from a 2D point to a segment (CPU mirror of segDist2D, for the
// largest-empty-circle search).
function segDist2D(
  px, py, ax, ay, bx, by
) {
  const bax = bx - ax;
  const bay = by - ay;
  const pax = px - ax;
  const pay = py - ay;
  const denom = bax * bax + bay * bay || 1e-6;
  const h = Math.max(
    0,
    Math.min(
      1,
      ( pax * bax + pay * bay ) / denom
    )
  );

  return Math.hypot(
    pax - bax * h,
    pay - bay * h
  );
}

// ── Letter geometry (built once per text/font/detail, memoised) ──────────────
const geometryMemo = new Map();
const GEOMETRY_MEMO_MAX = 12;

// Build the flat capsule field for a word: per-letter normalised segments,
// each glyph recentred on its largest-empty-circle (so the flight path threads
// an open gap), plus per-letter bounding radius and open-gap radius. Identical
// to rings-v2-letters.
function buildLetterField( {
  text,
  fontName,
  sampleFactor,
  simplifyThreshold,
  contourBreak,
  spacing
} ) {
  const p = getP5();
  const font = string.fonts[ fontName ] ?? string.fonts.sans;

  // p5 v2: glyph data readiness lives on `font.data` (was `font.font`).
  if ( !font?.data || !text.length ) {
    return null;
  }

  p.push();
  p.textFont( font );
  p.textSize( BUILD_SIZE );

  const breakDistance = contourBreak * BUILD_SIZE;
  const sampleStep = Math.max(
    1,
    spacing * BUILD_SIZE
  );
  const seg = new Float32Array( MAX_TOTAL_SEG * 4 );
  const segCount = new Int32Array( MAX_LETTERS );
  const radius = new Float32Array( MAX_LETTERS );
  const gapRadius = new Float32Array( MAX_LETTERS );

  let letterIndex = 0;
  let truncated = false;

  for ( const char of text ) {
    if ( letterIndex >= MAX_LETTERS ) {
      truncated = true;
      break;
    }

    if ( char.trim() === "" ) {
      continue;
    }

    // p5 v2: textToPoints reads the size from the renderer state set
    // above; a 4th positional number would be treated as a wrap width.
    const raw = font.textToPoints(
      char,
      0,
      0,
      {
        sampleFactor,
        simplifyThreshold,
        graphics: p
      }
    );

    if ( !raw.length ) {
      continue;
    }

    const contours = splitContours(
      raw,
      breakDistance
    )
      .map( ( pts ) => resampleContour(
        pts,
        sampleStep,
        true
      ) )
      .filter( ( pts ) => pts.length >= 2 );

    if ( !contours.length ) {
      continue;
    }

    // Bounding box of the glyph (build space).
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for ( const contour of contours ) {
      for ( const pt of contour ) {
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
    }

    // Largest-empty-circle: the point in the glyph bbox farthest from every
    // outline segment. The camera threads THIS, so it never hits a stroke.
    let gapX = ( minX + maxX ) / 2;
    let gapY = ( minY + maxY ) / 2;
    let gapDist = -1;
    const GRID = 22;

    for ( let gy = 0; gy <= GRID; gy++ ) {
      for ( let gx = 0; gx <= GRID; gx++ ) {
        const sx = minX + ( ( maxX - minX ) * gx ) / GRID;
        const sy = minY + ( ( maxY - minY ) * gy ) / GRID;

        let nearest = Infinity;

        for ( const contour of contours ) {
          const m = contour.length;

          for ( let i = 0; i < m; i++ ) {
            const a = contour[ i ];
            const b = contour[ ( i + 1 ) % m ];
            const d = segDist2D(
              sx,
              sy,
              a.x,
              a.y,
              b.x,
              b.y
            );

            if ( d < nearest ) {
              nearest = d;
            }
          }
        }

        if ( nearest > gapDist ) {
          gapDist = nearest;
          gapX = sx;
          gapY = sy;
        }
      }
    }

    // Emit normalised capsules into this letter's fixed stride slice (recentred
    // on the gap, y flipped to point up, divided by BUILD_SIZE so a glyph unit ≈
    // cap height). The base offset is letterIndex * SEG_STRIDE.
    const base = letterIndex * SEG_STRIDE;
    let local = 0;
    let maxR = 0;

    for ( const contour of contours ) {
      const m = contour.length;

      for ( let i = 0; i < m; i++ ) {
        if ( local >= SEG_STRIDE ) {
          truncated = true;
          break;
        }

        const a = contour[ i ];
        const b = contour[ ( i + 1 ) % m ];
        const ax = ( a.x - gapX ) / BUILD_SIZE;
        const ay = -( a.y - gapY ) / BUILD_SIZE;
        const bx = ( b.x - gapX ) / BUILD_SIZE;
        const by = -( b.y - gapY ) / BUILD_SIZE;
        const w = ( base + local ) * 4;

        seg[ w ] = ax;
        seg[ w + 1 ] = ay;
        seg[ w + 2 ] = bx;
        seg[ w + 3 ] = by;
        local++;

        maxR = Math.max(
          maxR,
          Math.hypot(
            ax,
            ay
          ),
          Math.hypot(
            bx,
            by
          )
        );
      }
    }

    if ( local === 0 ) {
      continue;
    }

    segCount[ letterIndex ] = local;
    radius[ letterIndex ] = maxR;
    gapRadius[ letterIndex ] = gapDist / BUILD_SIZE;
    letterIndex++;
  }

  p.pop();

  if ( letterIndex === 0 ) {
    return null;
  }

  if ( truncated ) {
    console.warn( `rings-v5-constellation: word truncated to ${ letterIndex } letters (max ${ MAX_LETTERS }, ${ SEG_STRIDE } capsules/letter). Use a shorter word or raise the capsule spacing.` );
  }

  return {
    count: letterIndex,
    seg,
    segCount,
    radius,
    gapRadius
  };
}

function getLetterField( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;
  const fontFamily = font?.name || font?.face?.family || "unknown";
  const key = [
    cfg.text,
    fontFamily,
    cfg.sampleFactor,
    cfg.simplifyThreshold,
    cfg.contourBreak,
    cfg.spacing
  ].join( "|" );

  const cached = geometryMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const field = buildLetterField( cfg );

  // Font still loading → don't cache the null, retry next frame.
  if ( !field ) {
    return null;
  }

  geometryMemo.set(
    key,
    field
  );

  if ( geometryMemo.size > GEOMETRY_MEMO_MAX ) {
    geometryMemo.delete( geometryMemo.keys().next().value );
  }

  return field;
}

// ── Scattered placement + closed Catmull-Rom flight path ─────────────────────
// Letter k keeps its angular slot (word order = visiting order, so the spline
// stays sane) but the seeded hash jitters azimuth within the slot, radius in
// and out, and height up and down. scatter 0 → a tidy circle, 1 → a wild cloud.
function scatterCentres( {
  count,
  seed,
  spread,
  scatter,
  height
} ) {
  const centres = [];

  for ( let k = 0; k < count; k++ ) {
    const jAzimuth = hashedRandom( seed * 97 + k * 3 ) - 0.5;
    const jRadius = hashedRandom( seed * 97 + k * 3 + 1 ) - 0.5;
    const jHeight = hashedRandom( seed * 97 + k * 3 + 2 ) - 0.5;

    const a = ( Math.PI * 2 * k ) / count
      + scatter * jAzimuth * ( ( Math.PI * 2 ) / count ) * 0.9;
    const r = spread * ( 1 + scatter * jRadius * 1.2 );
    const y = height * jHeight * 2;

    centres.push( [
      r * Math.sin( a ),
      y,
      -r * Math.cos( a )
    ] );
  }

  return centres;
}

// Closed uniform Catmull-Rom through the centres: s in [0, count) with wrap,
// C1-smooth, interpolating every centre (the camera passes exactly through
// each letter's gap).
function splineAt(
  centres, s
) {
  const n = centres.length;
  const w = ( ( s % n ) + n ) % n;
  const i = Math.floor( w );
  const t = w - i;

  const p0 = centres[ ( i - 1 + n ) % n ];
  const p1 = centres[ i % n ];
  const p2 = centres[ ( i + 1 ) % n ];
  const p3 = centres[ ( i + 2 ) % n ];

  const t2 = t * t;
  const t3 = t2 * t;
  const out = [
    0,
    0,
    0
  ];

  for ( let c = 0; c < 3; c++ ) {
    out[ c ] = 0.5 * (
      2 * p1[ c ]
      + ( p2[ c ] - p0[ c ] ) * t
      + ( 2 * p0[ c ] - 5 * p1[ c ] + 4 * p2[ c ] - p3[ c ] ) * t2
      + ( 3 * p1[ c ] - p0[ c ] - 3 * p2[ c ] + p3[ c ] ) * t3
    );
  }

  return out;
}

function splineTangent(
  centres, s
) {
  return normalize( sub(
    splineAt(
      centres,
      s + 0.01
    ),
    splineAt(
      centres,
      s - 0.01
    )
  ) );
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const material = o.material ?? {};
  const constellation = o.constellation ?? {};
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

  const field = getLetterField( {
    text: ( textCfg.value ?? "stellar" ).toString(),
    fontName: textCfg.font ?? "martian",
    sampleFactor: textCfg.detail ?? 0.25,
    simplifyThreshold: textCfg.simplify ?? 0,
    contourBreak: 0.2,
    spacing: textCfg.spacing ?? 0.04
  } );

  // Font still loading (or empty text) — background only until it resolves.
  if ( !field ) {
    return;
  }

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;
  const count = field.count;

  // ── Material (tube) ────────────────────────────────────────────────────────
  const letterScale = Math.max(
    material.size ?? 2.1,
    0.1
  );

  // Cap the tube against the tightest open gap so every letter stays threadable
  // (min gap radius across letters, in world units).
  let minGapWorld = Infinity;

  for ( let k = 0; k < count; k++ ) {
    minGapWorld = Math.min(
      minGapWorld,
      field.gapRadius[ k ] * letterScale
    );
  }

  const tubeR = Math.min(
    material.thickness ?? 0.03,
    Math.max(
      minGapWorld * 0.6,
      0.02
    )
  );
  const smoothK = Math.max(
    material.fusion ?? 0.2,
    0.001
  );

  // ── Scattered constellation + spline ───────────────────────────────────────
  const spread = constellation.spread ?? 3.5;
  const scatter = Math.max(
    0,
    Math.min(
      constellation.scatter ?? 0.7,
      1
    )
  );
  const height = constellation.height ?? 1.2;

  const centres = scatterCentres( {
    count,
    seed: Math.max(
      1,
      Math.round( constellation.seed ?? 7 )
    ),
    spread,
    scatter,
    height
  } );

  const uniforms = {
    uT: t,
    uLetterCount: {
      int: count
    },
    uSeg: {
      vec4v: field.seg
    },
    uLetSegCount: {
      intv: field.segCount
    },
    uLetRad: {
      floatv: field.radius
    },
    uLetScale: letterScale,
    uTubeR: tubeR,
    uSmoothK: smoothK
  };

  for ( let k = 0; k < count; k++ ) {
    // Plane ⟂ the spline tangent at the letter's own position, so each glyph is
    // read head-on during its approach and then flown through.
    const tangent = splineTangent(
      centres,
      k
    );
    const right = normalize( cross(
      [
        0,
        1,
        0
      ],
      tangent
    ) );
    const up = cross(
      tangent,
      right
    );

    uniforms[ `uLetCtr[${ k }]` ] = centres[ k ];
    uniforms[ `uLetRt[${ k }]` ] = right;
    uniforms[ `uLetUp[${ k }]` ] = up;
  }

  // ── Camera: one spline lap per loop, Flow (smooth) or Ease (per-letter) ────
  const motion = camera.motion ?? "flow";
  const bank = camera.bank ?? 0.4;

  const progress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const s = progress * count;

  let camPos;
  let fwd;
  let roll = 0;

  if ( motion === "flow" ) {
    const ahead = Math.max(
      camera.lookAhead ?? 0.9,
      0.2
    );

    camPos = splineAt(
      centres,
      s
    );
    fwd = normalize( sub(
      splineAt(
        centres,
        s + ahead
      ),
      camPos
    ) );

    if ( bank !== 0 ) {
      const before = normalize( sub(
        camPos,
        splineAt(
          centres,
          s - 0.5
        )
      ) );
      const after = normalize( sub(
        splineAt(
          centres,
          s + 0.5
        ),
        camPos
      ) );

      roll = bank * Math.atan2(
        before[ 0 ] * after[ 2 ] - before[ 2 ] * after[ 0 ],
        before[ 0 ] * after[ 0 ] + before[ 2 ] * after[ 2 ]
      );
    }
  } else {
    const glide = Math.max(
      0,
      Math.min(
        camera.glide ?? 0.85,
        1
      )
    );
    const easeKey = camera.easing ?? "easeInOutCubic";
    const easeFn = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;

    const seg = Math.min(
      Math.floor( s ),
      count - 1
    );
    const u = s - seg;
    const ue = u + ( easeFn( u ) - u ) * glide;

    camPos = splineAt(
      centres,
      seg + ue
    );

    const target = lerp3(
      centres[ ( seg + 1 ) % count ],
      centres[ ( seg + 2 ) % count ],
      ue
    );

    fwd = normalize( sub(
      target,
      camPos
    ) );

    if ( bank !== 0 ) {
      const turnAt = ( i ) => {
        const prev = centres[ ( i - 1 + count ) % count ];
        const here = centres[ i % count ];
        const next = centres[ ( i + 1 ) % count ];
        const v1 = normalize( sub(
          here,
          prev
        ) );
        const v2 = normalize( sub(
          next,
          here
        ) );

        return Math.atan2(
          v1[ 0 ] * v2[ 2 ] - v1[ 2 ] * v2[ 0 ],
          v1[ 0 ] * v2[ 0 ] + v1[ 2 ] * v2[ 2 ]
        );
      };

      roll = bank * ( turnAt( seg + 1 ) + ( turnAt( seg + 2 ) - turnAt( seg + 1 ) ) * ue );
    }
  }

  let right = normalize( cross(
    [
      0,
      1,
      0
    ],
    fwd
  ) );
  let up = cross(
    fwd,
    right
  );

  if ( roll !== 0 ) {
    const cr = Math.cos( roll );
    const sr = Math.sin( roll );
    const rolledRight = [
      right[ 0 ] * cr + up[ 0 ] * sr,
      right[ 1 ] * cr + up[ 1 ] * sr,
      right[ 2 ] * cr + up[ 2 ] * sr
    ];

    up = [
      up[ 0 ] * cr - right[ 0 ] * sr,
      up[ 1 ] * cr - right[ 1 ] * sr,
      up[ 2 ] * cr - right[ 2 ] * sr
    ];
    right = rolledRight;
  }

  // ── Palette / lighting ─────────────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );

  const fov = camera.fov ?? 90;
  const maxRadius = spread * ( 1 + scatter * 0.6 );
  const maxDist = 2 * maxRadius + 2 * Math.abs( height ) + letterScale + 2;

  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.45
  );

  Object.assign(
    uniforms,
    {
      uCamPos: camPos,
      uCamFwd: fwd,
      uCamRight: right,
      uCamUp: up,
      uFocal: focalFromFov( fov ),
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.25,
      uPipeHueShift: colors.pipeHueShift ?? 0.7,
      uShimmer: colors.shimmer ?? 2.2,
      uSaturation: colors.saturation ?? 0.7,
      uBrightness: colors.brightness ?? 1.25,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.75,
      uSpecular: light.specular ?? 1.1,
      uSpecPower: light.specPower ?? 42,
      uFresnelPower: light.fresnelPower ?? 2.6,
      uRimStrength: light.rimStrength ?? 0.8,
      uShadowSoft: light.shadowSoftness ?? 0,
      uMaxDist: maxDist
    }
  );

  constellationRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms
  } );
} );
