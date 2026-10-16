// ─────────────────────────────────────────────────────────────────────────────
// The GLSL half of utils/palettes.js: the palette ramp a shader sketch reads
// when a preset is picked, and the house colour functions with that ramp in
// front of them. Each keeps the sketch's own arithmetic while `uPaletteOn` is
// 0 (the "original" palette, pixel-identical), so a document without a
// palette renders exactly as before. `shaderPalette()` supplies the texture
// (a noiseFieldGpu data texture, NEAREST — hence the hand interpolation) and
// the switch.
// ─────────────────────────────────────────────────────────────────────────────

export const PALETTE_RAMP_GLSL = `
  uniform sampler2D uPaletteRamp;
  uniform float uPaletteOn;

  const float PALETTE_RAMP_WIDTH = 256.0;

  vec3 paletteRamp(float x) {
    float s  = fract(x) * PALETTE_RAMP_WIDTH - 0.5;
    float i0 = floor(s);
    float f  = s - i0;
    float x0 = (mod(i0, PALETTE_RAMP_WIDTH) + 0.5) / PALETTE_RAMP_WIDTH;
    float x1 = (mod(i0 + 1.0, PALETTE_RAMP_WIDTH) + 0.5) / PALETTE_RAMP_WIDTH;

    return mix(
      texture2D(uPaletteRamp, vec2(x0, 0.5)).rgb,
      texture2D(uPaletteRamp, vec2(x1, 0.5)).rgb,
      f
    );
  }
`;

// The stdlib's `paletteRainbow` (noiseFieldGpu) with a palette in front: the
// ramp is read at (hueOffset + hueIndex) / 2π — one loop per rainbow turn —
// and dimmed by the same opacity factor.
export const PALETTE_RAINBOW_GLSL = `${ PALETTE_RAMP_GLSL }
  vec3 paletteRainbowRamp(float hueOffset, float hueIndex, float opacityFactor) {
    if (uPaletteOn > 0.5) {
      return clamp(paletteRamp((hueOffset + hueIndex) / TAU) / opacityFactor, 0.0, 1.0);
    }

    return paletteRainbow(hueOffset, hueIndex, opacityFactor);
  }
`;
