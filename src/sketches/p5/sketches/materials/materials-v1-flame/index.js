import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

import {
  RAMP_WIDTH,
  resolveLook,
  materialRender,
  drawBackground
} from "@/p5/sketches/iridescent/_iridescence.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// materials-v1-flame
//
// A flame as a VOLUME: every pixel marches a ray through a teardrop of hot gas
// whose edge is eaten by 3D noise scrolling upwards, and adds up the light it
// meets. Its colour is a ramp read by TEMPERATURE (0 = the cold edge, 1 = the
// core) — the iridescent category's ramp, borrowed with its palette picker
// and nothing else of that material, a flame having no surface for the rest
// to read: the custom look is a black-body ramp on a near-black ground, and
// any palette turns the same fire into its colours. The light is summed and exposed like
// film (1 - exp), which is what burns the thick core to white.
//
// The loop is exact by construction. The noise lattice is PERIODIC along the
// flame's height, so scrolling it a whole number of periods lands on the frame
// it started from; each octave may ride a whole number of extra periods (the
// shear, which keeps the detail from moving as one rigid sheet); the spin, the
// sway, the flicker and every spark count whole cycles of the loop phase.
// ─────────────────────────────────────────────────────────────────────────────

// Lattice cells the coarsest octave repeats after, along the height. Large on
// purpose: a period the flame crosses several times a loop would show.
const PERIOD = 8;
const MAX_STEPS = 96;
const MAX_SPARKS = 64;

const FRAGMENT = `
  const float PERIOD = ${ PERIOD.toFixed( 1 ) };

  uniform float uPhase;

  // ── Frame: the flame's height and foot, in canvas heights (y up) ──
  uniform float uSize;
  uniform float uBaseY;
  uniform float uCamDist;
  uniform float uBound;         // radius the flame can reach, × its height
  uniform float uTop;           // height it can reach, × its height

  // ── Silhouette ──
  uniform float uWidth;
  uniform float uBelly;
  uniform float uTaper;
  uniform float uProfileNorm;
  uniform float uBase;
  uniform vec2  uLean;
  uniform float uSway;
  uniform float uSwayWave;
  uniform vec2  uSwayPhase;

  // ── Turbulence ──
  uniform float uFreq;
  uniform float uStretch;
  uniform float uDetail;
  uniform float uGain;
  uniform float uScroll;        // lattice cells scrolled so far
  uniform float uShearPhase;    // extra periods per octave index, so far
  uniform float uTurb;
  uniform float uTurbRise;
  uniform float uTwist;
  uniform float uSpin;
  uniform float uMirror;

  // ── Heat and light ──
  uniform float uSteps;
  uniform float uSoft;
  uniform float uCore;
  uniform float uCool;
  uniform float uHeatPower;
  uniform float uIntensity;
  uniform float uExposure;
  uniform float uOpacity;
  uniform vec3  uBlue;
  uniform float uBlueAmount;
  uniform float uFront;
  uniform float uFrontWidth;
  uniform float uBurn;
  uniform float uGlow;
  uniform float uGlowSize;

  // ── Sparks ──
  uniform float uSparkCount;
  uniform float uSparkSize;
  uniform float uSparkRise;
  uniform float uSparkSpread;
  uniform float uSparkDrift;
  uniform float uSparkBright;
  uniform float uSparkSpeed;

  // ── The colour ramp (iridescent's) ──
  uniform sampler2D uRamp;
  uniform float uRampWidth;
  uniform float uBands;
  uniform float uShift;
  uniform float uRampSpan;      // where the last stop sits on the looping ramp

  // The ramp, interpolated by hand between texels (the texture is NEAREST).
  vec3 rampColor(float x) {
    float u  = fract(x);
    float s  = u * uRampWidth - 0.5;
    float i0 = floor(s);
    float f  = s - i0;
    float x0 = (mod(i0, uRampWidth) + 0.5) / uRampWidth;
    float x1 = (mod(i0 + 1.0, uRampWidth) + 0.5) / uRampWidth;

    return mix(texture2D(uRamp, vec2(x0, 0.5)).rgb, texture2D(uRamp, vec2(x1, 0.5)).rgb, f);
  }

  // Temperature 0..1 → colour: first stop to last, never across the seam
  // unless the bands or the drift ask for it.
  vec3 heatColor(float temp) {
    return rampColor(clamp(temp, 0.0, 1.0) * uRampSpan * uBands + uShift);
  }

  float hash11(float x) {
    return fract(sin(x * 127.1) * 43758.5453);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);

    p3 += dot(p3, p3.yzx + 33.33);

    return fract((p3.x + p3.y) * p3.z);
  }

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);

    return fract((p3.x + p3.y) * p3.z);
  }

  // Value noise whose lattice repeats every \`period\` cells along y.
  float latticeNoise(vec3 p, float period) {
    vec3 i = floor(p);
    vec3 f = p - i;
    vec3 u = f * f * (3.0 - 2.0 * f);

    float y0 = mod(i.y, period);
    float y1 = mod(i.y + 1.0, period);

    float a = mix(hash13(vec3(i.x, y0, i.z)),       hash13(vec3(i.x + 1.0, y0, i.z)),       u.x);
    float b = mix(hash13(vec3(i.x, y1, i.z)),       hash13(vec3(i.x + 1.0, y1, i.z)),       u.x);
    float c = mix(hash13(vec3(i.x, y0, i.z + 1.0)), hash13(vec3(i.x + 1.0, y0, i.z + 1.0)), u.x);
    float d = mix(hash13(vec3(i.x, y1, i.z + 1.0)), hash13(vec3(i.x + 1.0, y1, i.z + 1.0)), u.x);

    return mix(mix(a, b, u.y), mix(c, d, u.y), u.z);
  }

  float turbulence(vec3 q) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    float scale = 1.0;

    for (int i = 0; i < 6; i++) {
      if (float(i) >= uDetail) { break; }

      vec3 s = q * scale + float(i) * vec3(17.3, 0.0, 9.1);

      s.y -= float(i) * uShearPhase * PERIOD * scale;
      sum += amp * latticeNoise(s, PERIOD * scale);
      norm += amp;
      amp *= uGain;
      scale *= 2.0;
    }

    return sum / max(norm, 1e-4);
  }

  // (density, temperature, flame front) at a point of the flame's own space: y is 0 at the
  // foot and 1 at the tip, x and z are in flame heights.
  vec3 flameAt(vec3 pl) {
    // Mirrored in the picture plane, before anything turns: the flame is
    // then symmetric on screen whatever the twist does inside each half.
    if (uMirror > 0.5) { pl.x = abs(pl.x); }

    float h = pl.y;
    float hh = clamp(h, 0.0, 1.0);
    float lift = hh * sqrt(hh);

    vec2 sway = vec2(
      sin(uSwayPhase.x + h * uSwayWave) + 0.5 * sin(uSwayPhase.y + h * uSwayWave * 2.3 + 1.7),
      cos(uSwayPhase.x + h * uSwayWave * 1.3 + 0.6) + 0.5 * cos(uSwayPhase.y + h * uSwayWave * 1.9 + 4.1)
    );
    vec2 c = pl.xz - (uLean + uSway * sway) * lift;
    float r = length(c);

    float taper = pow(1.0 - hh, uTaper);
    float w = uWidth * max(pow(hh + 1e-4, uBelly) * taper * uProfileNorm, uBase * taper);
    float d = (w - r) / uWidth;

    // Too far out for any turbulence to light: skip the noise.
    if (d < -uTurb * (1.0 + uTurbRise) - 0.02) { return vec3(0.0); }

    float a = uTwist * h + uSpin;
    float ca = cos(a);
    float sa = sin(a);
    vec2 cr = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y);

    float n = turbulence(vec3(cr.x * uFreq, h * uFreq * uStretch - uScroll, cr.y * uFreq));

    d += uTurb * (2.0 * n - 1.0) * (1.0 + uTurbRise * hh);
    // A rounded foot, and tongues that die above the tip.
    d -= 1.0 - smoothstep(0.0, 0.07, h);
    d -= max(h - 1.0, 0.0) * 3.0;

    float dens = smoothstep(0.0, uSoft, d);
    float temp = smoothstep(0.0, uCore, d) * (1.0 - uCool * hh);

    // The front: a thin bright skin where the gas meets the air. Seen edge
    // on it adds up along the ray, which is what draws a flame's filaments.
    float skin = d / uFrontWidth;
    float front = exp(-skin * skin) * smoothstep(0.02, 0.2, h) * (1.0 - smoothstep(0.85, 1.25, h));

    return vec3(dens, clamp(temp, 0.0, 1.0), front);
  }

  vec3 sparks(vec2 lp) {
    vec3 acc = vec3(0.0);

    for (int i = 0; i < ${ MAX_SPARKS }; i++) {
      if (float(i) >= uSparkCount) { break; }

      float fi = float(i);
      float h1 = hash11(fi * 1.31 + 0.7);
      float h2 = hash11(fi * 2.17 + 3.1);
      float h3 = hash11(fi * 3.73 + 5.3);
      float h4 = hash11(fi * 5.11 + 9.9);

      // Whole trips per loop, so every spark is back where it started.
      float u = fract(uPhase * uSparkSpeed * (1.0 + floor(h4 * 2.99)) + h1);
      float rise = pow(u, 0.75);
      float y = 0.12 + rise * uSparkRise * (0.6 + 0.4 * h3);
      float x = (h2 - 0.5) * uSparkSpread * (0.25 + rise)
        + uSparkDrift * rise * sin(TAU * (u * (1.0 + floor(h3 * 3.0)) + h4));

      vec2 delta = (lp - vec2(x, y)) / (uSparkSize * (0.5 + h1) * vec2(1.0, 2.2));
      float g = exp(-dot(delta, delta));

      if (g < 0.004) { continue; }

      float fade = smoothstep(0.0, 0.06, u) * pow(1.0 - u, 1.5);
      float twinkle = 0.65 + 0.35 * sin(TAU * (uPhase * (7.0 + floor(h2 * 9.0)) + h1));

      // A few bright ones among many faint.
      acc += heatColor(0.45 + 0.4 * (1.0 - u)) * g * fade * twinkle * (0.15 + 0.85 * h3 * h3);
    }

    return acc * uSparkBright;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec3 ro = vec3(0.0, 0.0, -uCamDist);
    vec3 rd = normalize(vec3(uv, uCamDist));

    // The pixel in the flame's space, on the plane through its axis.
    vec2 lp = (uv - vec2(0.0, uBaseY)) / uSize;

    vec3  light = vec3(0.0);
    float depth = 0.0;

    if (abs(lp.x) < uBound * 1.1 && lp.y > -0.1 && lp.y < uTop) {
      float reach = uBound * uSize;
      float t0 = (-reach - ro.z) / rd.z;
      float t1 = (reach - ro.z) / rd.z;
      float dt = (t1 - t0) / uSteps;
      // A static per-pixel offset turns the slices' banding into grain.
      float t = t0 + dt * hash12(gl_FragCoord.xy);

      for (int i = 0; i < ${ MAX_STEPS }; i++) {
        if (float(i) >= uSteps) { break; }

        vec3 pl = (ro + rd * t - vec3(0.0, uBaseY, 0.0)) / uSize;
        vec3 s = flameAt(pl);

        t += dt;

        if (s.x + s.z <= 0.0) { continue; }

        light += heatColor(s.y) * s.x * pow(s.y, uHeatPower);
        light += heatColor(0.35 + 0.45 * s.y) * uFront * s.z;
        // The blue of the combustion zone: the cool skin of the foot.
        light += uBlue * uBlueAmount * s.x * (1.0 - s.y) * (1.0 - smoothstep(0.0, 0.3, pl.y));
        depth += s.x;
      }

      float slice = 2.0 * uBound / uSteps;

      light *= slice * uIntensity;
      depth *= slice;
    }

    vec2 e = (lp - vec2(0.0, 0.38)) / (uGlowSize * vec2(1.0, 1.45));

    light += heatColor(0.5) * uGlow * exp(-dot(e, e));

    if (uSparkCount > 0.5) {
      light += sparks(lp);
    }

    // Exposed like film, on the brightest channel so the hue survives: an
    // orange stays orange as it brightens, and only what is close to
    // clipping burns towards white.
    float peak = max(light.r, max(light.g, light.b));
    float value = 1.0 - exp(-peak * uExposure);
    vec3 col = light / max(peak, 1e-5) * value;

    col = mix(col, vec3(value), uBurn * smoothstep(2.5, 7.0, peak * uExposure));

    // Premultiplied: the light adds to what lies beneath, and only the
    // opacity lets the flame's body hide it.
    gl_FragColor = vec4(col, uOpacity * (1.0 - exp(-depth * 8.0)));
  }
`;

const renderer = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();

  const look = resolveLook(
    {
      ...defaults.material,
      ...o.material,
      ramp: {
        ...defaults.material.ramp,
        ...o.material?.ramp
      }
    },
    o.background
  );

  drawBackground(
    p,
    look.background
  );

  const flame = {
    ...defaults.flame,
    ...o.flame
  };
  const turbulence = {
    ...defaults.turbulence,
    ...o.turbulence
  };
  const motion = {
    ...defaults.motion,
    ...o.motion
  };
  const heat = {
    ...defaults.heat,
    ...o.heat
  };
  const sparks = {
    ...defaults.sparks,
    ...o.sparks
  };
  const quality = {
    ...defaults.quality,
    ...o.quality
  };

  const phase = animation.progression;
  const angle = animation.angle;

  // Whole cycles of the loop, whatever the sliders hold.
  const swayCycles = Math.round( motion.swayCycles );
  const flicker = 1 + motion.flicker * (
    0.5 * Math.sin( angle * 5 )
    + 0.3 * Math.sin( angle * 11 + 1.3 )
    + 0.2 * Math.sin( angle * 17 + 2.9 )
  );

  // The silhouette h^belly × (1 - h)^taper, scaled so its widest point is 1.
  const belly = Math.max(
    flame.belly,
    0.01
  );
  const taper = Math.max(
    flame.taper,
    0.01
  );
  const widest = belly / ( belly + taper );
  const profileNorm = 1 / ( Math.pow(
    widest,
    belly
  ) * Math.pow(
    1 - widest,
    taper
  ) );

  const reach = turbulence.amount * ( 1 + turbulence.rise );
  const lean = [
    flame.lean,
    0
  ];
  // The noise all but never reaches its extremes: three quarters of the
  // theoretical reach bounds every tongue seen, and spends the slices where
  // the flame is.
  const bound = flame.width * ( 1 + 0.75 * reach ) + 1.5 * motion.sway + Math.abs( flame.lean );

  const material = materialRender(
    look.material,
    look.background
  );
  const stops = look.material.ramp?.stops?.length ?? 2;

  renderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: quality.renderScale,
    textures: {
      uRamp: {
        data: material.ramp.bytes,
        width: RAMP_WIDTH,
        height: 1,
        format: "rgba"
      }
    },
    uniforms: {
      uPhase: phase,
      uSize: flame.size * ( 1 + 0.04 * ( flicker - 1 ) ),
      uBaseY: flame.baseY,
      uCamDist: 3,
      uBound: bound,
      uTop: 1 + reach / 3 + 0.05,
      uWidth: flame.width,
      uBelly: belly,
      uTaper: taper,
      uProfileNorm: profileNorm,
      uBase: flame.base,
      uLean: lean,
      uSway: motion.sway,
      uSwayWave: motion.swayWave,
      uSwayPhase: [
        angle * swayCycles,
        angle * ( 2 * swayCycles + 1 )
      ],
      uFreq: turbulence.frequency,
      uStretch: turbulence.stretch,
      uDetail: Math.round( turbulence.detail ),
      uGain: turbulence.gain,
      uScroll: Math.round( turbulence.speed ) * PERIOD * phase,
      uShearPhase: Math.round( turbulence.shear ) * phase,
      uTurb: turbulence.amount,
      uTurbRise: turbulence.rise,
      uTwist: motion.twist,
      uSpin: Math.round( motion.spinTurns ) * angle,
      uMirror: motion.mirror ? 1 : 0,
      uSteps: Math.max(
        4,
        Math.min(
          MAX_STEPS,
          Math.round( quality.steps )
        )
      ),
      uSoft: Math.max(
        heat.softness,
        1e-3
      ),
      uCore: Math.max(
        heat.core,
        1e-3
      ),
      uCool: heat.cooling,
      uHeatPower: heat.contrast,
      uIntensity: heat.intensity * flicker,
      uExposure: heat.exposure,
      uOpacity: heat.opacity,
      uBlue: [
        heat.blueColor[ 0 ] / 255,
        heat.blueColor[ 1 ] / 255,
        heat.blueColor[ 2 ] / 255
      ],
      uBlueAmount: heat.blue,
      uFront: heat.front,
      uFrontWidth: Math.max(
        heat.frontWidth,
        1e-3
      ),
      uBurn: heat.burn,
      uGlow: heat.glow * flicker,
      uGlowSize: Math.max(
        heat.glowSize,
        1e-3
      ),
      uSparkCount: Math.min(
        MAX_SPARKS,
        Math.round( sparks.count )
      ),
      uSparkSize: Math.max(
        sparks.size,
        1e-4
      ),
      uSparkRise: sparks.rise,
      uSparkSpread: sparks.spread,
      uSparkDrift: sparks.drift,
      uSparkBright: sparks.brightness,
      uSparkSpeed: Math.round( sparks.speed ),
      uRampWidth: RAMP_WIDTH,
      uBands: material.uniforms.uBands,
      uShift: material.uniforms.uShift,
      uRampSpan: ( stops - 1 ) / stops
    }
  } );
} );
