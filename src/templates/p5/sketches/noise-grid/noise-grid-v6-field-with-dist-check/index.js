import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import createNoiseFieldRenderer, {
  computeFieldRange
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v6 — field with distance check".
//
// Dots at each cell centre. The dot size grows with the distance from the
// canvas centre, and the opacity falls off against a noise-modulated wave
// radius. The hue is normalised against the converged angle min (pre-computed
// over the loop). Dots don't overlap at the default sizes.
// ─────────────────────────────────────────────────────────────────────────────

const FRAGMENT = `
  uniform float uAngleCycles;
  uniform float uXTimeMult;
  uniform float uYTimeMult;
  uniform float uZTimeMult;
  uniform float uT;
  uniform float uMin;
  uniform float uHueRange;
  uniform float uHueOffset;
  uniform float uWaveMin;
  uniform float uWaveMax;
  uniform float uWaveSpeed;
  uniform float uOpacityMax;
  uniform float uOpacityMin;

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    float col = floor(frag.x / uCellWidth);
    float row = floor(frag.y / uCellHeight);

    vec2 cellCenter = vec2(
      col * uCellWidth + uCellWidth * 0.5,
      row * uCellHeight + uCellHeight * 0.5
    );

    // Dot size from distance to the canvas centre (scale == cell width).
    float distToCenter = distance(cellCenter, uCenter);
    float weight = remapClamp(distToCenter, 0.0, uResolution.x, 0.0, uCellWidth);
    float radius = weight * 0.5;

    float dist = distance(frag, cellCenter);
    float mask = 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);

    if (mask <= 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float nx = (col * uCellWidth) / uColumns + uT * uXTimeMult;
    float ny = (row * uCellHeight) / uRows + uT * uYTimeMult;
    float angle = perlinNoise(vec3(nx, ny, uT * uZTimeMult)) * TAU * uAngleCycles;

    float hueIndex = remap(angle, uMin, TAU, -uHueRange, uHueRange);

    float waveT = easeOutQuad(remap(sin(uT * uWaveSpeed + angle), -1.0, 1.0, 0.0, 1.0));
    float w = remap(waveT, 0.0, 1.0, uResolution.x * uWaveMin, uResolution.x * uWaveMax);
    float opacityFactor = remap(
      easeInQuad(remap(distToCenter, 0.0, w, 0.0, 1.0)),
      0.0,
      1.0,
      uOpacityMax,
      uOpacityMin
    );

    gl_FragColor = vec4(paletteRainbow(uHueOffset, hueIndex, opacityFactor), mask);
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

  const rows = options.sketch.grid?.rows ?? 40;
  const columns = options.sketch.grid?.columns ?? 40;

  const seed = options.sketch.noise?.seed ?? 42;
  const detail = options.sketch.noise?.detail ?? 4;
  const falloff = options.sketch.noise?.falloff ?? 0.5;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const xTimeMult = options.sketch.noise?.xTimeMultiplier ?? 0.25;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.125;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.16;
  const waveMin = options.sketch.distance?.waveMin ?? 0.5;
  const waveMax = options.sketch.distance?.waveMax ?? 1;
  const waveSpeed = options.sketch.distance?.waveSpeed ?? 1;
  const opacityMax = options.sketch.colors?.opacityMax ?? 100;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 4;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const range = computeFieldRange( {
    key: `v6-${ seed }-${ detail }-${ falloff }-${ columns }-${ rows }-${ angleCycles }-${ xTimeMult }-${ yTimeMult }-${ zTimeMult }-${ p.width }-${ p.height }`,
    columns,
    rows,
    prepareFrame: () => {
      p.noiseSeed( seed );
      p.noiseDetail(
        detail,
        falloff
      );
    },
    sampleAt: (
      col, row, u
    ) => {
      const frameT = u * p.TAU;

      return p.noise(
        ( col * cellWidth ) / columns + frameT * xTimeMult,
        ( row * cellHeight ) / rows + frameT * yTimeMult,
        frameT * zTimeMult
      ) * ( p.TAU * angleCycles );
    }
  } );

  field.render( {
    seed,
    octaves: detail,
    falloff,
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
      uMin: range.min,
      uHueRange: hueRange,
      uHueOffset: hueOffset,
      uWaveMin: waveMin,
      uWaveMax: waveMax,
      uWaveSpeed: waveSpeed,
      uOpacityMax: opacityMax,
      uOpacityMin: opacityMin
    }
  } );

  renderTitle();
} );
