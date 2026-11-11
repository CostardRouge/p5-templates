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
// materials-v4-sand
//
// A field of dunes under a low sun, and the wind that shapes it.
//
// A dune is the wind's own cross-section: a long, gentle slope the sand
// climbs, a knife-edged brink, and a short steep face it avalanches down, at
// the angle of repose. The terrain is that profile repeated downwind, its
// crest lines bent by slow noise and every ridge given its own height, with
// a second, smaller set of dunes riding the windward slopes. It is marched as
// a height field, and a second march towards the sun gives the shadow that
// makes a dune a dune: the lit slope and the dark face, cut by the crest.
//
// The dunes do not move — at a human scale they never do. What moves is what
// the wind is seen by: veils of sand streaming over the slopes, plumes
// spilling off the brinks into the shade, and the ripples creeping forward.
// The veils are value noise on a lattice that REPEATS along the wind and is
// scrolled a whole number of periods per loop, the ripples advance a whole
// number of wavelengths: the frame at phase 1 is the frame at phase 0.
//
// Colours are screen colours worked on as light, as in the sea.
// ─────────────────────────────────────────────────────────────────────────────

// Lattice cells the veils repeat after, along the wind.
const PERIOD = 16;
const MAX_STEPS = 160;
const MAX_SHADOW_STEPS = 64;

const FRAGMENT = `
  const float PERIOD = ${ PERIOD.toFixed( 1 ) };

  uniform float uPhase;

  // ── Dunes ──
  uniform float uLength;          // crest to crest, along the wind
  uniform float uHeight;
  uniform float uBrink;           // where the crest sits in the period (0.5 = symmetric)
  uniform float uSinuosity;
  uniform float uSinuosityScale;
  uniform float uIrregularity;
  uniform float uVariation;
  uniform float uSmallDunes;
  uniform float uRolling;         // the ground's own slow swell

  // ── Wind ──
  uniform float uVeils;
  uniform vec2  uVeilScale;       // lattice cells per unit (along, across the wind)
  uniform float uVeilSharpness;
  uniform float uVeilScroll;      // cells scrolled so far
  uniform float uVeilShear;       // extra periods ridden by the finer layer, so far
  uniform float uPlume;
  uniform float uPlumeLength;
  uniform float uRipples;
  uniform float uRippleLength;
  uniform float uRipplePhase;     // wavelengths advanced so far

  // ── Light ──
  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform float uSunPower;
  uniform float uSunSharpness;
  uniform float uShadowSoftness;
  uniform float uShadowSteps;
  uniform vec3  uZenith;
  uniform vec3  uHorizon;
  uniform float uSkyLight;

  // ── Sand ──
  uniform vec3  uSand;
  uniform vec3  uDust;
  uniform float uGrain;
  uniform float uHaze;
  uniform float uExposure;

  // ── Camera ──
  uniform vec2  uCamPlace;
  uniform float uCamHeight;
  uniform vec3  uRight;
  uniform vec3  uUp;
  uniform vec3  uForward;
  uniform float uFocal;
  uniform float uSteps;
  uniform float uFar;

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);

    p3 += dot(p3, p3.yzx + 33.33);

    return fract((p3.x + p3.y) * p3.z);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // Value noise whose lattice repeats every \`period\` cells along x.
  float windNoise(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, period);
    float x1 = mod(i.x + 1.0, period);

    return mix(
      mix(hash21(vec2(x0, i.y)), hash21(vec2(x1, i.y)), u.x),
      mix(hash21(vec2(x0, i.y + 1.0)), hash21(vec2(x1, i.y + 1.0)), u.x),
      u.y
    );
  }

  // One wind-shaped ridge, across its period t: a slow S up the windward
  // side that still climbs at the brink, then the slip face, steepest at the
  // top and easing into the hollow.
  float ridge(float t, float brink) {
    if (t < brink) {
      float x = t / brink * 0.9;

      return x * x * (3.0 - 2.0 * x) / 0.972;
    }

    return pow(1.0 - (t - brink) / (1.0 - brink), 1.35);
  }

  // How far the crest lines are pushed along the wind at a point.
  float crestShift(vec2 p) {
    return uSinuosity * sin(p.y * uSinuosityScale + 6.0 * valueNoise(p * 0.07 + 11.0))
      + uIrregularity * (valueNoise(p * 0.13 + 3.7) - 0.5) * 2.0;
  }

  // (height, place in the ridge's period, the ridge's own height factor).
  vec3 dune(vec2 p) {
    float u = (p.x + crestShift(p)) / uLength;
    float cell = floor(u);
    float t = u - cell;
    float own = mix(1.0 - uVariation, 1.0, valueNoise(vec2(cell * 3.17, p.y * 0.05 + cell * 0.71)));
    float h = uHeight * own * ridge(t, uBrink);

    // Smaller dunes ride the windward slope, at an angle, and die out
    // before the brink so the slip face stays clean.
    vec2 q = vec2(0.94 * p.x + 0.34 * p.y, -0.34 * p.x + 0.94 * p.y);
    float u2 = (q.x + 0.5 * crestShift(q * 1.7 + 40.0)) / (uLength * 0.29);
    float t2 = fract(u2);
    float room = smoothstep(0.0, 0.25, t) * (1.0 - smoothstep(uBrink - 0.22, uBrink - 0.02, t));

    h += uSmallDunes * uHeight * 0.2 * ridge(t2, 0.7) * room;
    h += uRolling * (valueNoise(p * 0.035 + 20.0) - 0.5);

    return vec3(h, t, own);
  }

  vec3 skyColor(vec3 rd) {
    float h = clamp(rd.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.4));
    float s = max(dot(rd, uSunDir), 0.0);

    col += uSunColor * (0.1 * pow(s, 8.0) + 0.4 * pow(s, 64.0));
    col += uSunColor * uSunPower * pow(s, uSunSharpness);

    return col;
  }

  vec3 develop(vec3 light) {
    vec3 x = light * uExposure;
    vec3 mapped = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);

    return pow(mapped, vec3(1.0 / 2.2));
  }

  // 1 in full sun, 0 in shade, soft where the ray only grazes the sand.
  float sunlight(vec3 pos) {
    float lit = 1.0;
    float t = 0.05;

    for (int i = 0; i < ${ MAX_SHADOW_STEPS }; i++) {
      if (float(i) >= uShadowSteps) { break; }

      vec3 q = pos + uSunDir * t;
      float d = q.y - dune(q.xz).x;

      if (d < 0.0) { return 0.0; }

      lit = min(lit, uShadowSoftness * d / t);
      t += clamp(d * 0.7, 0.04, 1.2);

      if (q.y > uHeight * 1.3 + uRolling) { break; }
    }

    return clamp(lit, 0.0, 1.0);
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec3 rd = normalize(uRight * uv.x + uUp * uv.y + uForward * uFocal);
    vec3 ro = vec3(uCamPlace.x, dune(uCamPlace).x + uCamHeight, uCamPlace.y);

    float top = uHeight * 1.05 + uSmallDunes * uHeight * 0.2 + uRolling * 0.5;
    float t = 0.0;
    bool hit = false;
    bool escaped = false;

    // Nothing to meet above the highest crest when looking up.
    if (rd.y >= 0.0 && ro.y > top) {
      escaped = true;
    } else {
      for (int i = 0; i < ${ MAX_STEPS }; i++) {
        if (float(i) >= uSteps) { break; }

        vec3 pos = ro + rd * t;
        float d = pos.y - dune(pos.xz).x;

        if (d < 0.0015 * t + 0.001) { hit = true; break; }

        // Under the steepest face a full step would tunnel through; and a
        // step never shrinks below what a pixel covers at that distance.
        t += max(d * 0.6, 0.003 * t);

        if (t > uFar || (rd.y > 0.0 && pos.y > top)) { escaped = true; break; }
      }
    }

    // A ray that ran out of steps was skimming a crest: it is on the sand,
    // not in the sky. Left as a miss, it drew pale streaks behind every
    // far brink.
    if (!hit && !escaped) { hit = true; }

    vec3 sky = skyColor(rd);

    if (!hit) {
      gl_FragColor = vec4(develop(sky), 1.0);

      return;
    }

    vec3 pos = ro + rd * t;
    vec3 info = dune(pos.xz);
    float e = 0.01 + 0.0015 * t;
    vec3 n = normalize(vec3(
      dune(pos.xz - vec2(e, 0.0)).x - dune(pos.xz + vec2(e, 0.0)).x,
      2.0 * e,
      dune(pos.xz - vec2(0.0, e)).x - dune(pos.xz + vec2(0.0, e)).x
    ));

    float lee = step(uBrink, info.y);
    float near = exp(-t * 0.06);

    // Ripples: fine waves across the wind, on the windward sand only, fading
    // with distance before they can alias. They bend with the crest lines
    // and creep forward.
    float wave = TAU * ((pos.x + 0.6 * crestShift(pos.xz) + 0.25 * valueNoise(pos.xz * 0.9)) / uRippleLength - uRipplePhase);
    float ripple = (cos(wave) + 0.35 * cos(2.0 * wave + 0.6)) * uRipples * near * (1.0 - lee);

    n = normalize(n + vec3(-ripple, 0.0, 0.0));

    float shade = sunlight(pos + n * 0.02);
    float diffuse = max(dot(n, uSunDir), 0.0) * shade;

    // The sky lights what the sun does not, and the lit sand next door
    // throws a little warmth back into the shade.
    // Mostly the blue overhead: that is what turns a dune's shade violet.
    vec3 skyLight = mix(uHorizon, uZenith, 0.8) * uSkyLight * (0.55 + 0.45 * n.y);
    vec3 bounce = uSand * uSunColor * 0.12 * (1.0 - n.y) * uSunPower * 0.05;

    float grain = 1.0 + uGrain * (hash21(floor(pos.xz * 90.0)) - 0.5) * near;
    vec3 albedo = uSand * grain;
    vec3 light = albedo * (uSunColor * diffuse * 2.2 + skyLight + bounce);

    // The wind, seen: veils of sand streaming over the windward slope,
    // thickening towards the brink where the air speeds up …
    vec2 lattice = vec2(pos.x * uVeilScale.x - uVeilScroll, pos.z * uVeilScale.y);
    float coarse = windNoise(lattice, PERIOD);
    vec2 fine = lattice * 2.0 + vec2(-uVeilShear * PERIOD * 2.0, 7.3);
    float detail = windNoise(fine, PERIOD * 2.0);
    float thread = pow(1.0 - abs(2.0 * coarse - 1.0), uVeilSharpness) * (0.35 + 0.65 * detail);

    float climb = ridge(info.y, uBrink);
    float windward = (1.0 - lee) * smoothstep(0.1, 0.95, climb);
    // … and spilling off it as a plume, which hangs in the air and so still
    // catches the sun over a face that is in shade.
    float past = (info.y - uBrink) / (1.0 - uBrink);
    float plume = lee * exp(-past / max(uPlumeLength, 1e-3)) * uPlume;

    // Far away a veil is thinner than a pixel: let it go before it turns
    // into pale patches.
    float veil = clamp(thread * (uVeils * windward + plume), 0.0, 1.0) * exp(-t * 0.06);
    float veilSun = mix(shade, 1.0, lee * 0.85);
    // Blown sand hangs in the air and takes the sun whole, where the slope
    // under it only takes it at a grazing angle: that is why it shows.
    vec3 dust = uDust * (uSunColor * veilSun * 1.25 + skyLight);

    light = mix(light, dust, veil);

    // Distance takes the dunes into the dusty air.
    vec3 air = skyColor(normalize(vec3(rd.x, 0.02, rd.z)));

    light = mix(air, light, exp(-t * uHaze));

    gl_FragColor = vec4(develop(light), 1.0);
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

  const dunes = {
    ...defaults.dunes,
    ...o.dunes
  };
  const wind = {
    ...defaults.wind,
    ...o.wind
  };
  const sun = {
    ...defaults.sun,
    ...o.sun
  };
  const sky = {
    ...defaults.sky,
    ...o.sky
  };
  const sand = {
    ...defaults.sand,
    ...o.sand
  };
  const camera = {
    ...defaults.camera,
    ...o.camera
  };
  const quality = {
    ...defaults.quality,
    ...o.quality
  };

  const phase = animation.progression;
  const angle = animation.angle;

  // The wind blows along +x. The camera's heading is measured from it.
  const swayCycles = Math.round( camera.swayCycles );
  const yaw = radians( camera.heading ) + radians( camera.sway ) * Math.sin( angle * swayCycles );
  const pitch = radians( camera.pitch ) + radians( camera.sway ) * 0.4 * Math.sin( angle * swayCycles + 1.1 );

  const cp = Math.cos( pitch );
  const sp = Math.sin( pitch );
  const forward = [
    Math.cos( yaw ) * cp,
    sp,
    Math.sin( yaw ) * cp
  ];
  const right = [
    Math.sin( yaw ),
    0,
    -Math.cos( yaw )
  ];
  const up = [
    -Math.cos( yaw ) * sp,
    cp,
    -Math.sin( yaw ) * sp
  ];

  const elevation = radians( sun.elevation );
  const azimuth = radians( sun.azimuth );
  const sunDir = [
    Math.cos( azimuth ) * Math.cos( elevation ),
    Math.sin( elevation ),
    Math.sin( azimuth ) * Math.cos( elevation )
  ];
  const sunSharpness = Math.log( 0.5 ) / Math.log( Math.cos( radians( Math.max(
    sun.size,
    0.2
  ) ) ) );

  renderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: quality.renderScale,
    uniforms: {
      uPhase: phase,
      uLength: Math.max(
        dunes.length,
        0.5
      ),
      uHeight: dunes.height,
      uBrink: dunes.brink,
      uSinuosity: dunes.sinuosity,
      uSinuosityScale: dunes.sinuosityScale,
      uIrregularity: dunes.irregularity,
      uVariation: dunes.variation,
      uSmallDunes: dunes.smallDunes,
      uRolling: dunes.rolling,
      uVeils: wind.veils,
      uVeilScale: [
        wind.veilLength > 0 ? 1 / wind.veilLength : 1,
        wind.veilWidth > 0 ? 1 / wind.veilWidth : 1
      ],
      uVeilSharpness: wind.veilSharpness,
      uVeilScroll: Math.round( wind.speed ) * PERIOD * phase,
      uVeilShear: Math.round( wind.gusts ) * phase,
      uPlume: wind.plume,
      uPlumeLength: wind.plumeLength,
      uRipples: wind.ripples,
      uRippleLength: Math.max(
        wind.rippleLength,
        0.01
      ),
      uRipplePhase: Math.round( wind.rippleSpeed ) * phase,
      uSunDir: sunDir,
      uSunColor: linear( sun.color ),
      uSunPower: sun.power,
      uSunSharpness: sunSharpness,
      uShadowSoftness: sun.shadowSoftness,
      uShadowSteps: Math.max(
        4,
        Math.min(
          MAX_SHADOW_STEPS,
          Math.round( quality.shadowSteps )
        )
      ),
      uZenith: linear( sky.zenith ),
      uHorizon: linear( sky.horizon ),
      uSkyLight: sky.light,
      uSand: linear( sand.color ),
      uDust: linear( sand.dust ),
      uGrain: sand.grain,
      uHaze: sand.haze,
      uExposure: sand.exposure,
      uCamPlace: [
        camera.along,
        camera.across
      ],
      uCamHeight: camera.height,
      uRight: right,
      uUp: up,
      uForward: forward,
      uFocal: 0.5 / Math.tan( radians( camera.fieldOfView ) / 2 ),
      uSteps: Math.max(
        16,
        Math.min(
          MAX_STEPS,
          Math.round( quality.steps )
        )
      ),
      uFar: camera.far
    }
  } );
} );
