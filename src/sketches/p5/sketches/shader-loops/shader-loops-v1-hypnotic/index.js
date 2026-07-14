import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// shader-loops v1 — hypnotic.
//
// The "ambient wallpaper" format: a full-screen fragment shader tuned to be
// GUARANTEED seamlessly loopable and endlessly re-watchable — the kind of clip
// that racks up saves. Three hypnotic looks share one shader, chosen by
// `pattern`:
//
//   tunnel  — an infinite log-polar zoom tunnel that falls forever inward
//   kaleido — an N-fold kaleidoscope mandala breathing out from the centre
//   moire   — two interfering ring fields sliding through each other
//
// The seamless-loop guarantee is structural, not tuned by eye. Everything
// animates off the canonical loop phase φ = animation.progression ∈ [0,1), and
// every time-varying term is an INTEGER number of cycles over the loop
// (`…Loops` / `spin` uniforms, stepped to whole numbers in the form). A sine or
// cosine whose argument advances by an integer × TAU across the loop returns to
// exactly its starting value, so the last rendered frame meets the first with
// no jump — at any duration. The colour cycle is the same idea: the palette's
// hue offset is `φ · hueCycles`, so the spectrum scrolls a whole number of
// times and lands back on its starting hue. That is the "colour-cycle bound to
// an oscillator" — the oscillator is the loop itself.
//
// Angular terms use whole-number symmetry/arm counts too, because atan()'s
// branch cut at ±π only stays continuous when the pattern has integer angular
// frequency — otherwise a hairline seam runs down one side.
// ─────────────────────────────────────────────────────────────────────────────

const PATTERN_IDS = {
  tunnel: 0,
  kaleido: 1,
  moire: 2
};

const PALETTE_IDS = {
  rainbow: 0,
  purple: 1,
  darkBlueYellow: 2,
  iridescent: 3
};

const FRAGMENT = `
  uniform float uPhase;         // loop phase φ ∈ [0,1)
  uniform int   uPattern;       // 0 tunnel, 1 kaleido, 2 moire

  // Geometry
  uniform float uSymmetry;      // kaleidoscope fold count (integer)
  uniform float uArms;          // angular frequency / arm count (integer)
  uniform float uBands;         // radial frequency (rings across the radius)
  uniform float uZoomCycles;    // radial scroll cycles per loop (integer)
  uniform float uSpin;          // full rotations per loop (integer)
  uniform float uWarp;          // angular warp depth

  // Colour
  uniform int   uPaletteId;     // 0 rainbow, 1 purple, 2 darkBlueYellow, 3 iridescent
  uniform float uHueCycles;     // full colour cycles per loop (integer)
  uniform float uHueSpread;     // how much of the spectrum the pattern spans
  uniform float uHuePhase;      // static hue rotation (0..1)
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;

  // Scene
  uniform float uVignette;
  uniform float uBreath;        // gentle brightness pulse, one breath per loop
  uniform vec3  uBackground;    // 0..1 colour the vignette edges fade toward

  // Oil-slick / thin-film iridescence: a cosine spectrum (IQ palette) with the
  // RGB channels phase-shifted so the hue sweeps cleanly through the rainbow.
  // Saturation is applied once in main(), globally, so it works for every
  // palette (not just this one).
  vec3 iridescent(float t) {
    return clamp(0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67))), 0.0, 1.0);
  }

  // Map a 0..1 pattern value to a colour. The hue offset is bound to the loop
  // (φ · hueCycles) so the whole spectrum scrolls an integer number of times and
  // returns exactly to its starting hue — a seamless colour cycle.
  vec3 palette(float value) {
    float loopHue = uPhase * uHueCycles + uHuePhase;

    if (uPaletteId == 3) {
      return iridescent(uHueSpread * value + loopHue);
    }

    return paletteColor(
      uPaletteId,
      loopHue * TAU,
      value * uHueSpread * TAU,
      1.0
    );
  }

  // Infinite zoom tunnel: rings scroll inward in log-polar space (so they never
  // change size, they only fall toward the centre) while the arms rotate.
  float tunnelPattern(vec2 p, float phi) {
    float a = atan(p.y, p.x);
    float r = length(p) + 1e-4;
    float depth = uBands * log(r) + phi * uZoomCycles;
    float twist = a * uArms - phi * TAU * uSpin;

    // Fade the rings to flat mid-grey at the very centre: in log-polar the ring
    // frequency diverges as r→0, so without this the core aliases into a
    // shimmering pinpoint. This turns it into a clean vanishing point.
    float core = smoothstep(0.0, 0.06, length(p));

    return 0.5 + 0.5 * cos(TAU * depth + uWarp * sin(twist)) * core;
  }

  // Kaleidoscope mandala: fold the angle into uSymmetry mirrored wedges, then
  // ripple concentric petals outward.
  float kaleidoPattern(vec2 p, float phi) {
    float a = atan(p.y, p.x) + phi * TAU * uSpin;
    float seg = TAU / max(uSymmetry, 1.0);

    a = mod(a, seg);
    a = abs(a - seg * 0.5);

    float r = length(p);
    float petals = cos(uBands * TAU * r - phi * TAU * uZoomCycles + uWarp * cos(a * uArms));

    return 0.5 + 0.5 * petals;
  }

  // Moiré: two ring fields at slightly different radial frequencies slide
  // through each other in opposite directions, so their interference crawls.
  float moirePattern(vec2 p, float phi) {
    float a = atan(p.y, p.x);
    float r = length(p) * (1.0 + 0.08 * uWarp * sin(a * uArms + phi * TAU * uSpin));

    float w1 = cos(uBands * TAU * r - phi * TAU * uZoomCycles + a * uArms);
    float w2 = cos(uBands * TAU * r * 1.37 + phi * TAU * uZoomCycles - a * uArms);

    return 0.5 + 0.5 * w1 * w2;
  }

  void main() {
    vec2 res = uResolution;
    // Centre the field and normalise by the short axis so the pattern fills any
    // aspect (portrait 9:16, square, landscape) without stretching.
    vec2 p = (vUv * res - 0.5 * res) / min(res.x, res.y);

    float phi = uPhase;
    float value;

    if (uPattern == 1) {
      value = kaleidoPattern(p, phi);
    } else if (uPattern == 2) {
      value = moirePattern(p, phi);
    } else {
      value = tunnelPattern(p, phi);
    }

    // Contrast shaping around the mid-grey pivot.
    value = clamp(0.5 + (value - 0.5) * uContrast, 0.0, 1.0);

    vec3 col = palette(value);

    // Saturation, applied uniformly to every palette (mirrors brightness /
    // contrast, which are also global).
    float luma = dot(col, vec3(0.299, 0.587, 0.114));

    col = clamp(mix(vec3(luma), col, uSaturation), 0.0, 1.0);

    // One brightness breath per loop — sin(φ·TAU) is 0 at both ends, so it never
    // breaks the seam.
    col *= uBrightness * (1.0 + uBreath * sin(phi * TAU));

    // Radial vignette sinks the edges toward the background colour and pulls the
    // eye to the centre. At the centre vig = 1 (pure pattern); at the rim it
    // reveals uBackground, so the Background-colour control is meaningful.
    float vig = 1.0 - uVignette * smoothstep(0.3, 0.95, length(p));

    col = mix(uBackground, col, vig);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

const loops = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const geometry = o.geometry ?? {};
  const colors = o.colors ?? {};
  const scene = o.scene ?? {};
  const background = scene.backgroundColor ?? [
    0,
    0,
    0
  ];

  p.clear();
  p.background( ...background );

  const patternId = PATTERN_IDS[ o.pattern ] ?? PATTERN_IDS.tunnel;
  const paletteId = PALETTE_IDS[ colors.palette ] ?? PALETTE_IDS.iridescent;

  loops.render( {
    columns: 1,
    rows: 1,
    resolutionScale: scene.resolutionScale ?? 1,
    uniforms: {
      uPhase: animation.progression,
      uPattern: {
        int: patternId
      },
      uSymmetry: geometry.symmetry ?? 6,
      uArms: geometry.arms ?? 3,
      uBands: geometry.bands ?? 6,
      uZoomCycles: geometry.zoomCycles ?? 1,
      uSpin: geometry.spin ?? 1,
      uWarp: geometry.warp ?? 1.5,
      uPaletteId: {
        int: paletteId
      },
      uHueCycles: colors.hueCycles ?? 1,
      uHueSpread: colors.hueSpread ?? 1,
      uHuePhase: colors.huePhase ?? 0,
      uSaturation: colors.saturation ?? 1,
      uBrightness: colors.brightness ?? 1,
      uContrast: colors.contrast ?? 1.3,
      uVignette: scene.vignette ?? 0.6,
      uBreath: scene.breath ?? 0.08,
      uBackground: [
        ( background[ 0 ] ?? 0 ) / 255,
        ( background[ 1 ] ?? 0 ) / 255,
        ( background[ 2 ] ?? 0 ) / 255
      ]
    }
  } );
} );
