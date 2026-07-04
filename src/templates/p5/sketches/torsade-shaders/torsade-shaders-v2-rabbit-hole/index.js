import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import {
  createInstancedFieldRenderer
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// torsade-shaders v2 — rabbit hole.
//
// A GPU re-imagining of "torsade v10 — rabbit hole" (which stays untouched). The
// CPU original drew a deep tunnel of concentric rings of round dots: each ring
// is rotated a little more than the last and the whole stack is nudged by a
// constant per-frame jitter, so it leans into a drifting "rabbit hole". At the
// defaults that is ~600 rings × 14 dots = thousands of dots per spiral, every
// frame — the slow part on the CPU.
//
// Each dot is now a GPU instance: the vertex shader rebuilds its polar position
// (ring rotation + progressive drift), its size and its colour from the cell
// index, and the fragment shader stamps a round, antialiased disc. This is the
// instanced path (O(dots), not O(pixels × dots)) the noise-grid family already
// uses, so the whole tunnel is one draw call.
//
// Colour is reworked into an iridescent, oil-slick palette: a cosine spectrum
// that cycles with the dot angle, shifts with tunnel depth, and keeps the
// original's pulsing brightness — instead of the old flat rainbow.
// ─────────────────────────────────────────────────────────────────────────────

// Guard against pathological slider combinations (e.g. 200 shadows / 0.01 step /
// 10×10 grid would ask for tens of millions of instances). Beyond this we
// coarsen the ring sampling so the buffer and draw stay bounded; the defaults
// (~8.4k instances) are nowhere near it.
const MAX_INSTANCES = 300000;

const VERTEX = `
  uniform float uT;
  uniform float uXCount;
  uniform float uYCount;
  uniform float uSizeDivisor;
  uniform float uShadowSteps;       // ring steps per spiral (rows are spiral-major)
  uniform float uShadowIndexStep;   // shadowIndex increment per ring step
  uniform float uShadowsCount;      // shadowIndex span (the remap domain)
  uniform float uRadiusDivisorMin;
  uniform float uRadiusDivisorMax;
  uniform float uWeightMin;
  uniform float uWeightMax;
  uniform float uShadowRotationRadians;
  uniform float uSpinSpeed;
  uniform float uJitter;

  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uDepthHue;          // hue shift from far (centre) to near (rim)
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uOpacityCurveSpeed;
  uniform float uOpacityMin;
  uniform float uOpacityMax;

  // Oil-slick / thin-film iridescence: a cosine spectrum (IQ palette) with the
  // RGB channels phase-shifted so the hue sweeps cleanly through the rainbow.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  void computeInstance(
    float col, float row,
    out vec2 center, out vec2 halfSize, out vec3 color, out vec4 params
  ) {
    // Decode the instance. Columns are dots around a ring; rows pack each
    // spiral's ring steps contiguously (spiral-major) so later rows draw on top.
    float spiralIndex = floor(row / uShadowSteps);
    float stepIndex = row - spiralIndex * uShadowSteps;
    float shadowIndex = stepIndex * uShadowIndexStep;
    float angle = col * (TAU / uColumns);

    // Spiral position in the grid (y fastest, then x — matches the original).
    float gx = floor(spiralIndex / uYCount);
    float gy = spiralIndex - gx * uYCount;
    vec2 spiralPos = vec2(
      uResolution.x * (gx + 1.0) / (uXCount + 1.0),
      uResolution.y * (gy + 1.0) / (uYCount + 1.0)
    );
    float size = (uResolution.x + uResolution.y) / (uXCount + uYCount) / uSizeDivisor;

    // Progressive jitter — constant within a frame, accumulated per ring step,
    // so the stack of rings leans into a drifting tunnel ("rabbit hole").
    vec2 jitter = vec2(
      remap(sin(uT * 2.0), -1.0, 1.0, -uJitter, uJitter),
      remap(cos(uT),       -1.0, 1.0, -uJitter, uJitter)
    );
    vec2 drift = (stepIndex + 1.0) * jitter;

    // Each ring is rotated a little more than the last; spirals alternate spin.
    float dir = mod(spiralIndex, 2.0) >= 1.0 ? -1.0 : 1.0;
    float theta = angle + dir * uT * uSpinSpeed
      - (uShadowRotationRadians * shadowIndex) * (PI / 180.0);

    float radiusDivisor = remap(
      shadowIndex, 0.0, uShadowsCount, uRadiusDivisorMax, uRadiusDivisorMin
    );
    float polarRadius = size / radiusDivisor;
    // converters.polar.vector: x uses sin, y uses cos.
    vec2 polar = vec2(polarRadius * sin(theta), polarRadius * cos(theta));

    center = spiralPos + drift + polar;

    float weight = remap(shadowIndex, 0.0, uShadowsCount, uWeightMin, uWeightMax);
    float dotRadius = max(weight * 0.5, 0.0);
    halfSize = vec2(dotRadius + 1.0); // +1px so the antialiased rim fits the quad
    params = vec4(dotRadius, 0.0, 0.0, 0.0);

    // Iridescent colour with the original's pulsing brightness.
    float hueCadence = spiralIndex + uT * uHueSpeed;
    float hueT = (angle + hueCadence) / TAU + uDepthHue * (shadowIndex / uShadowsCount);

    float opacityFactor = remap(
      sin(shadowIndex / 5.0 - uT * uOpacityCurveSpeed + angle * 2.0),
      -1.0, 1.0, uOpacityMin, uOpacityMax
    );
    float pulse = 1.0 / max(opacityFactor, 0.001);

    color = clamp(iridescent(hueT) * pulse, 0.0, 1.0);
  }
`;

const FRAGMENT = `
  float coverage(vec2 local, vec4 params) {
    return discMask(local, params.x);
  }
`;

const field = createInstancedFieldRenderer( {
  vertexBody: VERTEX,
  fragmentBody: FRAGMENT
} );

sketch.setup(
  () => {},
  {}
);

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const layout = o.layout ?? {};
  const rings = o.rings ?? {};
  const motion = o.motion ?? {};
  const colors = o.colors ?? {};

  p.clear();

  const bg = o.backgroundColor ?? [
    0,
    0,
    0
  ];

  p.background( ...bg );

  const xCount = layout.xCount ?? 1;
  const yCount = layout.yCount ?? 1;
  const sizeDivisor = layout.sizeDivisor ?? 3;
  const spiralCount = xCount * yCount;

  const angleSubdivisions = rings.angleSubdivisions ?? 14;
  const shadowsCount = rings.shadowsCount ?? 30;
  let shadowIndexStep = rings.shadowIndexStep ?? 0.05;

  // Ring steps per spiral — the original loop is inclusive (0 .. shadowsCount).
  let shadowSteps = Math.floor( shadowsCount / shadowIndexStep + 1e-9 ) + 1;

  // Coarsen the ring sampling (keeping the full tunnel depth) if the instance
  // count would blow past the guard.
  const total = angleSubdivisions * shadowSteps * spiralCount;

  if ( total > MAX_INSTANCES ) {
    const scale = Math.ceil( total / MAX_INSTANCES );

    shadowIndexStep *= scale;
    shadowSteps = Math.floor( shadowsCount / shadowIndexStep + 1e-9 ) + 1;
  }

  field.render( {
    columns: angleSubdivisions,
    rows: shadowSteps * spiralCount,
    background: bg,
    uniforms: {
      uT: time,
      uXCount: xCount,
      uYCount: yCount,
      uSizeDivisor: sizeDivisor,
      uShadowSteps: shadowSteps,
      uShadowIndexStep: shadowIndexStep,
      uShadowsCount: shadowsCount,
      uRadiusDivisorMin: rings.radiusDivisorMin ?? 0.2,
      uRadiusDivisorMax: rings.radiusDivisorMax ?? 5,
      uWeightMin: rings.weightMin ?? 20,
      uWeightMax: rings.weightMax ?? 75,
      uShadowRotationRadians: rings.shadowRotationRadians ?? 7,
      uSpinSpeed: motion.spinSpeed ?? 1,
      uJitter: motion.jitterAmount ?? 0.33,
      uHueSpeed: colors.hueSpeed ?? 1,
      uHueSpread: colors.hueSpread ?? 1,
      uHuePhase: colors.huePhase ?? 0,
      uDepthHue: colors.depthHue ?? 1,
      uSaturation: colors.saturation ?? 1,
      uBrightness: colors.brightness ?? 1,
      uOpacityCurveSpeed: colors.opacityCurveSpeed ?? 5,
      uOpacityMin: colors.opacityMin ?? 1,
      uOpacityMax: colors.opacityMax ?? 15
    }
  } );
} );
