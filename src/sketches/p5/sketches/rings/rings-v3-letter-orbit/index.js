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
// rings v3 — letter orbit.
//
// The letters variant, contemplative edition: instead of a fly-through circuit,
// the word (often a single letter) sits STILL at the centre of the frame while
// the camera orbits around it — or holds a fixed viewpoint when the orbit is
// disabled. Same tube material, same text sampling, same iridescent / lighting
// vocabulary as rings-v2-letters; the circuit and the chromatic aberration are
// gone.
//
// ── Geometry ─────────────────────────────────────────────────────────────────
// Identical pipeline to v2: textToPoints → splitContours → resampleContour,
// each glyph becoming a chain of round capsules melted together with a
// polynomial smooth-minimum (uSmoothK fillet). The difference is placement:
// glyphs are laid out side by side on their natural advances, the whole word is
// recentred on its bounding box, and everything lives in ONE upright plane at
// the world origin. No largest-empty-circle recentring and no tube-radius cap —
// nothing has to be threaded, so the thickness slider is free.
//
// ── Camera / loop ────────────────────────────────────────────────────────────
// The camera sits on a sphere around the origin (distance + elevation) and
// always looks at the centre. Per loop it completes a WHOLE number of orbit
// turns (snapped, so uT = TAU matches uT = 0); 0 turns = a static camera at the
// start angle. Motion reuses the family's Flow/Ease pair: Flow is a constant
// glide, Ease divides the loop into one stop per turn and eases into each
// viewpoint (easing + glide knobs, same as v2). A vertical bob (whole cycles
// per loop) adds an optional gentle rise and fall. Hue scroll still snaps to
// whole periods per loop.
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
  uniform vec3  uLetCtr[${ MAX_LETTERS }];   // letter centre in world
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

  // Orbit camera fed by CPU look-at basis. Single ray — no aberration here.
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

const lettersRenderer = createNoiseFieldRenderer( CAMERA_UNIFORMS + FRAGMENT );

// ── Vector helpers (arrays as [x, y, z]) ─────────────────────────────────────
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

// ── Letter geometry (built once per text/font/detail, memoised) ──────────────
const geometryMemo = new Map();
const GEOMETRY_MEMO_MAX = 12;

// Build the flat capsule field for a centred word: glyphs sampled one by one on
// their natural advances, each recentred on its own bounding box (small bounds
// for culling), the word as a whole recentred on origin. Per-letter offsets are
// returned in normalised units ([x, y], y up).
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

  if ( !font?.font || !text.length ) {
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
  const centreX = new Float32Array( MAX_LETTERS ); // word space (build units)
  const centreY = new Float32Array( MAX_LETTERS );

  let letterIndex = 0;
  let pen = 0; // baseline x advance in build units
  let truncated = false;

  for ( const char of text ) {
    if ( letterIndex >= MAX_LETTERS ) {
      truncated = true;
      break;
    }

    const advance = p.textWidth( char );

    if ( char.trim() === "" ) {
      pen += advance;
      continue;
    }

    const raw = font.textToPoints(
      char,
      pen,
      0,
      BUILD_SIZE,
      {
        sampleFactor,
        simplifyThreshold
      }
    );

    pen += advance;

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

    // Bounding box of the glyph (word space) — its centre anchors the letter.
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

    const ctrX = ( minX + maxX ) / 2;
    const ctrY = ( minY + maxY ) / 2;

    // Emit normalised capsules into this letter's fixed stride slice (recentred
    // on the glyph bbox, y flipped to point up, divided by BUILD_SIZE so a
    // glyph unit ≈ cap height). The base offset is letterIndex * SEG_STRIDE.
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
        const ax = ( a.x - ctrX ) / BUILD_SIZE;
        const ay = -( a.y - ctrY ) / BUILD_SIZE;
        const bx = ( b.x - ctrX ) / BUILD_SIZE;
        const by = -( b.y - ctrY ) / BUILD_SIZE;
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
    centreX[ letterIndex ] = ctrX;
    centreY[ letterIndex ] = ctrY;
    letterIndex++;
  }

  p.pop();

  if ( letterIndex === 0 ) {
    return null;
  }

  if ( truncated ) {
    console.warn( `rings-v3-letter-orbit: word truncated to ${ letterIndex } letters (max ${ MAX_LETTERS }, ${ SEG_STRIDE } capsules/letter). Use a shorter word or raise the capsule spacing.` );
  }

  // Recentre the WORD: per-letter offsets relative to the word's bbox centre,
  // normalised, y flipped to world-up.
  let wordMinX = Infinity;
  let wordMaxX = -Infinity;
  let wordMinY = Infinity;
  let wordMaxY = -Infinity;

  for ( let k = 0; k < letterIndex; k++ ) {
    const r = radius[ k ] * BUILD_SIZE;

    wordMinX = Math.min(
      wordMinX,
      centreX[ k ] - r
    );
    wordMaxX = Math.max(
      wordMaxX,
      centreX[ k ] + r
    );
    wordMinY = Math.min(
      wordMinY,
      centreY[ k ] - r
    );
    wordMaxY = Math.max(
      wordMaxY,
      centreY[ k ] + r
    );
  }

  const wordCtrX = ( wordMinX + wordMaxX ) / 2;
  const wordCtrY = ( wordMinY + wordMaxY ) / 2;
  const offsets = new Float32Array( MAX_LETTERS * 2 );

  let wordRadius = 0;

  for ( let k = 0; k < letterIndex; k++ ) {
    const ox = ( centreX[ k ] - wordCtrX ) / BUILD_SIZE;
    const oy = -( centreY[ k ] - wordCtrY ) / BUILD_SIZE;

    offsets[ k * 2 ] = ox;
    offsets[ k * 2 + 1 ] = oy;
    wordRadius = Math.max(
      wordRadius,
      Math.hypot(
        ox,
        oy
      ) + radius[ k ]
    );
  }

  return {
    count: letterIndex,
    seg,
    segCount,
    radius,
    offsets,
    wordRadius
  };
}

function getLetterField( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;
  const fontFamily = font?.font?.names?.fontFamily?.en || "unknown";
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

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
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

  const field = getLetterField( {
    text: ( textCfg.value ?? "a" ).toString(),
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

  // ── Material (tube) — no gap cap: nothing is threaded, thickness is free ───
  const letterScale = Math.max(
    material.size ?? 2.1,
    0.1
  );
  const tubeR = Math.max(
    material.thickness ?? 0.06,
    0.005
  );
  const smoothK = Math.max(
    material.fusion ?? 0.09,
    0.001
  );

  // ── Placement: the whole word in one upright plane at the origin ───────────
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
    uniforms[ `uLetCtr[${ k }]` ] = [
      field.offsets[ k * 2 ] * letterScale,
      field.offsets[ k * 2 + 1 ] * letterScale,
      0
    ];
    uniforms[ `uLetRt[${ k }]` ] = [
      1,
      0,
      0
    ];
    uniforms[ `uLetUp[${ k }]` ] = [
      0,
      1,
      0
    ];
  }

  // ── Orbit camera: whole turns per loop, Flow (constant) or Ease (stops) ────
  const distance = Math.max(
    camera.distance ?? 4,
    0.5
  );
  const orbitTurns = Math.round( camera.orbit ?? 1 ); // 0 = static camera
  const phase = camera.phase ?? 0;
  const elevation = Math.max(
    -1.4,
    Math.min(
      camera.elevation ?? 0.15,
      1.4
    )
  );
  const bobAmplitude = camera.bob ?? 0;
  const bobCycles = Math.round( camera.bobCycles ?? 1 );

  const progress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const motion = camera.motion ?? "flow";

  let azimuth = phase;

  if ( orbitTurns !== 0 ) {
    if ( motion === "flow" ) {
      azimuth = phase + progress * orbitTurns * p.TAU;
    } else {
      // Ease: one stop per orbit turn — the camera eases into evenly spaced
      // viewpoints around the letter (same easing/glide knobs as v2).
      const glide = Math.max(
        0,
        Math.min(
          camera.glide ?? 0.85,
          1
        )
      );
      const easeKey = camera.easing ?? "easeInOutCubic";
      const easeFn = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;

      const stops = Math.abs( orbitTurns );
      const s = progress * stops;
      const segIndex = Math.min(
        Math.floor( s ),
        stops - 1
      );
      const u = s - segIndex;
      const ue = u + ( easeFn( u ) - u ) * glide;

      azimuth = phase + ( ( segIndex + ue ) / stops ) * orbitTurns * p.TAU;
    }
  }

  const bobY = bobAmplitude * Math.sin( bobCycles * t );
  const cosE = Math.cos( elevation );

  const camPos = [
    distance * cosE * Math.sin( azimuth ),
    distance * Math.sin( elevation ) + bobY,
    -distance * cosE * Math.cos( azimuth )
  ];

  const fwd = normalize( [
    -camPos[ 0 ],
    -camPos[ 1 ],
    -camPos[ 2 ]
  ] );
  const right = normalize( cross(
    [
      0,
      1,
      0
    ],
    fwd
  ) );
  const up = cross(
    fwd,
    right
  );

  // ── Palette / lighting / fog ────────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );

  const fov = camera.fov ?? 60;
  const maxDist = distance + field.wordRadius * letterScale + Math.abs( bobAmplitude ) + 2;

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
      uFogDensity: camera.fogDensity ?? 0.04,
      uFogStart: camera.fogStart ?? 2,
      uMaxDist: maxDist
    }
  );

  lettersRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms
  } );
} );
