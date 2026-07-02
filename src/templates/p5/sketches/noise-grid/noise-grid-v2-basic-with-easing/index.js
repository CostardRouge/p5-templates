import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  createInstancedFieldRenderer,
  computeFieldRange,
  easingId
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v2 — basic with easing" (instanced).
//
// One dot per cell, displaced by (sin, cos) of the noise angle and sized by an
// eased mapping of the angle over the converged min..TAU range. Dots cross cell
// borders, so each is drawn as its own instance in grid order. The weight easing
// is selectable: the "Weight easing" control feeds applyEasing() in the vertex
// shader (defaults to the preset's easeInOutExpo).
// ─────────────────────────────────────────────────────────────────────────────

const VERTEX = `
  uniform float uXOff;
  uniform float uYOff;
  uniform float uZOff;
  uniform float uAngleCycles;
  uniform float uMin;
  uniform float uWeightMin;
  uniform float uWeightMax;
  uniform float uTranslateXMult;
  uniform float uTranslateYMult;
  uniform float uHueRange;
  uniform float uHueOffset;
  uniform float uOpacityFactor;
  uniform int uWeightEasing;

  void computeInstance(
    float col, float row,
    out vec2 center, out vec2 halfSize, out vec3 color, out vec4 params
  ) {
    float cellSize = (uCellWidth + uCellHeight) * 0.5;

    float angle = perlinNoise(vec3(
      col / uColumns + uXOff,
      row / uRows + uYOff,
      uZOff
    )) * TAU * uAngleCycles;

    float weight = remap(
      applyEasing(uWeightEasing, remap(angle, uMin, TAU, 0.0, 1.0)),
      0.0,
      1.0,
      uWeightMin,
      uWeightMax
    );
    float radius = max(weight * 0.5, 0.0);

    vec2 cellCenter = vec2(
      col * uCellWidth + uCellWidth * 0.5,
      row * uCellHeight + uCellHeight * 0.5
    );
    center = cellCenter + vec2(
      cellSize * sin(angle) * uTranslateXMult,
      cellSize * cos(angle) * uTranslateYMult
    );

    halfSize = vec2(radius + 1.0);
    params = vec4(radius, 0.0, 0.0, 0.0);

    float hueIndex = remap(angle, uMin, TAU, -uHueRange, uHueRange);
    color = paletteRainbow(uHueOffset, hueIndex, uOpacityFactor);
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

sketch.setup( () => {} );

sketch.draw( () => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 80;
  const columns = options.sketch.grid?.columns ?? 50;

  const seed = options.sketch.noise?.seed ?? 42;
  const detail = options.sketch.noise?.detail ?? 4;
  const falloff = options.sketch.noise?.falloff ?? 0.5;

  // The x/y/z noise offsets orbit through noise-space on sin/cos( t * speed )
  // rather than drifting, so the field itself is exactly periodic — but only
  // when each speed completes a WHOLE number of turns per loop. Fractional
  // speeds land the offset somewhere other than its start point at the seam.
  const xSpeed = Math.round( options.sketch.offsets?.xSpeed ?? 1 );
  const ySpeed = Math.round( options.sketch.offsets?.ySpeed ?? 2 );
  const zSpeed = Math.round( options.sketch.offsets?.zSpeed ?? 0.5 );
  const xRangeDivisor = options.sketch.offsets?.xRangeDivisor ?? 2;
  const yRangeDivisor = options.sketch.offsets?.yRangeDivisor ?? 2;
  const zRangeDivisor = options.sketch.offsets?.zRangeDivisor ?? 2;

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const weightMin = options.sketch.stroke?.weightMin ?? 1;
  const weightMaxScale = options.sketch.stroke?.weightMaxScale ?? 1;
  const weightEasing = options.sketch.stroke?.weightEasing ?? "easeInOutExpo";
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;
  const translateXMult = options.sketch.translation?.xMultiplier ?? 1;
  const translateYMult = options.sketch.translation?.yMultiplier ?? 1;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const cellSize = ( cellWidth + cellHeight ) / 2;

  const offsetAt = (
    speed, divisor, useCos, frameT
  ) => p.map(
    useCos ? p.cos( frameT * speed ) : p.sin( frameT * speed ),
    -1,
    1,
    0,
    1
  ) / divisor;

  const xOff = offsetAt(
    xSpeed,
    xRangeDivisor,
    false,
    t
  );
  const yOff = offsetAt(
    ySpeed,
    yRangeDivisor,
    true,
    t
  );
  const zOff = offsetAt(
    zSpeed,
    zRangeDivisor,
    true,
    t
  );

  const range = computeFieldRange( {
    key: `v2-${ seed }-${ detail }-${ falloff }-${ columns }-${ rows }-${ angleCycles }-${ xSpeed }-${ ySpeed }-${ zSpeed }-${ xRangeDivisor }-${ yRangeDivisor }-${ zRangeDivisor }-${ p.width }-${ p.height }`,
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
        col / columns + offsetAt(
          xSpeed,
          xRangeDivisor,
          false,
          frameT
        ),
        row / rows + offsetAt(
          ySpeed,
          yRangeDivisor,
          true,
          frameT
        ),
        offsetAt(
          zSpeed,
          zRangeDivisor,
          true,
          frameT
        )
      ) * ( p.TAU * angleCycles );
    }
  } );

  field.render( {
    seed,
    octaves: detail,
    falloff,
    columns,
    rows,
    background: options.sketch.backgroundColor ?? [
      0,
      0,
      0
    ],
    uniforms: {
      uXOff: xOff,
      uYOff: yOff,
      uZOff: zOff,
      uAngleCycles: angleCycles,
      uMin: range.min,
      uWeightMin: weightMin,
      uWeightMax: cellSize * weightMaxScale,
      uTranslateXMult: translateXMult,
      uTranslateYMult: translateYMult,
      uHueRange: hueRange,
      uHueOffset: hueOffset,
      uOpacityFactor: opacityFactor,
      uWeightEasing: easingId( weightEasing )
    }
  } );

  renderTitle();
} );
