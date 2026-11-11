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
// materials-v2-water
//
// Open water under a low sun. The surface is a sum of travelling waves, each
// shaped exp( sin x − 1 ) — a sharp crest over a long flat trough — and each
// dragging the next ones' sample point along its own slope, which is what
// bunches the small waves on the crests and makes the sea choppy instead of
// a tidy sum of sines (the construction of afl_ext's "Very fast procedural
// ocean", rewritten here for the loop clock). A ray is marched down to that
// height field between two planes, and the hit is shaded as water is: the sky
// mirrored by Fresnel — almost nothing straight down, almost everything at a
// grazing angle — over the body's own colour, brighter in the crests where
// the light comes through, plus the sun's own reflection, which the
// roughness of the waves breaks into a path of glitter.
//
// The loop is exact because every wave completes a WHOLE number of cycles of
// it: wave i turns round( speed × growth^i ) times, so the sea at phase 1 is
// the sea at phase 0, whatever its thirty-odd components do in between.
//
// Colours are picked as screen colours and worked on as light: linearised on
// the way in, exposed through a filmic curve and re-encoded on the way out.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WAVES = 48;
const MAX_STEPS = 96;

const FRAGMENT = `
  uniform float uPhase;

  // ── Waves ──
  uniform float uWaveScale;
  uniform float uWaveHeight;      // the water body's depth, in world units
  uniform float uWaveDrag;
  uniform float uWaveDetail;      // components for the normal
  uniform float uWaveMarch;       // components for the march
  uniform float uWaveSpeed;       // cycles per loop of the longest wave
  uniform float uWaveSpeedGrowth;
  uniform float uWaveFreqGrowth;
  uniform float uWaveWind;        // radians
  uniform float uWaveSpread;      // radians either side of the wind
  uniform float uSteps;

  // ── Camera ──
  uniform vec3  uEye;
  uniform vec3  uRight;
  uniform vec3  uUp;
  uniform vec3  uForward;
  uniform float uFocal;

  // ── Light ──
  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform float uSunPower;
  uniform float uSunSharpness;
  uniform float uSunGlow;
  uniform vec3  uZenith;
  uniform vec3  uHorizon;
  uniform float uSkyCurve;

  // ── Water ──
  uniform vec3  uWaterColor;
  uniform float uScatter;
  uniform float uReflectance;
  uniform float uHaze;
  uniform float uSmoothing;
  uniform float uExposure;

  // (height 0..1, slope along the direction) of one wave: a sharp crest over
  // a long trough.
  vec2 crest(vec2 position, vec2 direction, float frequency, float shift) {
    float x = dot(direction, position) * frequency + shift;
    float wave = exp(sin(x) - 1.0);

    return vec2(wave, -wave * cos(x));
  }

  // The sea's height, 0..1, at a point of the plane.
  float seaHeight(vec2 position, float count) {
    // Keeps the small waves from all being in phase at the origin.
    float offset = length(position) * 0.1;
    float frequency = 1.0;
    float cycles = uWaveSpeed;
    float weight = 1.0;
    float sum = 0.0;
    float total = 0.0;
    float turn = 0.0;

    for (int i = 0; i < ${ MAX_WAVES }; i++) {
      if (float(i) >= count) { break; }

      float angle = uWaveWind + uWaveSpread * sin(turn);
      vec2 direction = vec2(sin(angle), cos(angle));
      // A whole number of cycles per loop, whatever the growth makes of it.
      vec2 wave = crest(position, direction, frequency, TAU * floor(cycles + 0.5) * uPhase + offset);

      // Each wave drags what follows along its own slope: the chop.
      position += direction * wave.y * weight * uWaveDrag;
      sum += wave.x * weight;
      total += weight;

      weight *= 0.8;
      frequency *= uWaveFreqGrowth;
      cycles *= uWaveSpeedGrowth;
      turn += 1232.399963;
    }

    return sum / max(total, 1e-4);
  }

  float surfaceAt(vec2 xz, float count) {
    return (seaHeight(xz * uWaveScale, count) - 1.0) * uWaveHeight;
  }

  vec3 skyColor(vec3 rd) {
    float h = clamp(rd.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, uSkyCurve));
    float s = max(dot(rd, uSunDir), 0.0);

    // The sun's halo: a wide warm wash and a tight bloom around the disc.
    col += uSunColor * uSunGlow * (0.35 * pow(s, 6.0) + pow(s, 48.0));

    return col;
  }

  vec3 sunDisc(vec3 rd) {
    return uSunColor * uSunPower * pow(max(dot(rd, uSunDir), 0.0), uSunSharpness);
  }

  // Filmic exposure (the ACES fit), then the screen's encoding.
  vec3 develop(vec3 light) {
    vec3 x = light * uExposure;
    vec3 mapped = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);

    return pow(mapped, vec3(1.0 / 2.2));
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
    vec3 rd = normalize(uRight * uv.x + uUp * uv.y + uForward * uFocal);

    if (rd.y >= 0.0) {
      gl_FragColor = vec4(develop(skyColor(rd) + sunDisc(rd)), 1.0);

      return;
    }

    // The sea lives between y = 0 (the highest crest) and y = -height.
    vec3 top = uEye + rd * (-uEye.y / rd.y);
    vec3 pos = top;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
      if (float(i) >= uSteps) { break; }

      float h = surfaceAt(pos.xz, uWaveMarch);

      if (h + 0.01 * uWaveHeight > pos.y) { break; }

      pos += rd * (pos.y - h);
    }

    float dist = distance(pos, uEye);

    // The normal, from the full set of waves; far away it is eased back to
    // flat, where a pixel covers many waves and their slopes only alias.
    float e = 0.01;
    float h0 = surfaceAt(pos.xz, uWaveDetail);
    vec3 a = vec3(pos.x, h0, pos.z);
    vec3 n = normalize(cross(
      a - vec3(pos.x - e, surfaceAt(pos.xz - vec2(e, 0.0), uWaveDetail), pos.z),
      a - vec3(pos.x, surfaceAt(pos.xz + vec2(0.0, e), uWaveDetail), pos.z + e)
    ));

    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), uSmoothing * min(1.0, sqrt(dist * 0.01) * 1.1)));

    float facing = max(dot(n, -rd), 0.0);
    float fresnel = uReflectance + (1.0 - uReflectance) * pow(1.0 - facing, 5.0);

    vec3 mirrored = reflect(rd, n);

    mirrored.y = abs(mirrored.y);

    vec3 reflection = skyColor(mirrored) + sunDisc(mirrored);
    // The body's colour, brighter in the crests where the light comes through.
    vec3 body = uWaterColor * uScatter * (0.2 + (pos.y + uWaveHeight) / uWaveHeight);
    vec3 light = fresnel * reflection + body;

    // Towards the horizon the sea dissolves into the air above it.
    vec3 air = skyColor(normalize(vec3(rd.x, 0.0, rd.z)));

    light = mix(air, light, exp(-dist * uHaze));

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

  const waves = {
    ...defaults.waves,
    ...o.waves
  };
  const camera = {
    ...defaults.camera,
    ...o.camera
  };
  const sun = {
    ...defaults.sun,
    ...o.sun
  };
  const sky = {
    ...defaults.sky,
    ...o.sky
  };
  const water = {
    ...defaults.water,
    ...o.water
  };
  const quality = {
    ...defaults.quality,
    ...o.quality
  };

  const phase = animation.progression;
  const angle = animation.angle;

  // The camera rides the swell: whole cycles of the loop, like the waves.
  const swayCycles = Math.round( camera.swayCycles );
  const pitch = radians( camera.pitch ) + radians( camera.sway ) * 0.5 * Math.sin( angle * swayCycles + 0.8 );
  const yaw = radians( camera.sway ) * Math.sin( angle * swayCycles );
  const roll = radians( camera.roll ) * Math.sin( angle * swayCycles + 2.1 );
  const eyeHeight = camera.height + camera.bob * Math.sin( angle * swayCycles + 1.4 );

  const cp = Math.cos( pitch );
  const sp = Math.sin( pitch );
  const cy = Math.cos( yaw );
  const sy = Math.sin( yaw );
  const cr = Math.cos( roll );
  const sr = Math.sin( roll );

  const forward = [
    sy * cp,
    sp,
    cy * cp
  ];
  const levelRight = [
    cy,
    0,
    -sy
  ];
  const levelUp = [
    -sy * sp,
    cp,
    -cy * sp
  ];
  const right = levelRight.map( (
    v, i
  ) => v * cr + levelUp[ i ] * sr );
  const up = levelUp.map( (
    v, i
  ) => levelUp[ i ] * cr - levelRight[ i ] * sr );

  const elevation = radians( sun.elevation );
  const azimuth = radians( sun.azimuth );
  const sunDir = [
    Math.sin( azimuth ) * Math.cos( elevation ),
    Math.sin( elevation ),
    Math.cos( azimuth ) * Math.cos( elevation )
  ];

  // The disc's exponent, from the angle at which its light has halved.
  const sunSharpness = Math.log( 0.5 ) / Math.log( Math.cos( radians( Math.max(
    sun.size,
    0.2
  ) ) ) );

  const detail = Math.max(
    1,
    Math.min(
      MAX_WAVES,
      Math.round( waves.detail )
    )
  );

  renderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: quality.renderScale,
    uniforms: {
      uPhase: phase,
      uWaveScale: waves.scale,
      uWaveHeight: Math.max(
        waves.height,
        1e-3
      ),
      uWaveDrag: waves.choppiness,
      uWaveDetail: detail,
      // The march only needs the waves that move the silhouette.
      uWaveMarch: Math.min(
        detail,
        12
      ),
      uWaveSpeed: Math.max(
        1,
        Math.round( waves.speed )
      ),
      uWaveSpeedGrowth: waves.speedGrowth,
      uWaveFreqGrowth: waves.frequencyGrowth,
      uWaveWind: radians( waves.wind ),
      uWaveSpread: radians( waves.spread ),
      uSteps: Math.max(
        8,
        Math.min(
          MAX_STEPS,
          Math.round( quality.steps )
        )
      ),
      uEye: [
        0,
        Math.max(
          eyeHeight,
          0.05
        ),
        0
      ],
      uRight: right,
      uUp: up,
      uForward: forward,
      uFocal: 0.5 / Math.tan( radians( camera.fieldOfView ) / 2 ),
      uSunDir: sunDir,
      uSunColor: linear( sun.color ),
      uSunPower: sun.power,
      uSunSharpness: sunSharpness,
      uSunGlow: sun.glow,
      uZenith: linear( sky.zenith ),
      uHorizon: linear( sky.horizon ),
      uSkyCurve: Math.max(
        sky.curve,
        0.05
      ),
      uWaterColor: linear( water.color ),
      uScatter: water.scatter,
      uReflectance: water.reflectance,
      uHaze: water.haze,
      uSmoothing: water.smoothing,
      uExposure: water.exposure
    }
  } );
} );
