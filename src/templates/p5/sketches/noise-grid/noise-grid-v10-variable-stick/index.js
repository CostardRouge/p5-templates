import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer, {
  computeFieldRange
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v10 — variable stick".
//
// Like v5 but the stick length breathes with a sine wave (bounded) and the hue
// is an easeOutBack mapping of the noise angle over the converged range. Sticks
// overlap, so each pixel scans its 5×5 neighbourhood and keeps the one drawn
// last (highest cell index), early-outing past the max possible reach.
// ─────────────────────────────────────────────────────────────────────────────

const FRAGMENT = `
  uniform float uAngleCycles;
  uniform float uYTimeMult;
  uniform float uZTimeMult;
  uniform float uT;
  uniform float uMin;
  uniform float uMax;
  uniform float uHueRange;
  uniform float uHueOffset;
  uniform float uOpacityFactor;
  uniform float uStrokeWeight;
  uniform float uLengthMin;
  uniform float uLengthMax;
  uniform float uLengthSpeed;

  float cellAngle(float c, float r) {
    float nx = (c * uCellWidth) / uColumns;
    float ny = (r * uCellHeight) / uRows + uT * uYTimeMult;

    return perlinNoise(vec3(nx, ny, uT * uZTimeMult)) * TAU * uAngleCycles;
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    float col = floor(frag.x / uCellWidth);
    float row = floor(frag.y / uCellHeight);

    float halfStroke = uStrokeWeight * 0.5;
    float maxReach = uLengthMax + halfStroke;

    float bestOrder = -1.0;
    vec3 bestColor = vec3(0.0);
    float bestMask = 0.0;

    for (int dy = -2; dy <= 2; dy++) {
      for (int dx = -2; dx <= 2; dx++) {
        float c = col + float(dx);
        float r = row + float(dy);

        if (c < 0.0 || r < 0.0 || c >= uColumns || r >= uRows) {
          continue;
        }

        vec2 cellCenter = vec2(
          c * uCellWidth + uCellWidth * 0.5,
          r * uCellHeight + uCellHeight * 0.5
        );

        if (distance(frag, cellCenter) > maxReach + 1.0) {
          continue;
        }

        float angle = cellAngle(c, r);
        float len = remap(sin(uT * uLengthSpeed + angle), -1.0, 1.0, uLengthMin, uLengthMax);
        vec2 endPoint = cellCenter + len * vec2(cos(angle), sin(angle));

        float d = segmentDistance(frag, cellCenter, endPoint);
        float m = 1.0 - smoothstep(halfStroke - 1.0, halfStroke + 1.0, d);

        if (m <= 0.0) {
          continue;
        }

        float order = r * uColumns + c;

        if (order >= bestOrder) {
          bestOrder = order;

          float hueIndex = remap(
            easeOutBack(remap(angle, uMin, uMax, 0.0, 1.0)),
            0.0,
            1.0,
            -uHueRange,
            uHueRange
          );

          bestColor = paletteRainbow(uHueOffset, hueIndex, uOpacityFactor);
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
  const detail = options.sketch.noise?.detail ?? 4;
  const falloff = options.sketch.noise?.falloff ?? 0.5;
  const zSpeed = options.sketch.noise?.zSpeed ?? 0.05;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.125;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;
  const strokeWeight = options.sketch.stick?.strokeWeight ?? 15;
  const lengthMin = options.sketch.stick?.lengthMin ?? 5;
  const lengthMax = options.sketch.stick?.lengthMax ?? 50;
  const lengthSpeed = options.sketch.stick?.lengthSpeed ?? 1;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const range = computeFieldRange( {
    key: `v10-${ seed }-${ detail }-${ falloff }-${ columns }-${ rows }-${ angleCycles }-${ yTimeMult }-${ zSpeed }-${ p.width }-${ p.height }`,
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
        ( col * cellWidth ) / columns,
        ( row * cellHeight ) / rows + frameT * yTimeMult,
        frameT * zSpeed
      ) * ( p.TAU * angleCycles );
    }
  } );

  field.render( {
    seed,
    octaves: detail,
    falloff,
    columns,
    rows,
    uniforms: {
      uAngleCycles: angleCycles,
      uYTimeMult: yTimeMult,
      uZTimeMult: zSpeed,
      uT: t,
      uMin: range.min,
      uMax: range.max,
      uHueRange: hueRange,
      uHueOffset: hueOffset,
      uOpacityFactor: opacityFactor,
      uStrokeWeight: strokeWeight,
      uLengthMin: lengthMin,
      uLengthMax: lengthMax,
      uLengthSpeed: lengthSpeed
    }
  } );
} );
