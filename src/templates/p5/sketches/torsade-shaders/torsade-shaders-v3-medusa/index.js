import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import {
  createInstancedFieldRenderer
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// torsade-shaders v3 — medusa.
//
// A GPU re-imagining of "torsade v13 — medusa" (which stays untouched). The CPU
// original grows a radial "medusa": for each of angleSubdivisions directions a
// tentacle reaches outward (shadowIndex = distance along it, the ring radius
// grows), and at every step a small cluster of linesCount dots is placed and
// spun by a per-step rotation; the dots fatten toward the tip, which gets a
// thin darkened endcap. At the defaults that is ~330 steps × 6 × 3 = thousands
// of dots per spiral, every frame — the slow part on the CPU.
//
// Each dot is now a GPU instance: the vertex shader rebuilds its ring position,
// cluster rotation, size and colour from the cell index, and the fragment
// shader stamps a round, antialiased disc — the whole medusa in one draw call
// (the instanced path the noise-grid family already uses). The glow of
// concentric rings is still drawn on the CPU underneath, and the dots composite
// over it via clearAlpha: 0.
//
// Colour is reworked into an iridescent, oil-slick palette: a cosine spectrum
// that cycles with the dot angle and tentacle depth, keeping the original's
// pulsing brightness and darkened endcaps — instead of the old flat rainbow.
// ─────────────────────────────────────────────────────────────────────────────

// Guard against pathological slider combinations (e.g. 100 shadows / 0.005 step
// / 64×12 clusters / 10×10 grid would ask for over a billion instances). Beyond
// this we coarsen the ring sampling; the defaults (~6k instances) are far below.
const MAX_INSTANCES = 300000;

const VERTEX = `
  uniform float uT;
  uniform float uXCount;
  uniform float uYCount;
  uniform float uSizeDivisor;
  uniform float uShadowSteps;       // ring steps per spiral (rows are spiral-major)
  uniform float uShadowIndexStep;   // shadowIndex increment per ring step
  uniform float uShadowsCount;      // shadowIndex span (the remap domain)
  uniform float uAngleSubdivisions; // tentacle directions around the ring
  uniform float uLinesCount;        // dots per cluster
  uniform float uRadiusDivisorMin;
  uniform float uRadiusDivisorMax;
  uniform float uLineSizeMin;
  uniform float uLineSizeMax;
  uniform float uSpinSpeed;
  uniform float uRotationSpeed;
  uniform float uRotationMaxMin;
  uniform float uRotationMaxMax;
  uniform float uWeightMaxMin;
  uniform float uWeightMaxMax;
  uniform float uEndcapWeight;
  uniform float uEndcapDarken;

  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uDepthHue;          // hue shift along each tentacle
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uOpacityFalloffMin;
  uniform float uOpacityFalloffMax;

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
    // Decode the instance. Columns pack each ring step's cluster (angle-major,
    // then line); rows pack each spiral's ring steps (spiral-major) so later
    // rows — further along the tentacle — draw on top.
    float angleIndex = floor(col / uLinesCount);
    float lineIdx = col - angleIndex * uLinesCount;
    float spiralIndex = floor(row / uShadowSteps);
    float stepIndex = row - spiralIndex * uShadowSteps;
    float shadowIndex = stepIndex * uShadowIndexStep;
    float angle = angleIndex * (TAU / uAngleSubdivisions);

    // Spiral position in the grid (y fastest, then x — matches the original).
    float gx = floor(spiralIndex / uYCount);
    float gy = spiralIndex - gx * uYCount;
    vec2 spiralPos = vec2(
      uResolution.x * (gx + 1.0) / (uXCount + 1.0),
      uResolution.y * (gy + 1.0) / (uYCount + 1.0)
    );
    float size = (uResolution.x + uResolution.y) / (uXCount + uYCount) / uSizeDivisor;

    // Ring placement: the tentacle node, swept around the centre over time.
    float ringRadius = size / remap(
      shadowIndex, 0.0, uShadowsCount, uRadiusDivisorMax, uRadiusDivisorMin
    );
    float ringTheta = angle - uT * uSpinSpeed;
    // converters.polar.vector: x uses sin, y uses cos.
    vec2 ringPos = vec2(ringRadius * sin(ringTheta), ringRadius * cos(ringTheta));

    // The cluster of dots spins a little more the further along the tentacle.
    float rotationMax = remap(sin(uT * 0.5), -1.0, 1.0, uRotationMaxMin, uRotationMaxMax);
    float rot = -uT * uRotationSpeed + remap(shadowIndex, 0.0, uShadowsCount, 0.0, rotationMax);

    float lineSize = clamp(
      remap(sin(uT), -1.0, 1.0, uLineSizeMin, uLineSizeMax),
      min(uLineSizeMin, uLineSizeMax), max(uLineSizeMin, uLineSizeMax)
    );
    float lineAngle = lineIdx * (PI / uLinesCount);
    vec2 local = vec2(lineSize * sin(lineAngle), lineSize * cos(lineAngle));
    vec2 rotated = vec2(
      local.x * cos(rot) - local.y * sin(rot),
      local.x * sin(rot) + local.y * cos(rot)
    );

    center = spiralPos + ringPos + rotated;

    // Dots fatten toward the tip; the very last step is a thin endcap.
    float wMax = remap(sin(uT), -1.0, 1.0, uWeightMaxMin, uWeightMaxMax);
    float weight = clamp(remap(shadowIndex, 0.0, uShadowsCount, 0.0, wMax), 0.0, wMax);
    bool isEndcap = stepIndex >= uShadowSteps - 1.0;

    if (isEndcap) {
      weight = uEndcapWeight;
    }

    float dotRadius = max(weight * 0.5, 0.0);
    halfSize = vec2(dotRadius + 1.0); // +1px so the antialiased rim fits the quad
    params = vec4(dotRadius, 0.0, 0.0, 0.0);

    // Iridescent colour with the original's pulsing brightness.
    float opacityFalloff = remap(
      sin(-uT * 3.0 + angle * 2.0), -1.0, 1.0, uOpacityFalloffMin, uOpacityFalloffMax
    );
    float opacityFactor = remap(
      abs(shadowIndex - uShadowsCount * 2.0), 0.0, uShadowsCount * 2.0, 1.0, opacityFalloff
    );
    float pulse = 1.0 / max(opacityFactor, 0.001);

    float hueT = (-uT * uHueSpeed + angle + shadowIndex / 1.5) / TAU
      + uDepthHue * (shadowIndex / uShadowsCount);

    color = clamp(iridescent(hueT) * pulse, 0.0, 1.0);

    if (isEndcap) {
      color = clamp(color - uEndcapDarken / 255.0, 0.0, 1.0);
    }
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

// Soft halo of orbiting concentric rings, drawn on the CPU behind the medusa
// (a faithful port of the original's drawGlow). The GPU dots composite over it.
function drawGlow(
  p, time, glow
) {
  if ( !( glow.enabled ?? true ) ) {
    return;
  }

  const count = glow.ringsCount ?? 15;
  const sizeMin = glow.sizeMin ?? 0.166;
  const sizeMax = glow.sizeMax ?? 1;
  const orbitRadius = glow.orbitRadius ?? 30;
  const orbitSpeed = glow.orbitSpeed ?? 5;
  const c = glow.color ?? [
    128,
    128,
    255
  ];

  p.noFill();
  p.strokeWeight( glow.strokeWeight ?? 4 );
  p.stroke( ...c );

  const size = p.map(
    -p.sin( time ),
    -1,
    1,
    p.width * sizeMin,
    p.width * sizeMax
  );
  const xOffset = p.sin( time * orbitSpeed ) * orbitRadius;
  const yOffset = p.cos( time * orbitSpeed ) * orbitRadius;

  for ( let i = 2; i < count; i++ ) {
    p.circle(
      p.width / 2 - xOffset,
      p.height / 2 - yOffset,
      i * size / 5 * i
    );
  }
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  // Duration-driven loop clock (canonical), replacing the legacy `draw(time)`
  // argument. Same value as before at the default duration, but now the whole
  // animation rescales with the sketch duration.
  const time = animation.loopTime;
  const o = options.sketch ?? {};
  const layout = o.layout ?? {};
  const rings = o.rings ?? {};
  const motion = o.motion ?? {};
  const colors = o.colors ?? {};
  const endcap = o.endcap ?? {};
  const glow = o.glow ?? {};

  p.clear();

  const bg = o.backgroundColor ?? [
    0,
    0,
    0
  ];

  p.background( ...bg );

  // Glow first (underneath), then the medusa dots composite over it.
  drawGlow(
    p,
    time,
    glow
  );

  const xCount = layout.xCount ?? 1;
  const yCount = layout.yCount ?? 1;
  const sizeDivisor = layout.sizeDivisor ?? 3;
  const spiralCount = xCount * yCount;

  const angleSubdivisions = rings.angleSubdivisions ?? 6;
  const linesCount = rings.linesCount ?? 3;
  const shadowsCount = rings.shadowsCount ?? 10;
  let shadowIndexStep = rings.shadowIndexStep ?? 0.03;

  // Ring steps per spiral — the original loop is inclusive (0 .. shadowsCount).
  let shadowSteps = Math.floor( shadowsCount / shadowIndexStep + 1e-9 ) + 1;

  const columns = angleSubdivisions * linesCount;
  const total = columns * shadowSteps * spiralCount;

  if ( total > MAX_INSTANCES ) {
    const scale = Math.ceil( total / MAX_INSTANCES );

    shadowIndexStep *= scale;
    shadowSteps = Math.floor( shadowsCount / shadowIndexStep + 1e-9 ) + 1;
  }

  field.render( {
    columns,
    rows: shadowSteps * spiralCount,
    background: bg,
    clearAlpha: 0,
    uniforms: {
      uT: time,
      uXCount: xCount,
      uYCount: yCount,
      uSizeDivisor: sizeDivisor,
      uShadowSteps: shadowSteps,
      uShadowIndexStep: shadowIndexStep,
      uShadowsCount: shadowsCount,
      uAngleSubdivisions: angleSubdivisions,
      uLinesCount: linesCount,
      uRadiusDivisorMin: rings.radiusDivisorMin ?? 1,
      uRadiusDivisorMax: rings.radiusDivisorMax ?? 5,
      uLineSizeMin: rings.lineSizeMin ?? 50,
      uLineSizeMax: rings.lineSizeMax ?? 150,
      uSpinSpeed: motion.spinSpeed ?? 1,
      uRotationSpeed: motion.rotationSpeed ?? 3,
      uRotationMaxMin: motion.rotationMaxMin ?? 1,
      uRotationMaxMax: motion.rotationMaxMax ?? 5,
      uWeightMaxMin: colors.weightMaxMin ?? 50,
      uWeightMaxMax: colors.weightMaxMax ?? 100,
      uEndcapWeight: endcap.weight ?? 4,
      uEndcapDarken: endcap.darken ?? 32,
      uHueSpeed: colors.hueSpeed ?? 1,
      uHueSpread: colors.hueSpread ?? 1,
      uHuePhase: colors.huePhase ?? 0,
      uDepthHue: colors.depthHue ?? 1,
      uSaturation: colors.saturation ?? 1,
      uBrightness: colors.brightness ?? 1,
      uOpacityFalloffMin: colors.opacityFalloffMin ?? 1,
      uOpacityFalloffMax: colors.opacityFalloffMax ?? 5
    }
  } );
} );
