import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import drawInstrument from "../_instrument.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIGNALS — 03 / TORSADE
//
// The third sibling in the twisting-filament family: a single molten double
// strand spiralling down the frame — the GPU "torsade v1 — melted" SDF, lifted
// verbatim and reduced to one centred vertical spiral. Where the serpent is a
// ribbon of segments and the braid is clean 3D tubes, the torsade is painterly:
// two mirrored discs stamped along a winding wave, unioned per pixel, so the
// strand reads as thick, fused, liquid metal. Dressed in the SIGNALS identity:
// pure black, low-saturation oil-slick palette, the shared instrument frame.
//
// Loop safety (250-frame / 25 fps seamless loop): the whole field is a function
// of uTime through hue scroll (uTime·hueSpeed) and the cadence wave
// (sin(uTime·cadenceSpeed + …)). Driving uTime from animation.angle (0 → TAU)
// with integer hueSpeed / cadenceSpeed, and hueSpread chosen so hueSpread·hueSpeed
// is an integer, makes uTime = 0 identical to uTime = TAU.
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

  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uIndexHueShift;
  uniform float uShimmer;
  uniform float uSaturation;
  uniform float uBrightness;

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
      // 12% vertical overscan so the strand bleeds off the top and bottom edges
      // (its end-cap discs fall outside the frame) instead of terminating on-screen.
      s = vec2(0.0, -uResolution.y * 0.56);
      e = vec2(0.0,  uResolution.y * 0.56);
    }
  }

  void main() {
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
    float perSpiral = samples * 2.0;

    float bestOrder = -1.0;
    vec3 bestColor = vec3(0.0);
    float bestMask = 0.0;

    for (int gx = 1; gx <= ${ MAX_DIM }; gx++) {
      if (gx > xc) { break; }

      for (int gy = 1; gy <= ${ MAX_DIM }; gy++) {
        if (gy > yc) { break; }

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

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const layout = o.layout ?? {};
  const spiral = o.spiral ?? {};
  const motion = o.motion ?? {};
  const colors = o.colors ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0,
    255
  ] ) );

  // Seamless loop: drive uTime over exactly one TAU. timeScale stays an integer.
  const timeScale = o.timeScale ?? 1;
  const time = animation.angle * timeScale;

  const xCount = Math.min(
    layout.xCount ?? 1,
    MAX_DIM
  );
  const yCount = Math.min(
    layout.yCount ?? 1,
    MAX_DIM
  );
  const samples = Math.min(
    spiral.lerpSteps ?? 220,
    MAX_SAMPLES
  );
  const sizeDivisor = layout.sizeDivisor ?? 3.5;
  const waveAmpDiv = spiral.waveAmplitudeDivisor ?? 3.0;
  const circleSize = spiral.circleSize ?? 180;
  const cadenceMin = spiral.cadenceMin ?? -3;
  const cadenceMax = spiral.cadenceMax ?? 3;
  const cadenceSpeed = motion.cadenceSpeed ?? 1;
  const axisVertical = ( layout.axis ?? "vertical" ) !== "horizontal";

  torsade.render( {
    columns: 1,
    rows: 1,
    uniforms: {
      uTime: time,
      uXCount: xCount,
      uYCount: yCount,
      uSizeDivisor: sizeDivisor,
      uWaveAmpDiv: waveAmpDiv,
      uCircleSize: circleSize,
      uCadenceMin: cadenceMin,
      uCadenceMax: cadenceMax,
      uCadenceSpeed: cadenceSpeed,
      uCadenceIndexScale: motion.cadenceIndexScale ?? 0,
      uSamples: samples,
      uAxis: {
        int: axisVertical ? 0 : 1
      },
      uHueSpeed: colors.hueSpeed ?? 1,
      uHueSpread: colors.hueSpread ?? 1,
      uHuePhase: colors.huePhase ?? 0,
      uIndexHueShift: colors.indexHueShift ?? 1,
      uShimmer: colors.shimmer ?? 0.25,
      uSaturation: colors.saturation ?? 0.24,
      uBrightness: colors.brightness ?? 1.1
    }
  } );

  // ── structural instrument frame ─────────────────────────────────────────────
  if ( o.hud?.show ?? true ) {
    const W = p.width;
    const H = p.height;
    const cx = W / 2;

    // The strand is a centred column. Its horizontal envelope is the wave sway
    // (±waveAmp) plus the disc radius; reconstruct it the way the shader does.
    const size = ( W + H ) * 0.5 / ( xCount + yCount ) / sizeDivisor;
    const waveAmp = size / waveAmpDiv;
    const radius = circleSize * 0.5;
    const halfW = waveAmp + radius;

    // Lock the reticle on a point that rides the strand near the top, undulating
    // with the same cadence wave.
    const lh = 0.08;
    const angle = -p.PI + 2 * p.PI * lh;
    const cadence = p.map(
      Math.sin( time * cadenceSpeed + lh ),
      -1,
      1,
      cadenceMin,
      cadenceMax
    );
    const waveIndex = angle * cadence;
    const headX = axisVertical
      ? cx + p.map(
        Math.sin( waveIndex ),
        -1,
        1,
        -waveAmp,
        waveAmp
      )
      : cx;
    const headY = H * lh + p.map(
      Math.cos( waveIndex ),
      -1,
      1,
      -waveAmp,
      waveAmp
    );

    const vMargin = o.hud?.verticalMargin ?? 0.05;

    drawInstrument(
      p,
      {
        box: {
          minX: cx - halfW,
          minY: H * vMargin,
          maxX: cx + halfW,
          maxY: H * ( 1 - vMargin )
        },
        head: {
          x: headX,
          y: headY
        },
        hudColor: o.hud?.color ?? [
          180,
          230,
          210
        ],
        label: o.hud?.label ?? "SIGNALS",
        spec: "SPEC.03 / TORSADE",
        rows: [
          "STRAND 2",
          `CADENCE ${ cadenceMax.toFixed( 1 ) }`,
          `WAVE  ${ Math.round( waveAmp ) }`,
          `PHASE ${ String( Math.round( ( animation.progression * 360 ) % 360 ) ).padStart(
            3,
            "0"
          ) }°`
        ]
      }
    );
  }
} );
