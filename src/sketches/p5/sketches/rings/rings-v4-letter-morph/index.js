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
import easing from "@/p5/utils/easing.js";

// ─────────────────────────────────────────────────────────────────────────────
// rings v4 — letter morph.
//
// One glyph sits still at the centre (the v3 framing), but over the loop it
// MELTS from one letter of the word into the next — the iridescent tube is a
// single piece of liquid material that reshapes itself, letter by letter, and
// arrives back at the first glyph exactly as the loop closes. Same tube
// material and iridescent / lighting vocabulary as the rest of the family.
//
// ── Correspondence (how a glyph knows where to flow) ─────────────────────────
// Morphing needs matched point sets, so unlike v2/v3 every glyph is sampled to
// a FIXED layout: up to 3 contour slots (sorted longest-first, so slot 0 is the
// outer outline and the rest are counters), each resampled to a fixed point
// count and normalised to the same winding. Between two letters, each slot pair
// is aligned by the cyclic start shift that minimises total travel. A contour
// that exists on one side only (the counter of an "o" morphing to an "l")
// collapses into — or grows out of — the nearest point of the other letter's
// outer outline, so it melts into the stroke instead of popping off as a
// floating drop.
//
// ── Timing ───────────────────────────────────────────────────────────────────
// The loop is divided into one beat per letter: a HOLD phase where the glyph is
// legible and still, then a morph eased toward the next letter. A per-point
// STAGGER offsets each sample's morph phase by its position along the contour,
// so instead of a rigid crossfade the outline unzips — a ripple runs round the
// glyph carrying the new shape with it. The CPU lerps the (few dozen) points
// each frame and uploads capsules; the shader just renders whatever field it is
// given, so the melt costs nothing extra per pixel.
//
// ── Camera / loop ────────────────────────────────────────────────────────────
// The shared braidShader orbit camera (uCamDist/uPitch/uYaw), whole turns per
// loop (0 = static viewpoint). Ease motion stops once per LETTER — the camera
// settles exactly while each glyph holds legible and swings during the melt —
// with an optional vertical sway (whole cycles/loop). Hue scroll snaps to whole
// palette periods, and the per-letter hue shift snaps so that cycling through
// all N letters advances the hue by whole periods too: uT = TAU matches uT = 0.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_MORPH_LETTERS = 16; // letters kept from the word (CPU-side only)
const SLOT_POINTS = [
  32,
  16,
  16
]; // samples per contour slot (slot 0 = outer outline, then counters)
const MORPH_SLOTS = SLOT_POINTS.length;
const SEG_TOTAL = SLOT_POINTS.reduce(
  (
    sum, n
  ) => sum + n,
  0
); // capsule uniform array size (one capsule per sample, closed rings)
const MAX_STEPS = 96; // sphere-trace iterations per ray
const BUILD_SIZE = 100; // glyph sampling size; geometry normalised by it

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Morphing letter field (normalised glyph space, one plane at origin) ──
  uniform int   uSegCount;              // capsules active this frame
  uniform vec4  uSeg[${ SEG_TOTAL }];   // (ax, ay, bx, by) normalised capsules
  uniform float uRad;                   // bounding radius (normalised)
  uniform float uScale;                 // world size of one glyph unit
  uniform float uTubeR;                 // tube radius (world)
  uniform float uSmoothK;               // smooth-union fillet (world)
  uniform float uPipeId;                // letter index + morph progress (hue)

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

  // The whole glyph lives in the z = 0 plane at the origin, so the scene is
  // just: distance to the fused capsule field, extruded to a tube. All maths
  // runs in normalised glyph space, scaled to world at the end.
  float mapScene(vec3 p) {
    float inv = 1.0 / max(uScale, 1e-4);
    float tubeRn = uTubeR * inv;
    float kn = max(uSmoothK * inv, 1e-4);
    vec2 q = p.xy * inv;
    float lz = p.z * inv;

    float bound = discBound(q, lz, uRad) - tubeRn - kn;

    if (bound > 0.3) { return bound * uScale; }

    float d2 = 1e9;

    for (int s = 0; s < ${ SEG_TOTAL }; s++) {
      if (s >= uSegCount) { break; }

      vec4 seg = uSeg[s];

      d2 = smin(d2, segDist2D(q, seg.xy, seg.zw), kn);
    }

    return (sqrt(d2 * d2 + lz * lz) - tubeRn) * uScale;
  }

  // One letter on screen at a time: its hue identity is the CPU-fed morph
  // position (letter index + eased progress), not a spatial lookup.
  float nearestPipe(vec3 p) {
    return uPipeId;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const morphRenderer = createNoiseFieldRenderer( FRAGMENT );

// ── Letter geometry (built once per text/font/detail, memoised) ──────────────
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

// Sample every letter of the word into the fixed slot layout: per slot a ring
// of exactly SLOT_POINTS[s] normalised points (glyph bbox centre at the origin,
// y up, CCW winding), plus the glyph's bounding radius. Slots a glyph doesn't
// fill (an "l" has no counters) stay null — the pair aligner melts them into
// the outline of whichever letter does have them.
function buildLetters( {
  text,
  fontName,
  sampleFactor,
  simplifyThreshold
} ) {
  const p = getP5();
  const font = string.fonts[ fontName ] ?? string.fonts.sans;

  if ( !font?.font || !text.length ) {
    return null;
  }

  p.push();
  p.textFont( font );
  p.textSize( BUILD_SIZE );

  const letters = [];
  let truncated = false;

  for ( const char of text ) {
    if ( letters.length >= MAX_MORPH_LETTERS ) {
      truncated = true;
      break;
    }

    if ( char.trim() === "" ) {
      continue;
    }

    const raw = font.textToPoints(
      char,
      0,
      0,
      BUILD_SIZE,
      {
        sampleFactor,
        simplifyThreshold
      }
    );

    if ( !raw.length ) {
      continue;
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
        MORPH_SLOTS
      );

    if ( !contours.length ) {
      continue;
    }

    // Glyph bbox centre — the anchor everything is normalised around.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for ( const contour of contours ) {
      for ( const pt of contour.pts ) {
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
    const slots = new Array( MORPH_SLOTS ).fill( null );
    let radius = 0;

    contours.forEach( (
      contour, slotIndex
    ) => {
      const count = SLOT_POINTS[ slotIndex ];
      // resampleContour spaces by arc length; perimeter / count yields exactly
      // `count` ring samples (the closing duplicate is dropped by the util).
      const samples = resampleContour(
        contour.pts,
        contour.perimeter / count,
        true
      );

      if ( samples.length !== count ) {
        return;
      }

      const ring = new Float32Array( count * 2 );

      for ( let i = 0; i < count; i++ ) {
        const x = ( samples[ i ].x - ctrX ) / BUILD_SIZE;
        const y = -( samples[ i ].y - ctrY ) / BUILD_SIZE;

        ring[ i * 2 ] = x;
        ring[ i * 2 + 1 ] = y;
        radius = Math.max(
          radius,
          Math.hypot(
            x,
            y
          )
        );
      }

      // Normalise winding to CCW (shoelace) so pair alignment never has to
      // consider reversed orientations.
      let area = 0;

      for ( let i = 0; i < count; i++ ) {
        const j = ( i + 1 ) % count;

        area += ring[ i * 2 ] * ring[ j * 2 + 1 ] - ring[ j * 2 ] * ring[ i * 2 + 1 ];
      }

      if ( area < 0 ) {
        for ( let i = 0, j = count - 1; i < j; i++, j-- ) {
          const xi = ring[ i * 2 ];
          const yi = ring[ i * 2 + 1 ];

          ring[ i * 2 ] = ring[ j * 2 ];
          ring[ i * 2 + 1 ] = ring[ j * 2 + 1 ];
          ring[ j * 2 ] = xi;
          ring[ j * 2 + 1 ] = yi;
        }
      }

      slots[ slotIndex ] = ring;
    } );

    if ( !slots[ 0 ] ) {
      continue;
    }

    letters.push( {
      slots,
      radius
    } );
  }

  p.pop();

  if ( !letters.length ) {
    return null;
  }

  if ( truncated ) {
    console.warn( `rings-v4-letter-morph: word truncated to ${ letters.length } letters (max ${ MAX_MORPH_LETTERS }).` );
  }

  return {
    count: letters.length,
    letters,
    pairs: new Map()
  };
}

function getLetters( cfg ) {
  const font = string.fonts[ cfg.fontName ] ?? string.fonts.sans;
  const fontFamily = font?.font?.names?.fontFamily?.en || "unknown";
  const key = [
    cfg.text,
    fontFamily,
    cfg.sampleFactor,
    cfg.simplifyThreshold
  ].join( "|" );

  const cached = geometryMemo.get( key );

  if ( cached ) {
    return cached;
  }

  const field = buildLetters( cfg );

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

// ── Pair alignment (memoised per letter pair) ────────────────────────────────
function ringCentroid( ring ) {
  const count = ring.length / 2;
  let cx = 0;
  let cy = 0;

  for ( let i = 0; i < count; i++ ) {
    cx += ring[ i * 2 ];
    cy += ring[ i * 2 + 1 ];
  }

  return [
    cx / count,
    cy / count
  ];
}

// Fill a ring with one repeated point: the collapse/grow anchor. It sits ON the
// polyline of the host outline, so the degenerate ring hides inside the tube.
function anchorRing(
  hostRing, count, nearX, nearY
) {
  const hostCount = hostRing.length / 2;
  let bestX = hostRing[ 0 ];
  let bestY = hostRing[ 1 ];
  let best = Infinity;

  for ( let i = 0; i < hostCount; i++ ) {
    const dx = hostRing[ i * 2 ] - nearX;
    const dy = hostRing[ i * 2 + 1 ] - nearY;
    const d = dx * dx + dy * dy;

    if ( d < best ) {
      best = d;
      bestX = hostRing[ i * 2 ];
      bestY = hostRing[ i * 2 + 1 ];
    }
  }

  const ring = new Float32Array( count * 2 );

  for ( let i = 0; i < count; i++ ) {
    ring[ i * 2 ] = bestX;
    ring[ i * 2 + 1 ] = bestY;
  }

  return ring;
}

// Cyclically shift ringB so its points travel the least total distance to
// ringA's — the seam alignment that keeps the morph from spiralling.
function alignRing(
  ringA, ringB
) {
  const count = ringA.length / 2;
  let bestShift = 0;
  let bestCost = Infinity;

  for ( let shift = 0; shift < count; shift++ ) {
    let cost = 0;

    for ( let i = 0; i < count; i++ ) {
      const j = ( i + shift ) % count;
      const dx = ringA[ i * 2 ] - ringB[ j * 2 ];
      const dy = ringA[ i * 2 + 1 ] - ringB[ j * 2 + 1 ];

      cost += dx * dx + dy * dy;

      if ( cost >= bestCost ) {
        break;
      }
    }

    if ( cost < bestCost ) {
      bestCost = cost;
      bestShift = shift;
    }
  }

  if ( bestShift === 0 ) {
    return ringB;
  }

  const out = new Float32Array( count * 2 );

  for ( let i = 0; i < count; i++ ) {
    const j = ( i + bestShift ) % count;

    out[ i * 2 ] = ringB[ j * 2 ];
    out[ i * 2 + 1 ] = ringB[ j * 2 + 1 ];
  }

  return out;
}

function getPair(
  field, a, b
) {
  const key = `${ a }|${ b }`;
  const cached = field.pairs.get( key );

  if ( cached ) {
    return cached;
  }

  const src = field.letters[ a ];
  const dst = field.letters[ b ];
  const slots = [];

  for ( let s = 0; s < MORPH_SLOTS; s++ ) {
    const ringA = src.slots[ s ];
    const ringB = dst.slots[ s ];

    if ( ringA && ringB ) {
      slots.push( {
        a: ringA,
        b: alignRing(
          ringA,
          ringB
        )
      } );
    } else if ( ringA ) {
      const [
        cx,
        cy
      ] = ringCentroid( ringA );

      slots.push( {
        a: ringA,
        b: anchorRing(
          dst.slots[ 0 ],
          SLOT_POINTS[ s ],
          cx,
          cy
        )
      } );
    } else if ( ringB ) {
      const [
        cx,
        cy
      ] = ringCentroid( ringB );

      slots.push( {
        a: anchorRing(
          src.slots[ 0 ],
          SLOT_POINTS[ s ],
          cx,
          cy
        ),
        b: ringB
      } );
    } else {
      slots.push( null );
    }
  }

  const pair = {
    slots
  };

  field.pairs.set(
    key,
    pair
  );

  return pair;
}

// Per-frame scratch (SEG_TOTAL capsules + one slot's lerped ring) — reused to
// avoid per-frame garbage.
const segScratch = new Float32Array( SEG_TOTAL * 4 );
const ptsScratch = new Float32Array( Math.max( ...SLOT_POINTS ) * 2 );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const textCfg = o.text ?? {};
  const material = o.material ?? {};
  const morph = o.morph ?? {};
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

  const field = getLetters( {
    text: ( textCfg.value ?? "morph" ).toString(),
    fontName: textCfg.font ?? "martian",
    sampleFactor: textCfg.detail ?? 1,
    simplifyThreshold: textCfg.simplify ?? 0
  } );

  // Font still loading (or empty text) — background only until it resolves.
  if ( !field ) {
    return;
  }

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;
  const count = field.count;

  // ── Loop position: one beat per letter, hold then morph ────────────────────
  const progress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const s = progress * count;
  const k = Math.min(
    Math.floor( s ),
    count - 1
  );
  const u = s - k;

  const hold = Math.max(
    0,
    Math.min(
      morph.hold ?? 0.35,
      0.95
    )
  );
  const stagger = Math.max(
    0,
    Math.min(
      morph.stagger ?? 0.4,
      0.9
    )
  );
  const easeKey = morph.easing ?? "easeInOutCubic";
  const easeFn = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;

  const tmRaw = count > 1 && u > hold ? ( u - hold ) / ( 1 - hold ) : 0;

  // ── Lerp the capsule field on the CPU (a few dozen points) ─────────────────
  const pair = getPair(
    field,
    k,
    ( k + 1 ) % count
  );

  let written = 0;
  let radius = 0;

  for ( let slot = 0; slot < MORPH_SLOTS; slot++ ) {
    const rings = pair.slots[ slot ];

    if ( !rings ) {
      continue;
    }

    const pointCount = SLOT_POINTS[ slot ];

    for ( let i = 0; i < pointCount; i++ ) {
      // Stagger: each point's morph phase lags by its contour position, so a
      // ripple runs round the outline carrying the new letter with it. The
      // window is normalised so the last point still lands exactly at 1.
      const lag = ( stagger * i ) / pointCount;
      const tp = Math.max(
        0,
        Math.min(
          ( tmRaw - lag ) / ( 1 - stagger ),
          1
        )
      );
      const e = easeFn( tp );
      const x = rings.a[ i * 2 ] + ( rings.b[ i * 2 ] - rings.a[ i * 2 ] ) * e;
      const y = rings.a[ i * 2 + 1 ] + ( rings.b[ i * 2 + 1 ] - rings.a[ i * 2 + 1 ] ) * e;

      ptsScratch[ i * 2 ] = x;
      ptsScratch[ i * 2 + 1 ] = y;
      radius = Math.max(
        radius,
        Math.hypot(
          x,
          y
        )
      );
    }

    for ( let i = 0; i < pointCount; i++ ) {
      const j = ( i + 1 ) % pointCount;
      const w = written * 4;

      segScratch[ w ] = ptsScratch[ i * 2 ];
      segScratch[ w + 1 ] = ptsScratch[ i * 2 + 1 ];
      segScratch[ w + 2 ] = ptsScratch[ j * 2 ];
      segScratch[ w + 3 ] = ptsScratch[ j * 2 + 1 ];
      written++;
    }
  }

  // ── Material (tube) ────────────────────────────────────────────────────────
  const letterScale = Math.max(
    material.size ?? 2.1,
    0.1
  );
  const tubeR = Math.max(
    material.thickness ?? 0.08,
    0.005
  );
  const smoothK = Math.max(
    material.fusion ?? 0.1,
    0.001
  );

  // ── Orbit camera (shared braidShader chunk): whole turns per loop ──────────
  const camDistance = Math.max(
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
  const sway = camera.sway ?? 0;
  const swayCycles = Math.round( camera.swayCycles ?? 1 );
  const motion = camera.motion ?? "ease";

  let yaw = phase;

  if ( orbitTurns !== 0 ) {
    if ( motion === "flow" ) {
      yaw = phase + progress * orbitTurns * p.TAU;
    } else {
      // Ease: one stop per LETTER — the camera settles while the glyph holds
      // legible and swings during the melt (the swing's slow ends line up with
      // the hold windows at each beat boundary).
      const glide = Math.max(
        0,
        Math.min(
          camera.glide ?? 0.6,
          1
        )
      );
      const camEaseKey = camera.easing ?? "easeInOutCubic";
      const camEase = typeof easing[ camEaseKey ] === "function" ? easing[ camEaseKey ] : ( x ) => x;
      const ue = u + ( camEase( u ) - u ) * glide;

      yaw = phase + ( ( k + ue ) / count ) * orbitTurns * p.TAU;
    }
  }

  const pitch = Math.max(
    -1.5,
    Math.min(
      elevation + sway * Math.sin( swayCycles * t ),
      1.5
    )
  );

  // ── Palette / lighting ─────────────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );

  // uPipeId sweeps 0 → N over the loop, so the per-letter hue shift snaps to
  // whole palette periods across the word — the wrap back to letter 0 lands on
  // the same colour (the pipe-id analogue of the hue-speed snap).
  const pipeShiftUser = colors.pipeHueShift ?? 0.3;
  const pipeShift = count > 1 && hueSpread
    ? Math.round( pipeShiftUser * count * hueSpread ) / ( count * hueSpread )
    : pipeShiftUser;
  const pipeId = k + ( count > 1 ? easeFn( Math.max(
    0,
    Math.min(
      tmRaw,
      1
    )
  ) ) : 0 );

  const fov = camera.fov ?? 60;
  const maxDist = camDistance + radius * letterScale + 2;

  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.45
  );

  morphRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms: {
      uT: t,
      uSegCount: {
        int: written
      },
      uSeg: {
        vec4v: segScratch
      },
      uRad: radius,
      uScale: letterScale,
      uTubeR: tubeR,
      uSmoothK: smoothK,
      uPipeId: pipeId,
      uCamDist: camDistance,
      uYaw: yaw,
      uPitch: pitch,
      uRoll: 0,
      uFocal: focalFromFov( fov ),
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.25,
      uPipeHueShift: pipeShift,
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
      uAberration: 0
    }
  } );
} );
