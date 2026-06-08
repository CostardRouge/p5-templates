import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import {
  createInstancedFieldRenderer,
  computeFieldRange,
  easingId
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v8 — pulse easing" (instanced).
//
// One dot per cell. The weight is an UNCLAMPED eased mapping of the noise angle,
// and the noise falloff pulses with a bass-like sine — on the pulse the falloff
// reaches 1.0, the Perlin sum (and the angle) shoots far past TAU, and
// easeInOutCubic extrapolates the dot to canvas-filling sizes. The instanced
// renderer draws each cell as its own quad in grid order with alpha blending, so
// the blown-up discs stack in the original's draw order at any size.
// ─────────────────────────────────────────────────────────────────────────────

const VERTEX = `
  uniform float uAngleCycles;
  uniform float uYTimeMult;
  uniform float uZTimeMult;
  uniform float uT;
  uniform float uMin;
  uniform float uHueRange;
  uniform float uHueOffset;
  uniform float uOpacityFactor;
  uniform float uWeightMin;
  uniform float uWeightMax;
  uniform int uWeightEasing;

  void computeInstance(
    float col, float row,
    out vec2 center, out vec2 halfSize, out vec3 color, out vec4 params
  ) {
    center = vec2(
      col * uCellWidth + uCellWidth * 0.5,
      row * uCellHeight + uCellHeight * 0.5
    );

    float nx = (col * uCellWidth) / uColumns;
    float ny = (row * uCellHeight) / uRows + uT * uYTimeMult;
    float angle = perlinNoise(vec3(nx, ny, uT * uZTimeMult)) * TAU * uAngleCycles;

    // Unclamped, exactly like the original — extrapolates on the pulse.
    float weight = remap(
      applyEasing(uWeightEasing, remap(angle, uMin, TAU, 0.0, 1.0)),
      0.0,
      1.0,
      uWeightMin,
      uWeightMax
    );
    float radius = max(weight * 0.5, 0.0);

    halfSize = vec2(radius + 1.0);
    params = vec4(radius, 0.0, 0.0, 0.0);

    float hueIndex = remap(angle, uMin, TAU, -uHueRange, uHueRange);
    color = paletteRainbow(uHueOffset, hueIndex, uOpacityFactor);
  }
`;

const FRAGMENT = `
  float coverage(vec2 local, vec4 params) {
    float radius = params.x;
    float dist = length(local);

    return 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
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
  const detailLod = options.sketch.noise?.detailLod ?? 8;
  const pulseSpeed = options.sketch.pulse?.speed ?? 2;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.2;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.1;
  const weightMin = options.sketch.stroke?.weightMin ?? 1;
  const weightMax = options.sketch.stroke?.weightMax ?? 10;
  const weightEasing = options.sketch.stroke?.weightEasing ?? "easeInOutCubic";
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const bass = mappers.fn(
    p.sin( t * pulseSpeed ),
    -1,
    1,
    0,
    1,
    easing.easeInOutSine
  );

  const range = computeFieldRange( {
    key: `v8-${ seed }-${ detailLod }-${ columns }-${ rows }-${ angleCycles }-${ yTimeMult }-${ zTimeMult }-${ pulseSpeed }-${ p.width }-${ p.height }`,
    columns,
    rows,
    prepareFrame: ( u ) => {
      const frameBass = mappers.fn(
        p.sin( u * p.TAU * pulseSpeed ),
        -1,
        1,
        0,
        1,
        easing.easeInOutSine
      );

      p.noiseSeed( seed );
      p.noiseDetail(
        detailLod,
        frameBass
      );
    },
    sampleAt: (
      col, row, u
    ) => {
      const frameT = u * p.TAU;

      return p.noise(
        ( col * cellWidth ) / columns,
        ( row * cellHeight ) / rows + frameT * yTimeMult,
        frameT * zTimeMult
      ) * ( p.TAU * angleCycles );
    }
  } );

  field.render( {
    seed,
    octaves: detailLod,
    falloff: bass,
    columns,
    rows,
    background: options.sketch.backgroundColor ?? [
      0,
      0,
      0
    ],
    uniforms: {
      uAngleCycles: angleCycles,
      uYTimeMult: yTimeMult,
      uZTimeMult: zTimeMult,
      uT: t,
      uMin: range.min,
      uHueRange: hueRange,
      uHueOffset: hueOffset,
      uOpacityFactor: opacityFactor,
      uWeightMin: weightMin,
      uWeightMax: weightMax,
      uWeightEasing: easingId( weightEasing )
    }
  } );

  renderTitle();
} );
