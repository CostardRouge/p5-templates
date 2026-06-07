import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v12 — field on fire".
//
// Fixed-size dots (one cell wide) at each cell centre, hue cycling over time
// from cos(angle) and opacity falling off against a noise-modulated wave
// radius. The dots are taller than the row spacing so they overlap vertically;
// each pixel scans its 3×3 neighbourhood and keeps the dot drawn last (highest
// cell index) to match the original's draw order. No cross-frame normalisation
// here — the original uses a fixed range.
// ─────────────────────────────────────────────────────────────────────────────

const FRAGMENT = `
  uniform float uAngleCycles;
  uniform float uXTimeMult;
  uniform float uYTimeMult;
  uniform float uZTimeMult;
  uniform float uT;
  uniform float uZMax;
  uniform float uHueOffset;
  uniform float uHueIndexMult;
  uniform float uWaveSpeed;
  uniform float uOpacityMax;
  uniform float uOpacityMin;

  float cellAngle(float c, float r) {
    float nx = (c * uCellWidth) / uColumns + uT * uXTimeMult;
    float ny = (r * uCellHeight) / uRows + uT * uYTimeMult;

    return perlinNoise(vec3(nx, ny, uT * uZTimeMult)) * TAU * uAngleCycles;
  }

  vec3 cellColor(float angle, vec2 cellCenter) {
    float z = uZMax * cos(angle);
    float distToCenter = distance(cellCenter, uCenter);

    float waveT = easeOutQuad(remap(sin(uT * uWaveSpeed + angle), -1.0, 1.0, 0.0, 1.0));
    float w = remap(waveT, 0.0, 1.0, -uResolution.x * 0.5, uResolution.x * 0.5);
    float safeW = abs(w) < 0.001 ? (w < 0.0 ? -0.001 : 0.001) : w;

    float opacityFactor = remap(
      easeOutQuad(remap(distToCenter, 0.0, safeW, 0.0, 1.0)),
      0.0,
      1.0,
      uOpacityMax,
      uOpacityMin
    );
    float hueIndex = remap(z, -uZMax, uZMax, -PI, PI) * uHueIndexMult;

    return paletteRainbow(uHueOffset, hueIndex, opacityFactor);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    float col = floor(frag.x / uCellWidth);
    float row = floor(frag.y / uCellHeight);

    float radius = uCellWidth * 0.5; // strokeWeight == one cell width

    float bestOrder = -1.0;
    vec3 bestColor = vec3(0.0);
    float bestMask = 0.0;

    for (int dy = -1; dy <= 1; dy++) {
      for (int dx = -1; dx <= 1; dx++) {
        float c = col + float(dx);
        float r = row + float(dy);

        if (c < 0.0 || r < 0.0 || c >= uColumns || r >= uRows) {
          continue;
        }

        vec2 cellCenter = vec2(
          c * uCellWidth + uCellWidth * 0.5,
          r * uCellHeight + uCellHeight * 0.5
        );

        float d = distance(frag, cellCenter);
        float m = 1.0 - smoothstep(radius - 1.0, radius + 1.0, d);

        if (m <= 0.0) {
          continue;
        }

        float order = r * uColumns + c;

        if (order >= bestOrder) {
          bestOrder = order;
          bestColor = cellColor(cellAngle(c, r), cellCenter);
          bestMask = m;
        }
      }
    }

    if (bestOrder < 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    gl_FragColor = vec4(bestColor, bestMask);
  }
`;

const field = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( (
  _time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 75;
  const columns = options.sketch.grid?.columns ?? 40;

  const seed = options.sketch.noise?.seed ?? 42;
  const detailLod = options.sketch.noise?.detailLod ?? 6;
  const detailFalloff = options.sketch.noise?.detailFalloff ?? 0.6;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const xTimeMult = options.sketch.noise?.xTimeMultiplier ?? 0.25;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.125;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.05;
  const waveSpeed = options.sketch.distance?.waveSpeed ?? 1;
  const hueOffsetSpeed = options.sketch.colors?.hueOffsetSpeed ?? 1;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 2;
  const opacityMax = options.sketch.colors?.opacityMax ?? 10;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const zScale = options.sketch.displacement?.zScale ?? 10;

  const cellWidth = p.width / columns;
  const zMax = cellWidth * zScale;

  field.render( {
    seed,
    octaves: detailLod,
    falloff: detailFalloff,
    columns,
    rows,
    center: [
      center.x,
      center.y
    ],
    uniforms: {
      uAngleCycles: angleCycles,
      uXTimeMult: xTimeMult,
      uYTimeMult: yTimeMult,
      uZTimeMult: zTimeMult,
      uT: t,
      uZMax: zMax,
      uHueOffset: t * hueOffsetSpeed,
      uHueIndexMult: hueIndexMultiplier,
      uWaveSpeed: waveSpeed,
      uOpacityMax: opacityMax,
      uOpacityMin: opacityMin
    }
  } );

  renderTitle();
} );
