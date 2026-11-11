import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// materials-v7-smoke
//
// A thread of smoke rising from an ember in the dark, lit from the side.
//
// Smoke is the flame's opposite: it gives no light, it only keeps or passes
// what falls on it. So where the flame added up its own glow along each ray,
// this march asks two questions at every step — how much smoke is here, and
// how much smoke stands between here and the lamp. The first hides what is
// behind it; the second is the shade smoke casts on itself, which is what
// gives a plume its volume: bright where it faces the light, grey inside,
// rimmed where the light comes through from behind.
//
// The plume itself is what a still room does to a rising thread: it leaves
// the ember as a thin ribbon, smooth and slowly twisting, then the air it
// drags along begins to roll and the ribbon breaks into billows, widening
// and thinning until it is gone. One number, the height at which it breaks,
// sets where the turbulence takes over.
//
// The loop is the flame's: noise on a lattice that repeats along the height,
// scrolled a whole number of periods, the large eddies on their own count,
// and a meander, a twist and a flicker that turn whole times.
// ─────────────────────────────────────────────────────────────────────────────

// Lattice cells the coarsest noise repeats after, along the height.
const PERIOD = 8;
const MAX_STEPS = 96;

const FRAGMENT = `
  const float PERIOD = ${ PERIOD.toFixed( 1 ) };

  // ── Frame: the plume's height and foot, in canvas heights (y up) ──
  uniform float uSize;
  uniform float uBaseY;
  uniform float uCamDist;
  uniform float uReachFoot;     // how far from its axis the plume reaches at the ember…
  uniform float uReachSlope;    // … and how much further per plume height
  uniform float uTop;
  uniform float uSteps;

  // ── The plume ──
  uniform float uWidth;
  uniform float uSpread;
  uniform float uRibbon;        // thickness / width of the thread at the ember
  uniform float uBreak;         // the height at which it turns turbulent
  uniform float uTwist;
  uniform float uSpin;
  uniform vec2  uLean;
  uniform float uMeander;
  uniform float uMeanderWaves;
  uniform float uMeanderPhase;
  uniform float uFadeStart;
  uniform float uDilution;

  // ── The air ──
  uniform float uEddy;
  uniform float uEddyScale;
  uniform float uEddyScroll;
  uniform float uGrain;
  uniform float uStretch;
  uniform float uDetail;
  uniform float uGain;
  uniform float uScroll;
  uniform float uShearPhase;
  uniform float uErosion;
  uniform float uSoftness;

  // ── The light ──
  uniform float uDensity;
  uniform vec3  uSmoke;
  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform float uKeyPower;
  uniform float uShadow;
  uniform float uThrough;       // how much brighter smoke is with the lamp behind it
  uniform vec3  uAmbient;
  uniform vec3  uBackTop;
  uniform vec3  uBackBottom;
  uniform float uBackGlow;
  uniform vec3  uEmber;
  uniform float uEmberPower;
  uniform float uEmberSize;
  uniform float uExposure;

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

  float billows(vec3 q, float octaves) {
    float sum = 0.0;
    float amp = 0.5;
    float norm = 0.0;
    float scale = 1.0;

    for (int i = 0; i < 6; i++) {
      if (float(i) >= octaves) { break; }

      vec3 s = q * scale + float(i) * vec3(17.3, 0.0, 9.1);

      s.y -= float(i) * uShearPhase * PERIOD * scale;
      sum += amp * latticeNoise(s, PERIOD * scale);
      norm += amp;
      amp *= uGain;
      scale *= 2.0;
    }

    return sum / max(norm, 1e-4);
  }

  // How much smoke at a point of the plume's own space: y is 0 at the ember
  // and 1 one plume-height up, x and z are in plume heights.
  float smokeAt(vec3 pl, float octaves) {
    float h = pl.y;

    if (h < 0.0 || h > uTop) { return 0.0; }

    // 0 while the thread is still smooth, 1 once it has broken up.
    float broken = smoothstep(0.0, uBreak, h);

    vec2 c = pl.xz - uLean * h - uMeander * h * vec2(
      sin(TAU * (h * uMeanderWaves - uMeanderPhase)),
      cos(TAU * (h * uMeanderWaves * 0.7 - uMeanderPhase) + 1.3)
    );

    // The large eddies carry the whole plume sideways, more with height.
    vec3 eq = vec3(pl.x, h * uStretch, pl.z) * uEddyScale;

    eq.y -= uEddyScroll;
    c += (vec2(latticeNoise(eq, PERIOD), latticeNoise(eq + vec3(31.0, 0.0, 17.0), PERIOD)) - 0.5)
      * uEddy * (0.12 + 0.88 * broken) * h;

    // A thread leaves the ember as a ribbon and turns as it climbs.
    float a = uTwist * h + uSpin;
    float ca = cos(a);
    float sa = sin(a);
    vec2 cr = vec2(ca * c.x - sa * c.y, sa * c.x + ca * c.y);

    cr.y /= mix(uRibbon, 1.0, broken);

    float radius = uWidth * mix(0.3, 1.0, broken) + uSpread * h;
    float body = 1.0 - length(cr) / max(radius, 1e-4);

    if (body <= -uErosion) { return 0.0; }

    // The billows eat the plume from its edge, once it has broken.
    vec3 q = vec3(c.x, h * uStretch, c.y) * uGrain;

    q.y -= uScroll;

    // Summed value noise huddles around its mean: stretched, or it only
    // shrinks the plume evenly instead of carving it.
    float n = smoothstep(0.22, 0.78, billows(q, octaves));
    // … from its edge: the core holds, or the plume is torn into pieces.
    float d = body - uErosion * broken * (1.0 - n) * 1.3 * (1.0 - 0.7 * clamp(body, 0.0, 1.0));
    float smoke = smoothstep(0.0, uSoftness, d);

    // … and thin it unevenly inside, which is what shows as wisps when the
    // light comes through.
    smoke *= mix(1.0, 0.25 + 0.75 * n, min(uErosion, 1.0) * broken);

    // Thinner as it spreads, gone before the top; and it starts at a point.
    smoke *= smoothstep(0.0, 0.025, h) * (1.0 - smoothstep(uFadeStart, uTop, h));
    smoke /= 1.0 + uDilution * h * h;

    return smoke;
  }

  vec3 develop(vec3 light) {
    vec3 x = light * uExposure;
    vec3 mapped = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);

    return pow(mapped, vec3(1.0 / 2.2));
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec3 ro = vec3(0.0, 0.0, -uCamDist);
    vec3 rd = normalize(vec3(uv, uCamDist));
    vec2 lp = (uv - vec2(0.0, uBaseY)) / uSize;

    vec3 back = mix(uBackBottom, uBackTop, smoothstep(-0.5, 0.5, uv.y));

    back += uKeyColor * uBackGlow * exp(-dot(uv - vec2(0.0, 0.1), uv - vec2(0.0, 0.1)) * 3.0);

    vec3 light = vec3(0.0);
    float clear = 1.0;

    // The plume is a thread at the ember and a cloud at the top: the slices
    // are spent on the depth it can occupy AT THIS HEIGHT, or the thread
    // falls between them and comes out as stipple.
    float bound = uReachFoot + uReachSlope * clamp(lp.y + 0.06, 0.0, uTop);

    if (abs(lp.x) < bound * 1.05 && lp.y > -0.02 && lp.y < uTop) {
      float reach = bound * uSize;
      float t0 = (-reach - ro.z) / rd.z;
      float t1 = (reach - ro.z) / rd.z;
      float dt = (t1 - t0) / uSteps;
      float slice = 2.0 * bound / uSteps;
      float t = t0 + dt * hash12(gl_FragCoord.xy);

      // Brighter with the lamp behind the smoke: light comes through it
      // more easily than it comes back.
      float through = 1.0 + uThrough * pow(max(dot(rd, uKeyDir), 0.0), 3.0);

      for (int i = 0; i < ${ MAX_STEPS }; i++) {
        if (float(i) >= uSteps || clear < 0.02) { break; }

        vec3 pl = (ro + rd * t - vec3(0.0, uBaseY, 0.0)) / uSize;

        t += dt;

        float smoke = smokeAt(pl, uDetail);

        if (smoke <= 0.001) { continue; }

        // The smoke between here and the lamp: three coarse looks.
        float between = 0.0;

        for (int k = 1; k <= 3; k++) {
          between += smokeAt(pl + uKeyDir * 0.035 * float(k), 2.0);
        }

        float lit = exp(-uShadow * between * 0.035 * uDensity);
        float held = 1.0 - exp(-uDensity * smoke * slice);

        light += clear * held * uSmoke * (uKeyColor * uKeyPower * lit * through + uAmbient);
        clear *= 1.0 - held;
      }
    }

    // The ember it rises from.
    vec2 e = lp / max(uEmberSize, 1e-4);

    light += uEmber * uEmberPower * exp(-dot(e, e));

    gl_FragColor = vec4(develop(back * clear + light), 1.0);
  }
`;

const renderer = createNoiseFieldRenderer( FRAGMENT );

const radians = ( degrees ) => degrees * Math.PI / 180;

// A screen colour as light.
const linear = ( color ) => [
  0,
  1,
  2
].map( ( channel ) => Math.pow(
  ( color?.[ channel ] ?? 0 ) / 255,
  2.2
) );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();

  const plume = {
    ...defaults.plume,
    ...o.plume
  };
  const air = {
    ...defaults.air,
    ...o.air
  };
  const light = {
    ...defaults.light,
    ...o.light
  };
  const backdrop = {
    ...defaults.backdrop,
    ...o.backdrop
  };
  const quality = {
    ...defaults.quality,
    ...o.quality
  };

  const phase = animation.progression;
  const angle = animation.angle;

  const top = plume.top;
  // How far from its axis the plume can reach: its own width at the ember,
  // then everything that widens it or pushes it sideways, per height.
  const reachFoot = plume.width * 0.3 + 0.012;
  const reachSlope = plume.spread
    + 0.5 * air.eddies
    + plume.meander
    + Math.abs( plume.lean )
    + plume.width * 0.7 / Math.max(
      plume.breakHeight,
      0.01
    ) * 0.5;

  const keyAzimuth = radians( light.keyDirection );
  const keyElevation = radians( light.keyHeight );
  const flicker = 1 + light.emberFlicker * (
    0.6 * Math.sin( angle * 7 )
    + 0.4 * Math.sin( angle * 13 + 1.9 )
  );

  renderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: quality.renderScale,
    uniforms: {
      uSize: plume.size,
      uBaseY: plume.baseY,
      uCamDist: 3,
      uReachFoot: reachFoot,
      uReachSlope: reachSlope,
      uTop: top,
      uSteps: Math.max(
        8,
        Math.min(
          MAX_STEPS,
          Math.round( quality.steps )
        )
      ),
      uWidth: plume.width,
      uSpread: plume.spread,
      uRibbon: Math.max(
        plume.ribbon,
        0.02
      ),
      uBreak: Math.max(
        plume.breakHeight,
        0.01
      ),
      uTwist: plume.twist,
      uSpin: Math.round( plume.spinTurns ) * angle,
      uLean: [
        plume.lean,
        0
      ],
      uMeander: plume.meander,
      uMeanderWaves: plume.meanderWaves,
      uMeanderPhase: Math.round( plume.meanderSpeed ) * phase,
      uFadeStart: Math.min(
        plume.fadeStart,
        top - 0.01
      ),
      uDilution: plume.dilution,
      uEddy: air.eddies,
      uEddyScale: air.eddyScale,
      uEddyScroll: Math.round( air.eddySpeed ) * PERIOD * phase,
      uGrain: air.grain,
      uStretch: air.stretch,
      uDetail: Math.round( air.detail ),
      uGain: air.roughness,
      uScroll: Math.round( air.speed ) * PERIOD * phase,
      uShearPhase: Math.round( air.shear ) * phase,
      uErosion: air.erosion,
      uSoftness: Math.max(
        air.softness,
        1e-3
      ),
      uDensity: light.density,
      uSmoke: linear( light.smokeColor ),
      uKeyDir: [
        Math.sin( keyAzimuth ) * Math.cos( keyElevation ),
        Math.sin( keyElevation ),
        Math.cos( keyAzimuth ) * Math.cos( keyElevation )
      ],
      uKeyColor: linear( light.keyColor ),
      uKeyPower: light.keyPower,
      uShadow: light.shadow,
      uThrough: light.through,
      uAmbient: linear( light.ambient ),
      uBackTop: linear( backdrop.top ),
      uBackBottom: linear( backdrop.bottom ),
      uBackGlow: backdrop.glow,
      uEmber: linear( light.emberColor ),
      uEmberPower: light.ember * flicker,
      uEmberSize: light.emberSize,
      uExposure: light.exposure
    }
  } );
} );
