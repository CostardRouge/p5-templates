import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// torsade-shaders v1 — melted.
//
// A GPU re-imagining of "torsade v7 — melted" (which stays untouched). The CPU
// original walked each spiral with hundreds of lerp steps and stamped two
// large, heavily overlapping circles per step (a mirrored pair offset by a
// sin/cos wave). The overlap is what gives the "melted" look — a thick, molten
// double strand rather than discrete dots. Doing that per circle on the CPU is
// the slow part, so here the whole grid of spirals is evaluated in a single
// full-screen fragment shader: every pixel scans the spirals' samples, unions
// the discs, and keeps the disc drawn last (highest order) to match the
// original's painter ordering.
//
// Colour is reworked into an iridescent, oil-slick palette: a cosine spectrum
// that cycles along each strand and shimmers across the width of every disc, so
// the molten ribbons read as thin-film / soap-bubble iridescence instead of the
// old flat rainbow.
//
// The CPU grid plumbing (rebuildGrid / SpiralBase) is no longer needed: the
// shader rebuilds the layout from xCount/yCount/sizeDivisor/axis directly.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DIM = 20; // matches the layout sliders' max (xCount / yCount)
const MAX_SAMPLES = 320; // upper bound on lerp samples per spiral

const FRAGMENT = `
  uniform float uTime;
  uniform float uXCount;
  uniform float uYCount;
  uniform float uSizeDivisor;
  uniform float uWaveAmpDiv;
  uniform float uCircleSize;
  uniform float uCadenceMin;
  uniform float uCadenceMax;
  uniform float uCadenceSpeed;
  uniform float uCadenceIndexScale;
  uniform float uSamples;
  uniform int   uAxis;            // 0 = vertical, 1 = horizontal

  // Iridescent palette controls.
  uniform float uHueSpeed;        // how fast the spectrum scrolls over time
  uniform float uHueSpread;       // spectral cycles packed along a strand
  uniform float uHuePhase;        // base hue rotation
  uniform float uIndexHueShift;   // hue offset between spirals in the grid
  uniform float uShimmer;         // oil-slick sheen across each disc's width
  uniform float uSaturation;
  uniform float uBrightness;

  // Oil-slick / thin-film iridescence: a cosine spectrum (IQ palette) with the
  // RGB channels phase-shifted so the hue sweeps cleanly through the rainbow.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  void spiralAxis(out vec2 s, out vec2 e) {
    if (uAxis == 1) {
      s = vec2( uResolution.x * 0.5, 0.0);
      e = vec2(-uResolution.x * 0.5, 0.0);
    } else {
      s = vec2(0.0, -uResolution.y * 0.5);
      e = vec2(0.0,  uResolution.y * 0.5);
    }
  }

  void main() {
    // Top-left origin, matching the p5 2D coordinates the original drew in.
    vec2 frag = vec2(vUv.x * uResolution.x, (1.0 - vUv.y) * uResolution.y);

    int xc = int(uXCount + 0.5);
    int yc = int(uYCount + 0.5);

    float size = (uResolution.x + uResolution.y) * 0.5
      / (uXCount + uYCount) / uSizeDivisor;
    float waveAmp = size / uWaveAmpDiv;
    float radius = uCircleSize * 0.5;

    vec2 s, e;
    spiralAxis(s, e);

    float samples = uSamples;
    float perSpiral = samples * 2.0; // two mirrored discs per lerp step

    float bestOrder = -1.0;
    vec3 bestColor = vec3(0.0);
    float bestMask = 0.0;

    for (int gx = 1; gx <= ${ MAX_DIM }; gx++) {
      if (gx > xc) { break; }

      for (int gy = 1; gy <= ${ MAX_DIM }; gy++) {
        if (gy > yc) { break; }

        // rebuildGrid(): grid index counts y fastest, then x.
        float index = float(gx - 1) * uYCount + float(gy - 1);

        vec2 position = vec2(
          mix(0.0, uResolution.x, float(gx) / (uXCount + 1.0)),
          mix(0.0, uResolution.y, float(gy) / (uYCount + 1.0))
        );

        float spiralBase = index * perSpiral;
        float hueCadence = uTime * uHueSpeed + index * uIndexHueShift;

        for (int i = 0; i < ${ MAX_SAMPLES }; i++) {
          if (float(i) >= samples) { break; }

          float lerpIndex = float(i) / samples;
          float angle = mix(-PI, PI, lerpIndex);
          vec2 lerpPos = position + mix(s, e, lerpIndex);

          float cadence = remap(
            sin(uTime * uCadenceSpeed + lerpIndex + index * uCadenceIndexScale),
            -1.0, 1.0, uCadenceMin, uCadenceMax
          );
          float waveIndex = angle * cadence;
          float xOff = remap(sin(waveIndex), -1.0, 1.0, -waveAmp, waveAmp);
          float yOff = remap(cos(waveIndex), -1.0, 1.0, -waveAmp, waveAmp);

          vec2 offset = vec2(xOff, yOff);
          float huePhase = (angle + hueCadence) / TAU;

          // Disc A (drawn first), then disc B (drawn last → wins on overlap).
          vec2 cA = lerpPos + offset;
          float mA = discMask(frag - cA, radius);
          float orderA = spiralBase + float(i) * 2.0;

          if (mA > 0.001 && orderA >= bestOrder) {
            bestOrder = orderA;
            bestMask = mA;
            bestColor = iridescent(huePhase + uShimmer * (length(frag - cA) / radius));
          }

          vec2 cB = lerpPos - offset;
          float mB = discMask(frag - cB, radius);
          float orderB = orderA + 1.0;

          if (mB > 0.001 && orderB >= bestOrder) {
            bestOrder = orderB;
            bestMask = mB;
            bestColor = iridescent(huePhase + uShimmer * (length(frag - cB) / radius));
          }
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

const torsade = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( ( time ) => {
  const p = getP5();
  const o = options.sketch ?? {};
  const layout = o.layout ?? {};
  const spiral = o.spiral ?? {};
  const motion = o.motion ?? {};
  const colors = o.colors ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const xCount = Math.min(
    layout.xCount ?? 1,
    MAX_DIM
  );
  const yCount = Math.min(
    layout.yCount ?? 1,
    MAX_DIM
  );
  const samples = Math.min(
    spiral.lerpSteps ?? 200,
    MAX_SAMPLES
  );

  torsade.render( {
    columns: 1,
    rows: 1,
    uniforms: {
      uTime: time,
      uXCount: xCount,
      uYCount: yCount,
      uSizeDivisor: layout.sizeDivisor ?? 3.5,
      uWaveAmpDiv: spiral.waveAmplitudeDivisor ?? 3.5,
      uCircleSize: spiral.circleSize ?? 200,
      uCadenceMin: spiral.cadenceMin ?? -4,
      uCadenceMax: spiral.cadenceMax ?? 4,
      uCadenceSpeed: motion.cadenceSpeed ?? 1,
      uCadenceIndexScale: motion.cadenceIndexScale ?? 0,
      uSamples: samples,
      uAxis: {
        int: ( layout.axis ?? "vertical" ) === "horizontal" ? 1 : 0
      },
      uHueSpeed: colors.hueSpeed ?? 1,
      uHueSpread: colors.hueSpread ?? 1,
      uHuePhase: colors.huePhase ?? 0,
      uIndexHueShift: colors.indexHueShift ?? 1,
      uShimmer: colors.shimmer ?? 1.5,
      uSaturation: colors.saturation ?? 1,
      uBrightness: colors.brightness ?? 1
    }
  } );
} );
