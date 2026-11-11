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
// materials-v6-lava
//
// A lake of lava at night, seen from just above its crust.
//
// Lava that meets the air grows a skin, the skin breaks into plates, and the
// plates ride the melt underneath, which shows through the cracks between
// them. That is a Voronoi diagram: each plate a cell, each crack the border
// between two, measured exactly (the distance to the nearest border, not to
// the nearest site) so a crack keeps one width along its whole length.
//
// A conveyor of rigid plates would not be lava. Three things move, each on
// its own clock: the plates drift with the flow and their sites wander, so
// the cells change shape; a slow field of HEAT drifts under them at another
// speed, and where it passes the cracks widen, a finer network opens inside
// the plates and the crust itself begins to glow; and every plate breathes a
// little on its own.
//
// Each of those clocks counts whole cycles of the loop: the two lattices
// repeat along the flow and scroll whole periods, the sites and the plates
// turn whole times. The lake at phase 1 is the lake at phase 0.
//
// Colours are screen colours worked on as light; the melt is brighter than
// white, and the exposure is what brings its core back to it.
// ─────────────────────────────────────────────────────────────────────────────

// Lattice cells the plates, and the heat, repeat after along the flow.
const PERIOD = 12;
const MAX_SPARKS = 64;

const FRAGMENT = `
  const float PERIOD = ${ PERIOD.toFixed( 1 ) };

  uniform float uPhase;

  // ── Plates ──
  uniform float uPlateScale;      // plates per world unit
  uniform float uFlow;            // cells drifted so far
  uniform float uWander;
  uniform float uCrack;
  uniform float uCrackSoft;
  uniform float uBreath;
  uniform float uFine;
  uniform float uBevel;
  uniform float uWarp;

  // ── Heat ──
  uniform float uHeatScale;
  uniform float uHeatFlow;
  uniform float uHeatContrast;
  uniform float uPlateGlow;
  uniform float uHalo;

  // ── Melt ──
  uniform vec3  uCool;
  uniform vec3  uHot;
  uniform vec3  uCore;
  uniform float uGlow;
  uniform float uGlowContrast;

  // ── Crust ──
  uniform vec3  uRock;
  uniform float uRoughness;
  uniform vec3  uRimDir;
  uniform vec3  uRimColor;
  uniform float uRim;

  // ── Air ──
  uniform vec3  uHaze;
  uniform float uHazeDensity;
  uniform vec3  uSky;
  uniform float uShimmer;
  uniform float uShimmerRise;
  uniform float uSparkCount;
  uniform float uSparkSize;
  uniform float uSparkBright;
  uniform float uSparkSpeed;

  // ── Camera ──
  uniform float uEyeHeight;
  uniform vec3  uRight;
  uniform vec3  uUp;
  uniform vec3  uForward;
  uniform float uFocal;
  uniform float uExposure;

  float hash11(float x) {
    return fract(sin(x * 127.1) * 43758.5453);
  }

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);

    p3 += dot(p3, p3.yzx + 33.33);

    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));

    p3 += dot(p3, p3.yzx + 33.33);

    return fract((p3.xx + p3.yz) * p3.zy);
  }

  // Value noise whose lattice repeats every \`period\` cells along y.
  float flowNoise(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    float y0 = mod(i.y, period);
    float y1 = mod(i.y + 1.0, period);

    return mix(
      mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), u.x),
      mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), u.x),
      u.y
    );
  }

  // Where a cell's site sits: a place of its own, around which it turns a
  // small circle a whole number of times per loop, each at its own phase —
  // so the plates are irregular, and change shape. (With the circle alone,
  // every site passes through its cell's centre and the crust is a grid.)
  vec2 site(vec2 cell, float period) {
    vec2 wrapped = vec2(cell.x, mod(cell.y, period));
    vec2 h = hash22(wrapped);
    vec2 home = hash22(wrapped + 41.3) * 2.0 - 1.0;
    float turns = 1.0 + floor(h.x * 1.99);

    return 0.5 + 0.5 * (0.7 * home + 0.3 * uWander * sin(TAU * (turns * uPhase + h)));
  }

  // (distance to the nearest border, the cell's own random number), and the
  // direction that border lies in.
  vec2 plates(vec2 q, float period, out vec2 toBorder) {
    vec2 n = floor(q);
    vec2 f = q - n;
    vec2 nearestCell = vec2(0.0);
    vec2 nearest = vec2(0.0);
    float best = 8.0;

    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + site(n + g, period) - f;
        float d = dot(r, r);

        if (d < best) { best = d; nearest = r; nearestCell = g; }
      }
    }

    best = 8.0;
    toBorder = vec2(1.0, 0.0);

    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 g = nearestCell + vec2(float(i), float(j));
        vec2 r = g + site(n + g, period) - f;
        vec2 across = r - nearest;

        if (dot(across, across) > 1e-5) {
          vec2 dir = normalize(across);
          float d = dot(0.5 * (nearest + r), dir);

          if (d < best) { best = d; toBorder = dir; }
        }
      }
    }

    vec2 home = n + nearestCell;

    return vec2(best, hash21(vec2(home.x, mod(home.y, period)) + 3.7));
  }

  // The melt's own light, by temperature 0..1: from a dull red through
  // orange to a core brighter than white.
  vec3 melt(float temp) {
    vec3 col = uCool * smoothstep(0.0, 0.45, temp);

    col = mix(col, uHot, smoothstep(0.3, 0.8, temp));
    col = mix(col, uCore, smoothstep(0.72, 1.0, temp));

    return col * uGlow * pow(max(temp, 0.0), uGlowContrast);
  }

  vec3 develop(vec3 light) {
    vec3 x = light * uExposure;
    vec3 mapped = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);

    return pow(mapped, vec3(1.0 / 2.2));
  }

  vec3 sparks(vec2 uv) {
    vec3 acc = vec3(0.0);

    for (int i = 0; i < ${ MAX_SPARKS }; i++) {
      if (float(i) >= uSparkCount) { break; }

      float fi = float(i);
      float h1 = hash11(fi * 1.31 + 0.7);
      float h2 = hash11(fi * 2.17 + 3.1);
      float h3 = hash11(fi * 3.73 + 5.3);
      float h4 = hash11(fi * 5.11 + 9.9);

      // Whole trips per loop.
      float u = fract(uPhase * uSparkSpeed * (1.0 + floor(h4 * 1.99)) + h1);
      float y = -0.45 + u * (0.7 + 0.5 * h3);
      float x = (h2 - 0.5) * 1.1 + 0.07 * u * sin(TAU * (u * (1.0 + floor(h3 * 3.0)) + h4));

      vec2 delta = (uv - vec2(x, y)) / (uSparkSize * (0.4 + h1) * vec2(1.0, 1.8));
      float g = exp(-dot(delta, delta));

      if (g < 0.004) { continue; }

      float fade = smoothstep(0.0, 0.08, u) * pow(1.0 - u, 1.6);

      acc += melt(0.55 + 0.4 * (1.0 - u)) * g * fade * (0.15 + 0.85 * h3 * h3);
    }

    return acc * uSparkBright;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);

    // Hot air bends the view, more the further it looks across the lake.
    float waver = flowNoise(vec2(uv.x * 14.0, uv.y * 9.0 - uShimmerRise), PERIOD) - 0.5;
    vec2 seen = uv + vec2(waver, 0.35 * waver) * uShimmer * smoothstep(-0.5, 0.35, uv.y);

    vec3 rd = normalize(uRight * seen.x + uUp * seen.y + uForward * uFocal);
    vec3 light;

    if (rd.y >= -1e-4) {
      // Above the lake: smoke lit from below.
      light = mix(uHaze, uSky, smoothstep(0.0, 0.45, rd.y));
    } else {
      float dist = -uEyeHeight / rd.y;
      vec2 p = vec2(rd.x, rd.z) * dist;
      // A pixel covers more and more of the crust with distance.
      float blur = 0.0012 * dist * uPlateScale / max(-rd.y, 0.05);

      // The heat drifting under the crust, at its own speed.
      vec2 hq = vec2(p.x, p.y) * uHeatScale + vec2(0.0, uHeatFlow);
      float heat = 0.65 * flowNoise(hq, PERIOD) + 0.35 * flowNoise(hq * 2.0 + vec2(5.3, 0.0), PERIOD * 2.0);

      heat = pow(clamp(heat, 0.0, 1.0), uHeatContrast);

      // The plates.
      vec2 q = p * uPlateScale + vec2(0.0, uFlow);

      // Bent before it is cut: straight-edged polygons are a diagram, not
      // a crust. The bend rides the same lattice, so it loops with it.
      q += uWarp * (vec2(
        flowNoise(q * 0.5 + vec2(11.0, 0.0), PERIOD * 0.5),
        flowNoise(q * 0.5 + vec2(37.0, 0.0), PERIOD * 0.5)
      ) - 0.5);

      vec2 edgeDir;
      vec2 plate = plates(q, PERIOD, edgeDir);
      float breath = 1.0 + uBreath * sin(TAU * ((1.0 + floor(plate.y * 1.99)) * uPhase + plate.y * 7.0));
      float width = uCrack * (0.25 + 1.75 * heat) * breath;
      float crust = smoothstep(width, width + uCrackSoft + blur, plate.x);

      // A finer network opens inside the plates where the heat is.
      vec2 fineDir;
      vec2 finePlate = plates(q * 3.0 + vec2(17.0, 0.0), PERIOD * 3.0, fineDir);
      // It fades in with the heat rather than starting at a threshold: cut
      // off at one, the network ended on a hard line that read as a seam.
      float fineHeat = smoothstep(0.25, 0.6, heat);
      float fineWidth = uFine * (0.25 + 0.75 * fineHeat);
      float fine = (1.0 - smoothstep(fineWidth, fineWidth + uCrackSoft * 3.0 + blur * 3.0, finePlate.x)) * fineHeat;

      // Temperature: the melt in the cracks, never quite even; on the
      // plates, what leaks through the fine cracks, the glow of crust that
      // is thinning, and the warmth spilling over a crack's lips.
      // A crack is as hot as what lies under it: a dull red line over cold
      // ground, a white river over the heat.
      float skin = mix(0.3, 1.0, heat) * (0.75 + 0.25 * flowNoise(q * 4.0 + vec2(3.1, 0.0), PERIOD * 4.0));
      float lip = exp(-max(plate.x - width, 0.0) / max(uHalo, 1e-3));
      float onPlate = max(fine * (0.25 + 0.45 * heat), uPlateGlow * heat * heat) + 0.2 * lip * heat;
      float temp = mix(skin, onPlate, crust);

      // Far away the detail is smaller than a pixel: go to its mean.
      float far = smoothstep(18.0, 60.0, dist * uPlateScale);

      temp = mix(temp, 0.12 + 0.3 * heat, far);

      // The crust itself: rough dark rock, its edges curled down towards
      // the crack, lit from below by the melt and from behind by the night.
      float e = 0.03;
      float r0 = flowNoise(q * 9.0, PERIOD * 9.0);
      vec2 bump = vec2(
        flowNoise(q * 9.0 + vec2(e, 0.0), PERIOD * 9.0) - r0,
        flowNoise(q * 9.0 + vec2(0.0, e), PERIOD * 9.0) - r0
      ) / e * uRoughness * 0.02;
      vec2 curl = edgeDir * uBevel * lip;
      vec3 n = normalize(vec3(curl.x - bump.x, 1.0, curl.y - bump.y));

      // Ropy rock: a coarse grain under the fine one.
      float coarse = flowNoise(q * 2.5 + vec2(9.0, 0.0), PERIOD * 2.5);
      vec3 rock = uRock * (0.45 + 0.7 * r0) * (0.6 + 0.8 * coarse);
      vec3 underglow = melt(0.7) * 0.3 * lip * heat;
      vec3 rim = uRimColor * uRim * (0.25 + pow(max(dot(n, uRimDir), 0.0), 1.5) * 3.0);

      light = rock * (underglow + rim) * crust * (1.0 - 0.7 * far) + melt(temp);

      // The air over a lava lake is its own colour.
      light = mix(uHaze, light, exp(-dist * uHazeDensity));
    }

    if (uSparkCount > 0.5) {
      light += sparks(uv);
    }

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

  const plates = {
    ...defaults.plates,
    ...o.plates
  };
  const heat = {
    ...defaults.heat,
    ...o.heat
  };
  const melt = {
    ...defaults.melt,
    ...o.melt
  };
  const crust = {
    ...defaults.crust,
    ...o.crust
  };
  const air = {
    ...defaults.air,
    ...o.air
  };
  const camera = {
    ...defaults.camera,
    ...o.camera
  };

  const phase = animation.progression;
  const angle = animation.angle;

  const swayCycles = Math.round( camera.swayCycles );
  const yaw = radians( camera.sway ) * Math.sin( angle * swayCycles );
  const pitch = radians( camera.pitch ) + radians( camera.sway ) * 0.4 * Math.sin( angle * swayCycles + 1.2 );

  // The camera looks along -z; the lava flows towards it.
  const cp = Math.cos( pitch );
  const sp = Math.sin( pitch );
  const forward = [
    Math.sin( yaw ) * cp,
    sp,
    -Math.cos( yaw ) * cp
  ];
  const right = [
    Math.cos( yaw ),
    0,
    Math.sin( yaw )
  ];
  const up = [
    -Math.sin( yaw ) * sp,
    cp,
    Math.cos( yaw ) * sp
  ];

  const rimAzimuth = radians( crust.rimDirection );
  const rimElevation = radians( crust.rimHeight );

  renderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: camera.renderScale,
    uniforms: {
      uPhase: phase,
      uPlateScale: plates.size > 0 ? 1 / plates.size : 1,
      uFlow: Math.round( plates.flow ) * PERIOD * phase,
      uWander: plates.wander,
      uCrack: plates.crack,
      uCrackSoft: Math.max(
        plates.softness,
        1e-3
      ),
      uBreath: plates.breath,
      uFine: plates.fineCracks,
      uBevel: plates.bevel,
      uWarp: plates.warp,
      uHeatScale: heat.size > 0 ? 1 / heat.size : 1,
      uHeatFlow: Math.round( heat.flow ) * PERIOD * phase,
      uHeatContrast: heat.contrast,
      uPlateGlow: heat.plateGlow,
      uHalo: heat.halo,
      uCool: linear( melt.cool ),
      uHot: linear( melt.hot ),
      uCore: linear( melt.core ),
      uGlow: melt.glow,
      uGlowContrast: melt.contrast,
      uRock: linear( crust.color ),
      uRoughness: crust.roughness,
      uRimDir: [
        Math.sin( rimAzimuth ) * Math.cos( rimElevation ),
        Math.sin( rimElevation ),
        -Math.cos( rimAzimuth ) * Math.cos( rimElevation )
      ],
      uRimColor: linear( crust.rimColor ),
      uRim: crust.rim,
      uHaze: linear( air.haze ),
      uHazeDensity: air.hazeDensity,
      uSky: linear( air.sky ),
      uShimmer: air.shimmer,
      uShimmerRise: Math.round( air.shimmerSpeed ) * PERIOD * phase,
      uSparkCount: Math.min(
        MAX_SPARKS,
        Math.round( air.sparks )
      ),
      uSparkSize: Math.max(
        air.sparkSize,
        1e-4
      ),
      uSparkBright: air.sparkBrightness,
      uSparkSpeed: Math.max(
        1,
        Math.round( air.sparkSpeed )
      ),
      uEyeHeight: Math.max(
        camera.height,
        0.05
      ),
      uRight: right,
      uUp: up,
      uForward: forward,
      uFocal: 0.5 / Math.tan( radians( camera.fieldOfView ) / 2 ),
      uExposure: camera.exposure
    }
  } );
} );
