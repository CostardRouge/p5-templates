import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

import {
  RAMP_WIDTH,
  materialRender,
  drawBackground
} from "../_iridescence.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// iridescent-v4-orbit-pearls
//
// flowers-shaders-v5-orbit-pearls — the twisted braid of pipes with pearls
// corkscrewing around it, raymarched — under the category's material. The
// geometry, the pearls' loop-exact motion, the domain warp and its Lipschitz
// bound are v5's verbatim (see that sketch's header); only the shading is
// replaced: the cosine spectrum, the Fresnel "shimmer" and the world-space
// light go, and every hit is coloured by the shared ramp read in the camera's
// basis, with the pipe index and the height along the braid feeding the
// material's extra channel so the pipes stay distinguishable. The pearls read
// the same ramp through their nacre tint, and keep a specular highlight —
// that wet point of light is what makes them pearls.
//
// The ramp arrives through noiseFieldGpu's data textures (NEAREST, re-uploaded
// each frame — 1 KB), which is why the shared material interpolates its texels
// by hand rather than relying on LINEAR filtering.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 12;
const MAX_PEARLS = 6;
const MAX_STEPS = 160;
const SURF_EPS = 0.001;

const fragmentFor = ( shadeGlsl ) => `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) };

  uniform float uT;

  // ── Braid geometry ──
  uniform float uPipeCount;
  uniform float uPipeRadius;
  uniform float uBraidRadius;
  uniform float uTwist;
  uniform float uSpin;
  uniform float uRadiusPulse;
  uniform float uPulseFreq;
  uniform float uPulseSpeed;
  uniform float uMarchLipschitz;

  // ── Pearls ──
  uniform float uPearlCount;
  uniform vec4  uPearl[${ MAX_PEARLS }];
  uniform float uPearlRadius;
  uniform float uDeform;
  uniform float uDeformWidth;
  uniform float uPearlTint;        // 0 = white nacre, 1 = the full ramp
  uniform float uPearlBrightness;
  uniform float uPearlShift;       // ramp offset between pearls

  // ── Camera ──
  uniform float uCamDist;
  uniform float uFocal;
  uniform float uPitch;
  uniform float uYaw;
  uniform float uFogDensity;
  uniform float uFadeStart;        // the depth fade's start (the material has its own uFogStart)
  uniform float uMaxDist;

  // ── What feeds the material's extra channel ──
  uniform float uSpan;             // the pearls' travel span (the structure's height)
  uniform float uPipeShift;        // ramp offset between neighbouring pipes
  uniform float uLengthShift;      // ramp drift per world unit of height

  // ── The wet sheen ──
  uniform float uSpecular;
  uniform float uSpecPower;
  uniform float uAoAmount;

  ${ shadeGlsl }

  vec3 warpByPearls(vec3 p) {
    if (uPearlCount < 0.5 || abs(uDeform) < 1e-6) { return p; }

    vec3 q = p;

    for (int k = 0; k < ${ MAX_PEARLS }; k++) {
      if (float(k) >= uPearlCount) { break; }

      vec3 u = (p - uPearl[k].xyz) / uDeformWidth;

      q -= uDeform * u * exp(-dot(u, u));
    }

    return q;
  }

  float braidRadiusAt(float y) {
    return uBraidRadius * (1.0 + uRadiusPulse * sin(y * uPulseFreq + uT * uPulseSpeed));
  }

  float mapPipes(vec3 rawP) {
    vec3 p = warpByPearls(rawP);

    float phi = p.y * uTwist + uT * uSpin;
    float c = cos(phi);
    float s = sin(phi);
    vec2  q = vec2(c * p.x - s * p.z, s * p.x + c * p.z);

    float br = braidRadiusAt(p.y);
    float best = 1e9;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  centre = br * vec2(cos(a), sin(a));
      float d = length(q - centre) - uPipeRadius;

      best = min(best, d);
    }

    return best / uMarchLipschitz;
  }

  float mapPearls(vec3 p) {
    float best = 1e9;

    for (int k = 0; k < ${ MAX_PEARLS }; k++) {
      if (float(k) >= uPearlCount) { break; }

      best = min(best, length(p - uPearl[k].xyz) - uPearlRadius);
    }

    return best;
  }

  float nearestPearl(vec3 p) {
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PEARLS }; k++) {
      if (float(k) >= uPearlCount) { break; }

      float d = length(p - uPearl[k].xyz);

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  float mapScene(vec3 p) {
    return min(mapPipes(p), mapPearls(p));
  }

  float nearestPipe(vec3 rawP) {
    vec3 p = warpByPearls(rawP);

    float phi = p.y * uTwist + uT * uSpin;
    float c = cos(phi);
    float s = sin(phi);
    vec2  q = vec2(c * p.x - s * p.z, s * p.x + c * p.z);

    float br = braidRadiusAt(p.y);
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  centre = br * vec2(cos(a), sin(a));
      float d = length(q - centre);

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  vec3 calcNormal(vec3 p) {
    vec2 k = vec2(1.0, -1.0);
    float e = SURF_EPS;

    return normalize(
      k.xyy * mapScene(p + k.xyy * e) +
      k.yyx * mapScene(p + k.yyx * e) +
      k.yxy * mapScene(p + k.yxy * e) +
      k.xxx * mapScene(p + k.xxx * e)
    );
  }

  float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;

    for (int i = 0; i < 4; i++) {
      float h = 0.02 + 0.10 * float(i);
      float d = mapScene(p + n * h);

      occ += (h - d) * sca;
      sca *= 0.6;
    }

    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
  }

  // The material wants its normal and view vector in the camera's basis — x
  // right, y DOWN, z toward the eye — so a light direction edited on the
  // form means the same thing here as on the mesh sketches.
  vec3 shade(vec3 pos, vec3 n, vec3 rd, float t, vec3 right, vec3 up, vec3 fwd) {
    vec3 nV = vec3(dot(n, right), -dot(n, up), -dot(n, fwd));
    vec3 vV = vec3(-dot(rd, right), dot(rd, up), dot(rd, fwd));

    bool  isPearl = mapPearls(pos) < mapPipes(pos);
    float k = isPearl ? nearestPearl(pos) : nearestPipe(pos);
    float count = isPearl ? max(uPearlCount, 1.0) : max(uPipeCount, 1.0);
    float extra = isPearl
      ? k * uPearlShift
      : k / count * uPipeShift + pos.y * uLengthShift;

    // The cell: the pipe (or pearl) index around, the height along, and the
    // index again — so the stagger and the wave can run per pipe.
    vec3 cell = vec3(k / count, clamp(pos.y / max(uSpan, 1e-3) + 0.5, 0.0, 1.0), k / count);

    vec3 col = iridescentShade(nV, vV, t, cell, pos, extra);

    if (isPearl) {
      col = clamp(mix(vec3(1.0), col, uPearlTint) * uPearlBrightness, 0.0, 1.0);
    }

    vec3  toLight = normalize(-uLightDir);
    vec3  hlf = normalize(toLight + vV);
    float spec = pow(max(dot(nV, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = mix(1.0, calcAO(pos, n), uAoAmount);

    return col * ao + vec3(spec) * ao;
  }

  vec4 traceRay(vec3 ro, vec3 rd, vec3 right, vec3 up, vec3 fwd) {
    float t = 0.0;
    float d = 1e9;
    bool  hit = false;
    bool  escaped = false;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
      vec3  pos = ro + rd * t;
      d = mapScene(pos);

      if (d < SURF_EPS) { hit = true; break; }

      t += d;

      if (t > uMaxDist) { escaped = true; break; }
    }

    // Step-starved rays glued to a contact crease are accepted (v5's rule);
    // rays that grazed and flew past stay background.
    if (!hit && !escaped && d < SURF_EPS * 4.0) {
      hit = true;
    }

    if (!hit) { return vec4(0.0); }

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    vec3 col = shade(pos, n, rd, t, right, up, fwd);

    float fog = exp(-uFogDensity * max(0.0, t - uFadeStart));

    return vec4(col, fog);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float cy = cos(uYaw);
    float sy = sin(uYaw);

    vec3 ro = uCamDist * vec3(cp * sy, sp, -cp * cy);
    vec3 fwd = normalize(-ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);

    vec3 rd = normalize(fwd * uFocal + right * uv.x + up * uv.y);

    gl_FragColor = traceRay(ro, rd, right, up, fwd);
  }
`;

// One renderer (one GL program) per material variant: the material's
// selects and curves are baked into its GLSL, so a dropdown change compiles
// a new permutation once and the fragment never branches on them.
const renderers = new Map();

function rendererFor( shade ) {
  let renderer = renderers.get( shade.key );

  if ( !renderer ) {
    renderer = createNoiseFieldRenderer( fragmentFor( shade.glsl ) );
    renderers.set(
      shade.key,
      renderer
    );
  }

  return renderer;
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const braid = o.braid ?? defaults.braid;
  const pearl = o.pearls ?? defaults.pearls;
  const camera = o.camera ?? defaults.camera;
  const quality = o.quality ?? defaults.quality;
  const colors = o.colors ?? defaults.colors;
  const light = o.light ?? defaults.light;

  p.clear();
  drawBackground(
    p,
    o.background
  );

  const timeScale = o.timeScale ?? defaults.timeScale;

  // Loop-exact clock: every rate is whole cycles per loop (v5's rule).
  const t = animation.angle;

  const spinTurns = Math.round( ( braid.spin ?? defaults.braid.spin ) * timeScale );
  const pulseCycles = Math.round( ( braid.pulseSpeed ?? defaults.braid.pulseSpeed ) * timeScale );
  const orbitTurns = Math.round( ( camera.orbitSpeed ?? defaults.camera.orbitSpeed ) * timeScale );

  const pipeCount = Math.min(
    braid.pipeCount ?? defaults.braid.pipeCount,
    MAX_PIPES
  );
  const pipeRadius = braid.pipeRadius ?? defaults.braid.pipeRadius;
  const braidRadius = braid.braidRadius ?? defaults.braid.braidRadius;
  const twist = braid.twist ?? defaults.braid.twist;
  const radiusPulse = braid.radiusPulse ?? defaults.braid.radiusPulse;
  const pulseFreq = braid.pulseFreq ?? defaults.braid.pulseFreq;

  // Pearl motion, CPU-side, exactly as v5.
  const pearlCount = Math.min(
    pearl.count ?? defaults.pearls.count,
    MAX_PEARLS
  );
  const fallCycles = Math.round( ( pearl.speed ?? defaults.pearls.speed ) * timeScale );
  const swirlTurns = Math.round( pearl.swirl ?? defaults.pearls.swirl );
  const gravity = pearl.gravity ?? defaults.pearls.gravity;
  const span = pearl.span ?? defaults.pearls.span;
  const orbitRadius = pearl.orbitRadius ?? defaults.pearls.orbitRadius;
  const pearlRadius = pearl.size ?? defaults.pearls.size;
  const phaseTurns = pearl.phase ?? defaults.pearls.phase;
  const spreadTurns = pearl.spread ?? defaults.pearls.spread;
  const deform = pearl.deform ?? defaults.pearls.deform;
  const deformWidth = Math.max(
    pearl.deformRadius ?? defaults.pearls.deformRadius,
    0.05
  );

  const pearlData = new Float32Array( MAX_PEARLS * 4 );

  for ( let k = 0; k < pearlCount; k++ ) {
    const raw = ( t / p.TAU ) * fallCycles + k / pearlCount;
    const u = ( ( raw % 1 ) + 1 ) % 1;
    const shaped = u + gravity * ( u * u - u );
    const theta = p.TAU * ( phaseTurns + ( spreadTurns * k ) / pearlCount )
      + p.TAU * swirlTurns * shaped;

    pearlData[ k * 4 ] = orbitRadius * Math.cos( theta );
    pearlData[ k * 4 + 1 ] = span * ( 0.5 - shaped );
    pearlData[ k * 4 + 2 ] = orbitRadius * Math.sin( theta );
  }

  // Conservative Lipschitz bound for the march (v5's two factors).
  const maxR = braidRadius * ( 1 + radiusPulse ) + pipeRadius;
  const pulseSlope = braidRadius * radiusPulse * pulseFreq;
  const twistLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope ) ** 2 ) * 1.1;
  const warpLipschitz = 1 + ( 1.213 * Math.abs( deform ) * pearlCount ) / deformWidth;
  const marchLipschitz = twistLipschitz * warpLipschitz;

  const fov = camera.fov ?? defaults.camera.fov;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );
  const camDist = camera.distance ?? defaults.camera.distance;

  const material = materialRender(
    o.material,
    o.background,
    {
      scale: span,
      axis: "y"
    }
  );

  rendererFor( material.shade ).render( {
    columns: 1,
    rows: 1,
    resolutionScale: quality.renderScale ?? defaults.quality.renderScale,
    textures: {
      uRamp: {
        data: material.ramp.bytes,
        width: RAMP_WIDTH,
        height: 1,
        format: "rgba"
      }
    },
    uniforms: {
      ...material.uniforms,
      uT: t,
      uPipeCount: pipeCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uTwist: twist,
      uSpin: spinTurns,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseSpeed: pulseCycles,
      uMarchLipschitz: marchLipschitz,
      uPearlCount: pearlCount,
      uPearl: {
        vec4v: pearlData
      },
      uPearlRadius: pearlRadius,
      uDeform: deform,
      uDeformWidth: deformWidth,
      uPearlTint: pearl.tint ?? defaults.pearls.tint,
      uPearlBrightness: pearl.brightness ?? defaults.pearls.brightness,
      uPearlShift: pearl.rampShift ?? defaults.pearls.rampShift,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: camera.pitch ?? defaults.camera.pitch,
      uYaw: ( camera.yaw ?? defaults.camera.yaw ) + t * orbitTurns,
      uSpan: span,
      uPipeShift: colors.pipeShift ?? defaults.colors.pipeShift,
      uLengthShift: colors.lengthShift ?? defaults.colors.lengthShift,
      uSpecular: light.specular ?? defaults.light.specular,
      uSpecPower: light.specPower ?? defaults.light.specPower,
      uAoAmount: light.ao ?? defaults.light.ao,
      uFogDensity: camera.fogDensity ?? defaults.camera.fogDensity,
      uFadeStart: camDist,
      uMaxDist: camDist + 10
    }
  } );
} );
