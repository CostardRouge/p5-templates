import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov
} from "@/p5/utils/braidShader.js";
import easing from "@/p5/utils/easing.js";
import {
  flipBeat,
  mod
} from "../_shared.js";
import {
  MAX_LETTERS,
  SEG_STRIDE,
  MAX_TOTAL_SEG,
  getLetterField
} from "../_letterField.js";

// ─────────────────────────────────────────────────────────────────────────────
// flip v1 — letter cycle.
//
// rings-v3 orbits a still letter; this one turns the letter instead and uses
// the turn to change it — the sketch the whole `flip` category grew out of.
// The word sits in one plane and rotates about a horizontal or a
// vertical axis; twice per turn the plane passes EDGE-ON to the camera and the
// glyph collapses to a hairline — and that hairline is where the next entry of
// the cycle takes over. Nothing cross-fades and nothing morphs: the swap is
// hidden inside the frame where there is nothing left to see, which is the
// whole trick of the split-flap / flip-card letter change.
//
// ── The beat ────────────────────────────────────────────────────────────────
// One BEAT = one entry of `text.words` = a half turn. Inside it the plane goes
// from edge-on (-90°) through face-on (0°, where the entry is legible and can
// be held) to edge-on again (+90°); the next beat restarts at -90° with the
// next entry. +90° and -90° are the SAME plane, so the restart is invisible —
// and it is also what keeps every entry readable rather than mirrored, which a
// naive continuous 180° would not (the back of a glyph is its mirror image).
// The loop holds `flip.cycles` whole passes through the list, so the beat count
// is always a whole number and frame 0 wraps exactly.
//
// ── Where "flat" is ─────────────────────────────────────────────────────────
// Edge-on is a fact about the CAMERA, not about the world, so by default the
// plane's rest orientation is the camera's own basis (`flip.frame = camera`):
// whatever the camera is doing — orbiting, elevated, bobbing — face-on is
// face-on and the swap stays hidden. `frame = world` pins the plane to the
// world axes instead, which is v3's framing (the camera's elevation then tilts
// the letter), at the cost of an edge-on moment that drifts as the camera moves.
//
// ── Per letter or per word ──────────────────────────────────────────────────
// `flip.pivot = letter` turns every glyph in place on its own axis, so a
// `flip.stagger` can run the change across the word as a cascade — each tile
// changing at its own edge-on instant, a split-flap board. `pivot = word`
// turns the whole plane as one rigid object instead (letters swing through
// depth) and ignores the stagger, since there is one axis for everybody.
// Entries of different lengths are free: a slot with no glyph in the incoming
// entry simply stops being drawn, and it stops at the instant it is invisible.
//
// ── Geometry ────────────────────────────────────────────────────────────────
// Identical to rings-v3 — textToPoints → splitContours → resampleContour, each glyph
// a chain of round capsules melted by a polynomial smooth-minimum — except
// that a field is built and memoised per ENTRY, and each frame packs the slots
// that are currently visible into the shader's fixed per-letter slices. The
// per-letter basis vectors the shader already took (uLetRt / uLetUp) are the
// flip: rotating them about the plane's own up or right axis is all it takes.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WORDS = 8; // entries in the cycle (the item-list caps at this too)
const MAX_STEPS = 96; // sphere-trace iterations per ray
const HALF_PI = Math.PI / 2;

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

// Rodrigues' rotation of `v` about the unit axis `axis` by `angle` radians.
// The two vectors it is used on here are always perpendicular to the axis, so
// the parallel term vanishes — but the general form costs nothing and keeps
// the basis orthonormal whatever the axis ends up being.
function rotateAbout(
  v, axis, angle
) {
  const c = Math.cos( angle );
  const s = Math.sin( angle );
  const k = cross(
    axis,
    v
  );
  const d = axis[ 0 ] * v[ 0 ] + axis[ 1 ] * v[ 1 ] + axis[ 2 ] * v[ 2 ];

  return [
    v[ 0 ] * c + k[ 0 ] * s + axis[ 0 ] * d * ( 1 - c ),
    v[ 1 ] * c + k[ 1 ] * s + axis[ 1 ] * d * ( 1 - c ),
    v[ 2 ] * c + k[ 2 ] * s + axis[ 2 ] * d * ( 1 - c )
  ];
}

// The camera distance at which an entry's bbox (plus tube reach and margin)
// fits both screen axes: uv is normalised by height, so a point fits when
// focal·|y|/d ≤ 0.5 vertically and focal·|x|/d ≤ aspect/2 horizontally.
function fitDistance(
  field, focal, scale, tubeR, aspect, margin
) {
  const reach = tubeR * 2;
  const halfW = field.halfW * scale + reach;
  const halfH = field.halfH * scale + reach;

  return Math.max(
    2 * focal * halfH,
    2 * focal * halfW / Math.max(
      aspect,
      0.1
    )
  ) * ( 1 + margin );
}

// Per-instance scratch: the slots visible this frame are packed into these
// before they are handed to the shader. Module-level typed arrays would be one
// set shared by the page and every "sketch" layer running this module.
const state = sketch.state( () => ( {
  seg: new Float32Array( MAX_TOTAL_SEG * 4 ),
  segCount: new Int32Array( MAX_LETTERS ),
  radius: new Float32Array( MAX_LETTERS )
} ) );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const flip = o.flip ?? {};
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

  // ── The cycle: one field per entry, all of them resident ──────────────────
  const entries = ( Array.isArray( textCfg.words ) ? textCfg.words : [
    textCfg.words
  ] )
    .map( ( entry ) => ( entry ?? "" ).toString().trim() )
    .filter( ( entry ) => entry.length > 0 )
    .slice(
      0,
      MAX_WORDS
    );

  if ( !entries.length ) {
    return;
  }

  const fields = entries.map( ( text ) => getLetterField( {
    text,
    fontName: textCfg.font ?? "martian",
    sampleFactor: textCfg.detail ?? 0.25,
    simplifyThreshold: textCfg.simplify ?? 0,
    contourBreak: 0.2,
    spacing: textCfg.spacing ?? 0.04
  } ) );

  // Font still loading (or every entry unrenderable) — background only until
  // it resolves. A single unrenderable entry would desynchronise the cycle, so
  // the whole frame waits rather than showing a shortened list.
  if ( fields.some( ( field ) => !field ) ) {
    return;
  }

  const wordCount = fields.length;
  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;
  const progress = ( ( t / p.TAU ) % 1 + 1 ) % 1;

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

  // ── Camera: orbit (whole turns per loop), Flow (constant) or Ease (stops) ──
  const orbitTurns = Math.round( camera.orbit ?? 0 ); // 0 = static camera
  const phase = camera.phase ?? 0;
  const elevation = Math.max(
    -1.4,
    Math.min(
      camera.elevation ?? 0.05,
      1.4
    )
  );
  const bobAmplitude = camera.bob ?? 0;
  const bobCycles = Math.round( camera.bobCycles ?? 1 );
  const motion = camera.motion ?? "flow";

  let azimuth = phase;

  if ( orbitTurns !== 0 ) {
    if ( motion === "flow" ) {
      azimuth = phase + progress * orbitTurns * p.TAU;
    } else {
      // Ease: one stop per orbit turn — the camera eases into evenly spaced
      // viewpoints around the word (same easing/glide knobs as v2/v3).
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

  // ── The flip clock ────────────────────────────────────────────────────────
  // One beat per entry, `cycles` whole passes through the list per loop — so
  // the beat count is a whole number and frame 0 is frame N.
  const cycles = Math.max(
    1,
    Math.round( flip.cycles ?? 1 )
  );
  const hold = Math.max(
    0,
    Math.min(
      flip.hold ?? 0.45,
      0.95
    )
  );
  const flipEaseKey = flip.easing ?? "easeInOutCubic";
  const flipEase = typeof easing[ flipEaseKey ] === "function" ? easing[ flipEaseKey ] : ( x ) => x;
  const direction = flip.direction === "backward" ? -1 : 1;
  const perLetter = ( flip.pivot ?? "letter" ) === "letter";
  const beats = progress * wordCount * cycles;

  // The cascade spans `stagger` of one beat whatever the entry's length, so a
  // staggered word never spreads over more than one change. Rigid mode has one
  // axis for the whole plane, so there is nothing to stagger.
  const slotCount = fields.reduce(
    (
      acc, field
    ) => Math.max(
      acc,
      field.count
    ),
    0
  );
  const stagger = perLetter
    ? Math.max(
      0,
      Math.min(
        flip.stagger ?? 0,
        1
      )
    )
    : 0;
  const staggerStep = slotCount > 1 ? stagger / ( slotCount - 1 ) : 0;
  const axisMode = flip.axis ?? "y";

  // The camera rides the un-staggered beat: one framing for the word, not one
  // per tile.
  const lead = flipBeat(
    beats,
    hold,
    flipEase
  );

  // ── Camera basis ──────────────────────────────────────────────────────────
  const fov = camera.fov ?? 60;
  const focal = focalFromFov( fov );
  const autoFit = camera.autoFit ?? {};

  let distance = Math.max(
    camera.distance ?? 4,
    0.5
  );

  if ( autoFit.enabled !== false ) {
    // The framing eases from the outgoing entry's fit to the incoming one's
    // across the first half of the beat — while the plane is still edge-on
    // enough for the travel to go unnoticed — and holds there for the rest.
    const aspect = p.width / Math.max(
      p.height,
      1
    );
    const margin = autoFit.margin ?? 0.2;
    const fitEaseKey = autoFit.easing ?? "easeInOutCubic";
    const fitEase = typeof easing[ fitEaseKey ] === "function" ? easing[ fitEaseKey ] : ( x ) => x;
    const current = fields[ mod(
      lead.index,
      wordCount
    ) ];
    const previous = fields[ mod(
      lead.index - 1,
      wordCount
    ) ];

    const fitTo = fitDistance(
      current,
      focal,
      letterScale,
      tubeR,
      aspect,
      margin
    );
    const fitFrom = fitDistance(
      previous,
      focal,
      letterScale,
      tubeR,
      aspect,
      margin
    );

    distance = fitFrom + ( fitTo - fitFrom ) * fitEase( lead.fitU );
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

  // ── The plane at rest ─────────────────────────────────────────────────────
  // Camera frame: face-on is face-on whatever the camera is doing, so the
  // edge-on instant the swap hides in is exact. World frame: v3's fixed plane,
  // where the camera's elevation and orbit tilt the word (and move where flat
  // falls).
  const cameraFrame = ( flip.frame ?? "camera" ) === "camera";
  const restRight = cameraFrame
    ? right
    : [
      1,
      0,
      0
    ];
  const restUp = cameraFrame
    ? up
    : [
      0,
      1,
      0
    ];

  // ── Pack the visible slots ────────────────────────────────────────────────
  const seg = state.seg;
  const segCount = state.segCount;
  const radius = state.radius;
  const uniforms = {
    uT: t,
    uLetScale: letterScale,
    uTubeR: tubeR,
    uSmoothK: smoothK
  };

  let packed = 0;
  let sceneRadius = 0;

  for ( let slot = 0; slot < slotCount; slot++ ) {
    const beat = perLetter
      ? flipBeat(
        beats - slot * staggerStep,
        hold,
        flipEase
      )
      : lead;
    const field = fields[ mod(
      beat.index,
      wordCount
    ) ];

    // Entries of different lengths: a slot the incoming entry does not fill
    // simply stops being drawn — and it stops at its own edge-on instant,
    // where there is nothing on screen to pop.
    if ( slot >= field.count || packed >= MAX_LETTERS ) {
      continue;
    }

    // "alternate" swaps axis every beat, so a word tumbles then swings.
    const horizontal = axisMode === "x"
      || ( axisMode === "alternate" && mod(
        beat.index,
        2
      ) === 1 );
    const angle = direction * beat.turn * HALF_PI;
    const axis = horizontal ? restRight : restUp;
    const letterRight = rotateAbout(
      restRight,
      axis,
      angle
    );
    const letterUp = rotateAbout(
      restUp,
      axis,
      angle
    );

    // Rigid mode turns the whole plane, so the in-plane offsets travel with
    // it; per-letter mode leaves every tile where it is and turns it on the
    // spot.
    const offsetRight = perLetter ? restRight : letterRight;
    const offsetUp = perLetter ? restUp : letterUp;
    const ox = field.offsets[ slot * 2 ] * letterScale;
    const oy = field.offsets[ slot * 2 + 1 ] * letterScale;

    uniforms[ `uLetCtr[${ packed }]` ] = [
      offsetRight[ 0 ] * ox + offsetUp[ 0 ] * oy,
      offsetRight[ 1 ] * ox + offsetUp[ 1 ] * oy,
      offsetRight[ 2 ] * ox + offsetUp[ 2 ] * oy
    ];
    uniforms[ `uLetRt[${ packed }]` ] = letterRight;
    uniforms[ `uLetUp[${ packed }]` ] = letterUp;

    const count = field.segCount[ slot ];
    const from = slot * SEG_STRIDE * 4;

    seg.set(
      field.seg.subarray(
        from,
        from + count * 4
      ),
      packed * SEG_STRIDE * 4
    );
    segCount[ packed ] = count;
    radius[ packed ] = field.radius[ slot ];
    sceneRadius = Math.max(
      sceneRadius,
      field.wordRadius
    );
    packed++;
  }

  if ( packed === 0 ) {
    return;
  }

  for ( let k = packed; k < MAX_LETTERS; k++ ) {
    segCount[ k ] = 0;
    radius[ k ] = 0;
  }

  Object.assign(
    uniforms,
    {
      uLetterCount: {
        int: packed
      },
      uSeg: {
        vec4v: seg
      },
      uLetSegCount: {
        intv: segCount
      },
      uLetRad: {
        floatv: radius
      }
    }
  );

  // ── Palette / lighting ────────────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );
  const maxDist = distance + sceneRadius * letterScale + Math.abs( bobAmplitude ) + 2;

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
      uFocal: focal,
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
      uFogDensity: camera.fogDensity ?? 0,
      uFogStart: Math.max(
        distance - sceneRadius * letterScale,
        0
      ),
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
