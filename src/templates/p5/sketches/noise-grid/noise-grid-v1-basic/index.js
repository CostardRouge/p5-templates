import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import {
  createInstancedFieldRenderer
} from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// GPU port of "noise grid v1 — basic" (instanced).
//
// One constant-size dot per cell, displaced from its centre by (sin, cos) of the
// noise angle so dots cross into neighbouring cells — hence the instanced path.
// Colour comes from cos(angle): hue spread by a cycling "precision" sequence and
// opacity by the same cos. The palette is selectable (rainbow / purple / …).
// ─────────────────────────────────────────────────────────────────────────────

// circularIndex(paletteIndex, [A, B]) → one palette name; map it to a shader id.
const PALETTE_IDS = {
  rainbow: 0,
  purple: 1,
  darkBlueYellow: 2
};

const VERTEX = `
  uniform float uXMult;
  uniform float uYMult;
  uniform float uTimeX;
  uniform float uTimeY;
  uniform float uTimeZ;
  uniform float uT;
  uniform float uAngleCycles;
  uniform float uTranslateScale;
  uniform float uYTranslateMult;
  uniform float uColorPrecision;
  uniform float uHueOffset;
  uniform float uOpacityMin;
  uniform float uOpacityMax;
  uniform int uPalette;

  void computeInstance(
    float col, float row,
    out vec2 center, out vec2 halfSize, out vec3 color, out vec4 params
  ) {
    float scale = (uCellWidth + uCellHeight) * 0.5;

    float nx = (col / uColumns) * uXMult + uT * uTimeX;
    float ny = (row / uRows) * uYMult + uT * uTimeY;
    float angle = perlinNoise(vec3(nx, ny, uT * uTimeZ)) * TAU * uAngleCycles;

    vec2 cellCenter = vec2(
      col * uCellWidth + uCellWidth * 0.5,
      row * uCellHeight + uCellHeight * 0.5
    );
    center = cellCenter + vec2(
      scale * sin(angle),
      scale * cos(angle) * uYTranslateMult
    );

    float radius = max(scale * uTranslateScale * 0.5, 0.0);
    halfSize = vec2(radius + 1.0);
    params = vec4(radius, 0.0, 0.0, 0.0);

    // z = zMax * cos(angle), so map(z, -zMax, zMax, …) collapses to map(cos, -1, 1, …).
    float c = cos(angle);
    float hueIndex = remap(c, -1.0, 1.0, -PI, PI) * uColorPrecision;
    float opacity = remap(c, -1.0, 1.0, uOpacityMax, uOpacityMin);

    color = paletteColor(uPalette, uHueOffset, hueIndex, opacity);
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
  const columns = options.sketch.grid?.columns ?? 30;

  const seed = options.sketch.noise?.seed ?? 42;
  const detail = options.sketch.noise?.detail ?? 3;
  const falloff = options.sketch.noise?.falloff ?? 0.45;
  const noiseXMult = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 1;
  const noiseTimeX = options.sketch.noise?.timeXMultiplier ?? -1;
  const noiseTimeY = options.sketch.noise?.timeYMultiplier ?? 0.2;
  const noiseTimeZ = options.sketch.noise?.timeZMultiplier ?? 0.07;
  const angleCycles = options.sketch.angle?.cycles ?? 4;

  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;
  const paletteValues = options.sketch.colors?.precisionValues ?? [
    0.1,
    0.5,
    1,
    2
  ];
  const paletteNames = [
    options.sketch.colors?.paletteA ?? "rainbow",
    options.sketch.colors?.paletteB ?? "purple"
  ];
  const paletteName = mappers.circularIndex(
    options.sketch.colors?.paletteIndex ?? 0,
    paletteNames
  );

  const translateScale = options.sketch.translation?.scale ?? 1;
  const yTranslateMultiplier = options.sketch.translation?.yMultiplier ?? 2;

  const colorPrecision = animation.sequence(
    "noise-grid-v1-precision",
    t / 2,
    paletteValues
  );

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
      uXMult: noiseXMult,
      uYMult: noiseYMult,
      uTimeX: noiseTimeX,
      uTimeY: noiseTimeY,
      uTimeZ: noiseTimeZ,
      uT: t,
      uAngleCycles: angleCycles,
      uTranslateScale: translateScale,
      uYTranslateMult: yTranslateMultiplier,
      uColorPrecision: colorPrecision,
      uHueOffset: hueOffset,
      uOpacityMin: opacityMin,
      uOpacityMax: opacityMax,
      uPalette: {
        int: PALETTE_IDS[ paletteName ] ?? 0
      }
    }
  } );
} );
