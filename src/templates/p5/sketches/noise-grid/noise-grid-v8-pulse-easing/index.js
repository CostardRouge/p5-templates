import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import createNoiseFieldRenderer, {
  computeFieldRange
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v8 — pulse easing".
//
// Dots at each cell centre; the weight is an eased mapping of the noise angle
// and the noise falloff pulses with a bass-like sine. The original normalised
// against a min accumulated across frames; here it's pre-computed once over the
// loop (see computeFieldRange) so there's no warm-up. Dots never overlap at the
// default sizes, so each pixel shades its own cell.
// ─────────────────────────────────────────────────────────────────────────────

const FRAGMENT = `
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

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    float col = floor(frag.x / uCellWidth);
    float row = floor(frag.y / uCellHeight);

    vec2 cellCenter = vec2(
      col * uCellWidth + uCellWidth * 0.5,
      row * uCellHeight + uCellHeight * 0.5
    );

    float nx = (col * uCellWidth) / uColumns;
    float ny = (row * uCellHeight) / uRows + uT * uYTimeMult;
    float angle = perlinNoise(vec3(nx, ny, uT * uZTimeMult)) * TAU * uAngleCycles;

    float weight = remap(
      easeInOutCubic(remap(angle, uMin, TAU, 0.0, 1.0)),
      0.0,
      1.0,
      uWeightMin,
      uWeightMax
    );
    float radius = weight * 0.5;

    float dist = distance(frag, cellCenter);
    float mask = 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);

    if (mask <= 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float hueIndex = remap(angle, uMin, TAU, -uHueRange, uHueRange);

    gl_FragColor = vec4(paletteRainbow(uHueOffset, hueIndex, uOpacityFactor), mask);
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
  const detailLod = options.sketch.noise?.detailLod ?? 8;
  const pulseSpeed = options.sketch.pulse?.speed ?? 2;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.2;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.1;
  const weightMin = options.sketch.stroke?.weightMin ?? 1;
  const weightMax = options.sketch.stroke?.weightMax ?? 10;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  // Bass-like pulse drives the noise falloff (per frame).
  const bass = mappers.fn(
    p.sin( t * pulseSpeed ),
    -1,
    1,
    0,
    1,
    easing.easeInOutSine
  );

  // Converged angle range over the whole loop (falloff varies with the pulse).
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
      uWeightMax: weightMax
    }
  } );

  renderTitle();
} );
