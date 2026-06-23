import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// flowers-shaders v1 — melted.
//
// A GPU re-imagining of "flowers v5 — spiral" (which stays untouched). The CPU
// original walks an eased S-curve path with ~250 lerp steps and, at every step,
// stamps a small cluster of `sides` flowers — each flower a ring of
// `flowerPetals` overlapping circles whose size pulses along the path and whose
// rotation winds up with the step index. In black-and-white that overlap is what
// produced the "shape variations": hundreds of white discs with black outlines
// fusing into intricate, layered petals. Doing that per circle on the CPU each
// frame is the slow part, so here the whole path is rebuilt in a single
// full-screen fragment shader: every pixel re-derives the same circles, unions
// the discs and keeps the one drawn last (highest painter order), exactly like
// torsade-shaders v1 melted does for its spirals.
//
// Colour is reworked into the same iridescent, oil-slick palette as melted: a
// cosine (IQ) spectrum that cycles along the path and shimmers across the width
// of every disc, so the molten flowers read as thin-film / soap-bubble
// iridescence instead of the old flat black-and-white. A radial RGB split adds
// optional chromatic aberration on top, for lens-like colour fringing.
//
// All anchor/easing/path maths that depend only on time (not on the pixel) are
// evaluated on the CPU and handed to the shader as uniforms — so the path
// easing dropdown keeps working bit-for-bit with the original.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SAMPLES = 320; // upper bound on path lerp samples (matches the slider)
const MAX_SIDES = 12; // matches the "sides" slider max
const MAX_PETALS = 24; // matches the "flower petals" slider max

const FRAGMENT = `
  uniform float uT;
  uniform vec2  uStart;
  uniform vec2  uEnd;
  uniform float uSamples;
  uniform float uStep;
  uniform float uSides;
  uniform float uPetals;
  uniform float uSizeMin;
  uniform float uSizeMax;
  uniform float uRotationSpeed;
  uniform float uInnerRotationGain;
  uniform float uBorderWidth;
  uniform float uBorderDarken;

  // Iridescent palette controls (shared vocabulary with torsade-shaders melted).
  uniform float uHueSpeed;        // how fast the spectrum scrolls over time
  uniform float uHueSpread;       // spectral cycles packed into the palette
  uniform float uHuePhase;        // base hue rotation
  uniform float uPathHueShift;    // hue drift from start to end of the path
  uniform float uSideHueShift;    // hue offset between the cluster's flowers
  uniform float uPetalHueShift;   // hue offset between a flower's petals
  uniform float uShimmer;         // oil-slick sheen across each disc's width
  uniform float uSaturation;
  uniform float uBrightness;

  // Chromatic aberration (real RGB channel split, evaluated only when on).
  uniform float uAberration;      // channel separation in pixels
  uniform int   uAberrationMode;  // 0 = radial, 1 = horizontal

  // Oil-slick / thin-film iridescence — identical palette to torsade-shaders v1
  // melted: a cosine (IQ) spectrum with the RGB channels phase-shifted so the
  // hue sweeps cleanly through the rainbow, desaturated toward luma and scaled
  // by brightness.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // p5 rotate(): standard rotation matrix (visually clockwise since +y is down).
  vec2 rot(vec2 v, float a) {
    float c = cos(a);
    float s = sin(a);

    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
  }

  // Re-stamp every circle the CPU sketch would have drawn and keep the one drawn
  // last (highest painter order) that covers frag — the loops iterate in the
  // original's exact draw order, so "last writer wins" reproduces the overlap.
  vec4 sampleScene(vec2 frag) {
    vec3  bestColor = vec3(0.0);
    float bestMask = 0.0;

    for (int i = 0; i < ${ MAX_SAMPLES }; i++) {
      if (float(i) >= uSamples) { break; }

      float li = float(i) * uStep;

      // Path position + the original's size pulse (easeInOutExpo → cos remap).
      vec2 vpos = mix(uStart, uEnd, li);
      float sizeRatio = remap(easeInOutExpo(li), 0.0, 1.0, PI, -PI);
      float crossSize = remap(cos(sizeRatio), -1.0, 1.0, uSizeMin, uSizeMax);

      float outerRot = -uT * uRotationSpeed;
      float flowerRot = li * PI - uT + li * uInnerRotationGain;

      float inc = TAU / uPetals;
      float innerSize = crossSize / uSides;
      float radius = innerSize * sin(inc * 0.5);

      // Discs this small never cover a pixel — skip the whole cluster.
      if (radius < 0.25) { continue; }

      for (int s = 0; s < ${ MAX_SIDES }; s++) {
        if (float(s) >= uSides) { break; }

        float petalAngle = TAU / uSides * float(s);
        vec2 petalOffset = crossSize * vec2(cos(petalAngle), sin(petalAngle));

        for (int k = 0; k < ${ MAX_PETALS }; k++) {
          if (float(k) >= uPetals) { break; }

          float aMid = float(k) * inc + inc * 0.5;
          vec2 m = innerSize * vec2(sin(aMid), cos(aMid));
          vec2 center = vpos + rot(petalOffset + rot(m, flowerRot), outerRot);

          vec2 local = frag - center;
          float mask = discMask(local, radius);

          if (mask <= 0.001) { continue; }

          float d = length(local);
          float phase = (li * TAU + uT * uHueSpeed
            + li * uPathHueShift
            + float(s) * uSideHueShift
            + float(k) * uPetalHueShift) / TAU;

          vec3 col = iridescent(phase + uShimmer * (d / radius));

          // Darkened rim reproduces the original's black flower outline.
          if (uBorderWidth > 0.0 && radius - d < uBorderWidth) {
            col *= uBorderDarken;
          }

          bestMask = mask;
          bestColor = col;
        }
      }
    }

    return vec4(bestColor, bestMask);
  }

  void main() {
    // Top-left origin, matching the p5 2D coordinates the original drew in.
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    if (uAberration < 0.5) {
      gl_FragColor = sampleScene(frag);
      return;
    }

    // Split the red/blue channels along a radial (or horizontal) offset for a
    // lens-like chromatic fringe; green stays centred.
    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize(frag - uResolution * 0.5 + vec2(1e-4));
    vec2 off = dir * uAberration;

    vec4 cr = sampleScene(frag + off);
    vec4 cg = sampleScene(frag);
    vec4 cb = sampleScene(frag - off);

    gl_FragColor = vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));
  }
`;

const flowers = createNoiseFieldRenderer( FRAGMENT );

const resolveEasing = ( name ) => easing[ name ] ?? easing.linear;

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const path = o.path ?? {};
  const flower = o.flower ?? {};
  const colors = o.colors ?? {};
  const aberration = o.aberration ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle * ( o.timeScale ?? 1 );

  // ── Animated start/end anchors — computed on the CPU exactly as flowers v5,
  // so the path easing dropdown keeps behaving identically. ────────────────
  const boundary = path.boundary ?? 150;
  const anchorTimeScale = path.anchorTimeScale ?? 0.25;
  const easingFn = resolveEasing( path.easing ?? "linear" );

  const start = animation.ease( {
    values: [
      p.createVector(
        boundary,
        boundary
      ),
      p.createVector(
        p.width - boundary,
        boundary
      ),
      p.createVector(
        p.width / 2,
        boundary
      )
    ],
    currentTime: t * anchorTimeScale,
    duration: 1,
    easingFn,
    lerpFn: mappers.lerpVector
  } );

  const end = animation.ease( {
    values: [
      p.createVector(
        p.width - boundary,
        p.height - boundary
      ),
      p.createVector(
        boundary,
        p.height - boundary
      ),
      p.createVector(
        p.width / 2,
        p.height - boundary
      )
    ],
    currentTime: t * anchorTimeScale,
    duration: 1,
    easingFn,
    lerpFn: mappers.lerpVector
  } );

  // Path density → sample count. Capped so a tiny step can't blow up the
  // per-pixel loop; beyond the cap the path is sampled more coarsely.
  const pathStep = path.step ?? 1 / 250;
  const samples = Math.min(
    Math.max(
      1,
      Math.round( 1 / pathStep )
    ),
    MAX_SAMPLES
  );

  const sides = Math.min(
    flower.sides ?? 2,
    MAX_SIDES
  );
  const petals = Math.min(
    flower.flowerPetals ?? 5,
    MAX_PETALS
  );

  flowers.render( {
    columns: 1,
    rows: 1,
    uniforms: {
      uT: t,
      uStart: [
        start.x,
        start.y
      ],
      uEnd: [
        end.x,
        end.y
      ],
      uSamples: samples,
      uStep: 1 / samples,
      uSides: sides,
      uPetals: petals,
      uSizeMin: flower.sizeMin ?? 1,
      uSizeMax: flower.sizeMax ?? 500,
      uRotationSpeed: flower.rotationSpeed ?? 0.5,
      uInnerRotationGain: flower.innerRotationGain ?? 10,
      uBorderWidth: flower.borderWidth ?? 0,
      uBorderDarken: flower.borderDarken ?? 0,
      uHueSpeed: colors.hueSpeed ?? 1,
      uHueSpread: colors.hueSpread ?? 1,
      uHuePhase: colors.huePhase ?? 0,
      uPathHueShift: colors.pathHueShift ?? 1,
      uSideHueShift: colors.sideHueShift ?? 0,
      uPetalHueShift: colors.petalHueShift ?? 0,
      uShimmer: colors.shimmer ?? 1.5,
      uSaturation: colors.saturation ?? 1,
      uBrightness: colors.brightness ?? 1,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );

  renderTitle();
} );
