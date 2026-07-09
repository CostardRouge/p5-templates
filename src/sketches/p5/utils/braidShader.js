// ─────────────────────────────────────────────────────────────────────────────
// braidShader — the reusable "pipes" raymarch vocabulary.
//
// flowers-shaders v2 — pipes introduced a proven recipe for solid-tube SDF
// raymarching (sphere-trace + iridescent oil-slick palette + fresnel/rim
// lighting + fog + optional chromatic aberration), and signals-02-braid lifted
// it verbatim. This module factors that shared vocabulary into composable GLSL
// string chunks so new tube/pipe sketches stop copy-pasting ~200 lines of
// fragment source. The two existing sketches are intentionally left untouched
// (no visual-regression risk); new sketches compose these chunks with their own
// scene geometry.
//
// Composition contract — a sketch fragment is assembled as:
//
//   BRAID_UNIFORMS_GLSL          // uT + palette/lighting/camera/fog/aberration
//   `uniform float uMyThing;`    // sketch-specific uniforms
//   IRIDESCENT_GLSL              // iridescent(float t)
//   `float mapScene(vec3 p) {…}` // sketch-specific SDF (+ nearestPipe)
//   braidShadingGlsl( { … } )    // normal/AO/shade/traceRay (forward-declares
//                                //   mapScene/nearestPipe, so order is free)
//   BRAID_CAMERA_MAIN_GLSL       // orbit look-at camera + roll + aberration
//
// The chunks own their uniform declarations — do NOT redeclare any `u*` listed
// in BRAID_UNIFORMS_GLSL inside the sketch fragment (GLSL forbids duplicates).
// The noiseFieldGpu stdlib already provides `vUv`, `uResolution`, `PI`, `TAU`.
// ─────────────────────────────────────────────────────────────────────────────

// Every uniform the shared chunks read. `uRoll` is new relative to the v2-pipes
// camera: it rotates the screen-space ray basis so the scene's vertical axis can
// point along any on-screen direction (driven by a vector2d "orientation"
// option). Pass 0 for the classic upright framing.
export const BRAID_UNIFORMS_GLSL = `
  uniform float uT;               // loop clock (animation.angle, 0 → TAU)

  // ── Iridescent palette (shared vocabulary with flowers/torsade-shaders) ──
  uniform float uHueSpeed;        // spectrum scroll over time
  uniform float uHueSpread;       // spectral cycles packed into the palette
  uniform float uHuePhase;        // base hue rotation
  uniform float uLengthHueShift;  // hue drift along a pipe's length
  uniform float uPipeHueShift;    // hue offset between neighbouring pipes
  uniform float uShimmer;         // Fresnel-driven oil-slick hue shift
  uniform float uSaturation;
  uniform float uBrightness;

  // ── Lighting ──
  uniform vec3  uLightDir;        // normalised on the CPU (lightDirFrom)
  uniform float uAmbient;
  uniform float uDiffuse;
  uniform float uSpecular;
  uniform float uSpecPower;
  uniform float uFresnelPower;    // rim sharpness
  uniform float uRimStrength;     // iridescent edge glow

  // ── Camera / fog ──
  uniform float uCamDist;         // eye distance from the scene axis
  uniform float uFocal;           // focal length (focalFromFov)
  uniform float uPitch;           // eye elevation
  uniform float uYaw;             // eye orbit angle
  uniform float uRoll;            // screen-space roll (orientation vector)
  uniform float uFogDensity;      // distance fade into the background
  uniform float uFogStart;        // distance at which fog begins
  uniform float uMaxDist;         // ray cutoff

  // ── Chromatic aberration ──
  uniform float uAberration;      // channel separation px (0 = off)
  uniform int   uAberrationMode;  // 0 = radial, 1 = horizontal
`;

// Oil-slick / thin-film iridescence — the cosine (IQ) spectrum shared by
// flowers-shaders v1/v2 and torsade-shaders: RGB channels phase-shifted so the
// hue sweeps cleanly through the rainbow, desaturated toward luma and scaled by
// brightness.
export const IRIDESCENT_GLSL = `
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }
`;

/**
 * Normal estimation, ambient occlusion, surface shading and the sphere-trace
 * loop — everything between "I have an SDF" and "I have a shaded pixel".
 *
 * The sketch must define, anywhere in the fragment (forward-declared here):
 *   float mapScene(vec3 p);     // signed distance to the scene
 *   float nearestPipe(vec3 p);  // which pipe owns the hit (colour banding)
 *
 * @param {object} [config]
 * @param {number} [config.maxSteps=96]   sphere-trace iterations per ray
 * @param {number} [config.surfEps=0.001] hit threshold (world units)
 * @returns {string} GLSL chunk
 */
export function braidShadingGlsl( {
  maxSteps = 96,
  surfEps = 0.001
} = {} ) {
  return `
  const float SURF_EPS = ${ surfEps.toFixed( 4 ) }; // hit threshold (world units)

  float mapScene(vec3 p);
  float nearestPipe(vec3 p);

  // 4-tap tetrahedron normal (two fewer scene evals than central-difference).
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

  // Cheap ambient occlusion — a few short steps along the normal.
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

  vec3 shade(vec3 pos, vec3 n, vec3 rd) {
    float k = nearestPipe(pos);

    // Fresnel: how grazing the view is — drives the oil-slick hue slide + rim.
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);

    float phase = pos.y * uLengthHueShift
      + uT * uHueSpeed
      + k * uPipeHueShift;

    vec3 base = iridescent(phase + uShimmer * fres);

    // Lighting — diffuse + a glossy spec for the wet-tube sheen.
    float diff = max(dot(n, uLightDir), 0.0);
    vec3  hlf = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = calcAO(pos, n);

    vec3 col = base * (uAmbient + uDiffuse * diff * ao);
    col += base * fres * uRimStrength; // iridescent edge glow
    col += vec3(spec) * ao;            // white-ish highlight

    return col;
  }

  // Sphere-trace one ray; returns colour + coverage (alpha fades with fog so
  // the far scene melts into the p5 background instead of a hard cut).
  vec4 traceRay(vec3 ro, vec3 rd) {
    float t = 0.0;
    bool  hit = false;

    for (int i = 0; i < ${ maxSteps }; i++) {
      vec3  pos = ro + rd * t;
      float d = mapScene(pos);

      if (d < SURF_EPS) { hit = true; break; }

      t += d;

      if (t > uMaxDist) { break; }
    }

    if (!hit) { return vec4(0.0); }

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    vec3 col = shade(pos, n, rd);

    float fog = exp(-uFogDensity * max(0.0, t - uFogStart));

    return vec4(col, fog);
  }
`;
}

// Orbiting look-at pinhole camera aimed at the origin, with a screen-space roll
// (uRoll) applied to the ray basis and the v2-pipes chromatic-aberration option
// (R/B re-traced along slightly offset rays).
export const BRAID_CAMERA_MAIN_GLSL = `
  void main() {
    // Top-left origin → bottom-left so the 3D y-axis points up on screen.
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    // Screen-space roll: rotating uv by -uRoll rotates the rendered scene by
    // +uRoll, so the world y-axis appears along the requested orientation.
    float cr = cos(uRoll);
    float sr = sin(uRoll);
    uv = vec2(cr * uv.x + sr * uv.y, -sr * uv.x + cr * uv.y);

    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float cy = cos(uYaw);
    float sy = sin(uYaw);

    vec3 ro = uCamDist * vec3(cp * sy, sp, -cp * cy);
    vec3 fwd = normalize(-ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);

    if (uAberration < 0.5) {
      vec3 rd = normalize(fwd * uFocal + right * uv.x + up * uv.y);
      gl_FragColor = traceRay(ro, rd);
      return;
    }

    // Split R/B along slightly offset rays for a lens-like colour fringe.
    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize(uv + vec2(1e-4));
    vec2 off = dir * (uAberration / uResolution.y);

    vec3 rdR = normalize(fwd * uFocal + right * (uv.x + off.x) + up * (uv.y + off.y));
    vec3 rdG = normalize(fwd * uFocal + right * uv.x + up * uv.y);
    vec3 rdB = normalize(fwd * uFocal + right * (uv.x - off.x) + up * (uv.y - off.y));

    vec4 cr4 = traceRay(ro, rdR);
    vec4 cg4 = traceRay(ro, rdG);
    vec4 cb4 = traceRay(ro, rdB);

    gl_FragColor = vec4(cr4.r, cg4.g, cb4.b, max(cr4.a, max(cg4.a, cb4.a)));
  }
`;

/**
 * Light direction vector from azimuth/elevation sliders (kept off the GLSL
 * form so options stay human-readable angles).
 *
 * @param {number} azimuth   radians around the y axis
 * @param {number} elevation radians above the horizon
 * @returns {number[]} [x, y, z] unit-ish direction for uLightDir
 */
export function lightDirFrom(
  azimuth, elevation
) {
  return [
    Math.cos( elevation ) * Math.sin( azimuth ),
    Math.sin( elevation ),
    -Math.cos( elevation ) * Math.cos( azimuth )
  ];
}

/**
 * Field of view (degrees) → focal length of the pinhole camera.
 *
 * @param {number} fovDegrees vertical field of view
 * @returns {number} uFocal
 */
export function focalFromFov( fovDegrees ) {
  return 1 / Math.tan( ( fovDegrees * Math.PI ) / 180 / 2 );
}

/**
 * Conservative safety divisor for a non-isometric SDF (twisted / blended tube
 * centres). When tube centres drift with height at a bounded rate, dividing the
 * naive union distance by sqrt(1 + slope²) keeps every sphere-trace step
 * conservative — the standard cheap fix for twisted SDFs (see the header of
 * flowers-shaders v2 — pipes). A margin keeps the march from grazing through.
 *
 * @param {number} maxCentreSlope max |d centre / d height| over the scene
 * @param {number} [margin=1.15]  extra safety factor
 * @returns {number} divisor for the sketch's mapScene
 */
export function lipschitzDivisor(
  maxCentreSlope, margin = 1.15
) {
  return Math.sqrt( 1 + maxCentreSlope * maxCentreSlope ) * margin;
}
