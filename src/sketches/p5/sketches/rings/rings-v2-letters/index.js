import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import string from "@/p5/utils/string.js";
import {
  splitContours,
  resampleContour
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
// rings v2 — letters.
//
// The ring family, but each "ring" is now a LETTER: the iridescent tube wraps
// the outline of a glyph instead of a circle, and the fly-through camera threads
// one letter after another — a textual journey, letter by letter, in the same
// pipes/iridescent material as v1.
//
// ── Geometry ─────────────────────────────────────────────────────────────────
// A word is sampled into per-glyph closed contours (letterPaths: textToPoints →
// splitContours → resampleContour). Each contour becomes a chain of round
// capsules (segments), and a letter is the union of its capsules — an exact-ish
// distance field wrapping the glyph outline in a tube of radius uTubeR, with the
// third dimension coming for free (the planar outline extruded to a tube:
// dist³ᴰ = hypot(dist²ᴰ-to-outline, out-of-plane)).
//
// ── Smooth junctions (the requested "fusion") ────────────────────────────────
// Where two parts of a glyph meet or run close — a t's bar and stem, serifs,
// the pinch of an e — a hard union would show a crease. Instead the capsules are
// combined with a POLYNOMIAL SMOOTH-MINIMUM (iq's smin): nearby surfaces melt
// into a rounded fillet governed by uSmoothK, so the material reads as one
// continuous skin poured over the letter rather than separate strokes butted
// together.
//
// ── Threading each letter (no stem collisions) ───────────────────────────────
// The camera flies through each letter's LARGEST-EMPTY-CIRCLE centre (the pole
// of inaccessibility of the outline — the hole of an o, a clear quadrant of a t,
// the side of an i's stem), computed once on the CPU. Each glyph is shifted so
// that open point sits on the flight path, so the camera always threads a gap
// instead of ploughing through a stroke, and the tube radius is capped against
// that gap so the passage stays open.
//
// ── Per-letter planes + culling ──────────────────────────────────────────────
// Letters are placed like v1's rings: at even parameters of a closed circuit,
// each in a plane facing the path tangent so you read it head-on as you approach
// then pass through. Geometry stays in normalised glyph space; per letter the
// shader gets a centre + right/up basis and a bounding radius, and skips a
// letter's capsule loop entirely (a conservative disc bound) when the ray point
// is far from its plane — so only the 1–2 nearest letters cost anything.
//
// ── Loop / camera ────────────────────────────────────────────────────────────
// Camera + Flow/Ease motion are lifted from rings v1 (one circuit per loop, hue
// scroll in whole periods), so the frame at uT = TAU equals uT = 0. All the
// iridescent / lighting / aberration parameters are the family's shared
// braidShader vocabulary — identical knobs to v1.
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

  // First-person camera fed by CPU look-at basis (same as rings v1).
  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 ro = uCamPos;

    if (uAberration < 0.5) {
      vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);
      gl_FragColor = traceRay(ro, rd);
      return;
    }

    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize(uv + vec2(1e-4));
    vec2 off = dir * (uAberration / uResolution.y);

    vec3 rdR = normalize(uCamFwd * uFocal + uCamRight * (uv.x + off.x) + uCamUp * (uv.y + off.y));
    vec3 rdG = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);
    vec3 rdB = normalize(uCamFwd * uFocal + uCamRight * (uv.x - off.x) + uCamUp * (uv.y - off.y));

    vec4 cr4 = traceRay(ro, rdR);
    vec4 cg4 = traceRay(ro, rdG);
    vec4 cb4 = traceRay(ro, rdB);

    gl_FragColor = vec4(cr4.r, cg4.g, cb4.b, max(cr4.a, max(cg4.a, cb4.a)));
  }
`;

// The camera basis uniforms this sketch feeds (not in BRAID_UNIFORMS_GLSL).
const CAMERA_UNIFORMS = `
  uniform vec3 uCamPos;
  uniform vec3 uCamFwd;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
`;

const lettersRenderer = createNoiseFieldRenderer( CAMERA_UNIFORMS + FRAGMENT );

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
// an open gap), plus per-letter bounding radius and open-gap radius.
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
  let cursor = 0; // flat segment write head
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

    // Bounding box + centroid of the glyph (build space).
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
    console.warn( `rings-v2-letters: word truncated to ${ letterIndex } letters (max ${ MAX_LETTERS }, ${ SEG_STRIDE } capsules/letter). Use a shorter word or raise the capsule spacing.` );
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

// ── Closed circuit the letters sit on (mirrors rings v1) ─────────────────────
function pathPoint(
  a, path
) {
  const radius = path.spread
    * ( 1 + path.wobble * Math.sin( path.wobbleCycles * a + 0.9 ) );

  return [
    radius * Math.sin( a ),
    path.waveAmplitude * Math.sin( path.waveCycles * a + 2.1 ),
    -radius * Math.cos( a )
  ];
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
  const path = o.path ?? {};
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

  const field = getLetterField( {
    text: ( textCfg.value ?? "type" ).toString(),
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
    material.size ?? 3.3,
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
    material.thickness ?? 0.14,
    Math.max(
      minGapWorld * 0.6,
      0.02
    )
  );
  const smoothK = Math.max(
    material.fusion ?? 0.09,
    0.001
  );

  // ── Circuit / placement ────────────────────────────────────────────────────
  const pathConfig = {
    spread: path.spread ?? 4.2,
    wobble: path.wobble ?? 0.08,
    wobbleCycles: Math.round( path.wobbleCycles ?? 3 ),
    waveAmplitude: path.waveAmplitude ?? 0.8,
    waveCycles: Math.round( path.waveCycles ?? 2 )
  };

  const centres = [];

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
    const a = ( p.TAU * k ) / count;
    const centre = pathPoint(
      a,
      pathConfig
    );
    const tangent = normalize( sub(
      pathPoint(
        a + 0.01,
        pathConfig
      ),
      pathPoint(
        a - 0.01,
        pathConfig
      )
    ) );

    // In-plane basis: right horizontal-ish, up vertical-ish, plane ⟂ tangent so
    // the letter faces along the path (read head-on, then flown through).
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

    centres.push( centre );
    uniforms[ `uLetCtr[${ k }]` ] = centre;
    uniforms[ `uLetRt[${ k }]` ] = right;
    uniforms[ `uLetUp[${ k }]` ] = up;
  }

  // ── Camera: one circuit per loop, Flow (smooth) or Ease (per-letter) ────────
  const motion = camera.motion ?? "flow";
  const bank = camera.bank ?? 0.4;

  const progress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const s = progress * count;
  const angleOf = ( ss ) => ( p.TAU * ss ) / count;

  let camPos;
  let fwd;
  let roll = 0;

  if ( motion === "flow" ) {
    const ahead = Math.max(
      camera.lookAhead ?? 0.9,
      0.2
    );

    camPos = pathPoint(
      angleOf( s ),
      pathConfig
    );
    fwd = normalize( sub(
      pathPoint(
        angleOf( s + ahead ),
        pathConfig
      ),
      camPos
    ) );

    if ( bank !== 0 ) {
      const before = normalize( sub(
        camPos,
        pathPoint(
          angleOf( s - 0.5 ),
          pathConfig
        )
      ) );
      const after = normalize( sub(
        pathPoint(
          angleOf( s + 0.5 ),
          pathConfig
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

    camPos = pathPoint(
      angleOf( seg + ue ),
      pathConfig
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

  // ── Palette / lighting ───────────────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );

  const fov = camera.fov ?? 90;
  const maxRadius = pathConfig.spread * ( 1 + Math.abs( pathConfig.wobble ) );
  const maxDist = 2 * maxRadius + 2 * Math.abs( pathConfig.waveAmplitude )
    + letterScale + 2;

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
      uMaxDist: maxDist,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  );

  lettersRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms
  } );
} );
