import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer, {
  computeFieldRange
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v7 — pulse field".
//
// Dots at each cell centre, weight normalised against the converged angle
// range and scaled by a bass-like pulse (which also drives the noise falloff).
// At full pulse the dots grow past a cell and overlap, so each pixel scans its
// 3×3 cell neighbourhood and keeps the covering dot drawn last (highest cell
// index), reproducing the painter's-order of the original.
// ─────────────────────────────────────────────────────────────────────────────

const FRAGMENT = `
  uniform float uAngleCycles;
  uniform float uXTimeMult;
  uniform float uYTimeMult;
  uniform float uZTimeMult;
  uniform float uT;
  uniform float uMin;
  uniform float uMax;
  uniform float uHueRange;
  uniform float uHueOffset;
  uniform float uOpacityMax;
  uniform float uOpacityMin;
  uniform float uWeightTop;

  float cellAngle(float c, float r) {
    float nx = (c * uCellWidth) / uColumns + uT * uXTimeMult;
    float ny = (r * uCellHeight) / uRows + uT * uYTimeMult;

    return perlinNoise(vec3(nx, ny, uT * uZTimeMult)) * TAU * uAngleCycles;
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    float col = floor(frag.x / uCellWidth);
    float row = floor(frag.y / uCellHeight);

    float bestOrder = -1.0;
    vec3 bestColor = vec3(0.0);
    float bestMask = 0.0;

    // A dot's radius never exceeds uWeightTop * 0.5, so pixels beyond that from
    // a cell centre can't be covered — skip them before sampling the noise.
    float maxRadius = uWeightTop * 0.5;

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

        if (d > maxRadius + 1.0) {
          continue;
        }

        float angle = cellAngle(c, r);
        float weight = remapClamp(angle, uMin, uMax, 0.0, uWeightTop);
        float radius = weight * 0.5;

        float m = 1.0 - smoothstep(radius - 1.0, radius + 1.0, d);

        if (m <= 0.0) {
          continue;
        }

        float order = r * uColumns + c;

        if (order >= bestOrder) {
          bestOrder = order;

          float opacityFactor = remap(angle, uMin, uMax, uOpacityMax, uOpacityMin);
          float hueIndex = remap(angle, uMin, TAU, -uHueRange, uHueRange);

          bestColor = paletteRainbow(uHueOffset, hueIndex, opacityFactor);
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

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 40;
  const columns = options.sketch.grid?.columns ?? 40;

  const seed = options.sketch.noise?.seed ?? 42;
  const detailLod = options.sketch.noise?.detailLod ?? 6;
  const falloffMin = options.sketch.noise?.falloffMin ?? 0.2;
  const falloffMax = options.sketch.noise?.falloffMax ?? 0.8;
  const pulseSpeed = options.sketch.pulse?.speed ?? 2;
  const pulseWeightBoost = options.sketch.pulse?.weightBoost ?? 0.5;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const xTimeMult = options.sketch.noise?.xTimeMultiplier ?? 0.16;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.33;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.1;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const bassFor = ( frameT ) => mappers.fn(
    p.sin( frameT * pulseSpeed ),
    -1,
    1,
    0,
    1,
    easing.easeInOutSine
  );

  const bass = bassFor( t );
  const falloff = p.map(
    bass,
    0,
    1,
    falloffMin,
    falloffMax
  );
  const weightTop = cellWidth * ( 1 + bass * pulseWeightBoost );

  const range = computeFieldRange( {
    key: `v7-${ seed }-${ detailLod }-${ falloffMin }-${ falloffMax }-${ columns }-${ rows }-${ angleCycles }-${ xTimeMult }-${ yTimeMult }-${ zTimeMult }-${ pulseSpeed }-${ p.width }-${ p.height }`,
    columns,
    rows,
    prepareFrame: ( u ) => {
      const frameBass = bassFor( u * p.TAU );

      p.noiseSeed( seed );
      p.noiseDetail(
        detailLod,
        p.map(
          frameBass,
          0,
          1,
          falloffMin,
          falloffMax
        )
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
    octaves: detailLod,
    falloff,
    columns,
    rows,
    uniforms: {
      uAngleCycles: angleCycles,
      uXTimeMult: xTimeMult,
      uYTimeMult: yTimeMult,
      uZTimeMult: zTimeMult,
      uT: t,
      uMin: range.min,
      uMax: range.max,
      uHueRange: hueRange,
      uHueOffset: hueOffset,
      uOpacityMax: opacityMax,
      uOpacityMin: opacityMin,
      uWeightTop: weightTop
    }
  } );
} );
