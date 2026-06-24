import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// flowers-shaders v2 — pipes.
//
// A revamp of "flowers-shaders v1 — melted" (which stays untouched). v1 rebuilt
// the CPU flower in 2D: every pixel re-derived hundreds of overlapping discs and
// kept the one drawn last, so the "volume" was faked by stacking flat circles.
// This version drops the disc stack entirely and renders real 3D geometry: a
// bundle of solid pipes (tubes) that wind helically around a shared axis and
// rotate around one another, like a twisted rope / DNA braid. The iridescent,
// oil-slick palette from v1 (and torsade-shaders) is kept, but now it shades the
// curved surface of each pipe — so the thin-film colour shifts with the viewing
// angle the way a real soap-film or anodised-metal tube would.
//
// ── Geometry: the "untwist" trick (this is the optimised part) ────────────────
// A naive helix-tube SDF would, for every pixel and every march step, walk the
// helix to find the nearest point — hundreds of trig calls per step. Instead the
// whole braid is built from straight tubes and the *space* is twisted:
//
//   • The braid axis is y. At height y the bundle is rotated by
//     phi(y) = y·twist + t·spin. Undo that rotation on the sampled point
//     (rotate x,z by -phi) and every pipe becomes a perfectly straight, vertical
//     cylinder sitting at a fixed angle 2π·k/N on a circle of radius braidRadius.
//   • A straight tube is then just length(xz − centreₖ) − pipeRadius, unioned
//     (min) over the N pipes. No per-step helix search, no trig in the union.
//
// Twisting space is not an isometry along y, so the rotated field is a *bound* on
// the true distance, not the exact distance. The bound's Lipschitz constant grows
// with braidRadius·twist, so the march would overshoot and chew holes in the
// tubes. We divide the field by that constant (computed once on the CPU and
// passed as uTwistLipschitz) which keeps every step conservative — the standard,
// cheap fix for twisted SDFs, far cheaper than shortening every step blindly.
//
// ── Shading ───────────────────────────────────────────────────────────────────
// One sphere-trace per pixel; the surface normal is a 4-tap tetrahedron gradient
// (not 6), ambient occlusion is 4 short taps, and the far end of the (infinite)
// braid fades into the background through distance fog. Colour = the v1
// iridescent cosine spectrum, indexed by position along the pipe, by which pipe,
// and — for the oil-slick sheen — by a Fresnel term, so the hue slides as the
// surface curves away from the eye. Chromatic aberration re-traces R/B along
// slightly offset rays (only when enabled), matching v1's lens-fringe option.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 12; // matches the "pipes" slider max
const MAX_STEPS = 96; // sphere-trace iterations per ray
const SURF_EPS = 0.001; // hit threshold (world units)

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) }; // hit threshold (world units)

  uniform float uT;

  // ── Braid geometry ──
  uniform float uPipeCount;       // pipes winding around the shared axis
  uniform float uPipeRadius;      // tube thickness
  uniform float uBraidRadius;     // orbit radius of each pipe about the axis
  uniform float uTwist;           // helix rate (radians of winding per unit y)
  uniform float uSpin;            // braid rotation over time
  uniform float uRadiusPulse;     // 0..1 swell of braidRadius along the length
  uniform float uPulseFreq;       // spatial frequency of that swell
  uniform float uPulseSpeed;      // how fast the swell travels over time
  uniform float uTwistLipschitz;  // CPU-computed safety divisor for the march

  // ── Camera ──
  uniform float uCamDist;         // eye distance from the braid axis
  uniform float uFocal;           // focal length (derived from field of view)
  uniform float uPitch;           // eye elevation
  uniform float uYaw;             // eye orbit angle (base + time orbit, CPU-side)

  // ── Iridescent palette (shared vocabulary with v1 / torsade-shaders) ──
  uniform float uHueSpeed;        // spectrum scroll over time
  uniform float uHueSpread;       // spectral cycles packed into the palette
  uniform float uHuePhase;        // base hue rotation
  uniform float uLengthHueShift;  // hue drift along a pipe's length
  uniform float uPipeHueShift;    // hue offset between neighbouring pipes
  uniform float uShimmer;         // Fresnel-driven oil-slick hue shift
  uniform float uSaturation;
  uniform float uBrightness;

  // ── Lighting ──
  uniform vec3  uLightDir;        // normalised on the CPU
  uniform float uAmbient;
  uniform float uDiffuse;
  uniform float uSpecular;
  uniform float uSpecPower;
  uniform float uFresnelPower;    // rim sharpness
  uniform float uRimStrength;     // iridescent edge glow
  uniform float uFogDensity;      // distance fade into the background
  uniform float uFogStart;        // distance at which fog begins (≈ camera dist)
  uniform float uMaxDist;         // ray cutoff

  // ── Chromatic aberration ──
  uniform float uAberration;      // channel separation (0 = off)
  uniform int   uAberrationMode;  // 0 = radial, 1 = horizontal

  // Oil-slick / thin-film iridescence — identical palette to flowers-shaders v1
  // melted: a cosine (IQ) spectrum with the RGB channels phase-shifted so the hue
  // sweeps cleanly through the rainbow, desaturated toward luma and scaled by
  // brightness.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // braidRadius pulsing along the axis — the 3D echo of v1's size pulse that made
  // the flower cluster breathe along its path.
  float braidRadiusAt(float y) {
    return uBraidRadius * (1.0 + uRadiusPulse * sin(y * uPulseFreq + uT * uPulseSpeed));
  }

  // Signed distance to the braid: untwist space, then union N straight tubes.
  float mapScene(vec3 p) {
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

    // Conservative bound for the twisted metric (see header).
    return best / uTwistLipschitz;
  }

  // Which pipe owns this point — recomputed once at the hit for colour banding.
  float nearestPipe(vec3 p) {
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

  // 4-tap tetrahedron normal (two fewer scene evals than the central-difference).
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

  // Sphere-trace one ray; returns colour + coverage (alpha fades with fog so the
  // far braid melts into the p5 background instead of a hard cut).
  vec4 traceRay(vec3 ro, vec3 rd) {
    float t = 0.0;
    bool  hit = false;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
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

  void main() {
    // Top-left origin → bottom-left so the 3D y-axis points up on screen.
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    // Orbiting look-at camera aimed at the braid axis (origin).
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

    vec4 cr = traceRay(ro, rdR);
    vec4 cg = traceRay(ro, rdG);
    vec4 cb = traceRay(ro, rdB);

    gl_FragColor = vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));
  }
`;

const pipes = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const braid = o.braid ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle * ( o.timeScale ?? 1 );

  const pipeCount = Math.min(
    braid.pipeCount ?? 3,
    MAX_PIPES
  );
  const pipeRadius = braid.pipeRadius ?? 0.28;
  const braidRadius = braid.braidRadius ?? 0.85;
  const twist = braid.twist ?? 2.2;
  const radiusPulse = braid.radiusPulse ?? 0.18;
  const pulseFreq = braid.pulseFreq ?? 0.8;

  // Conservative Lipschitz bound for the twisted field: the radial gradient is
  // amplified by the helix winding (maxR·twist) and by the pulse's slope
  // (braidRadius·pulse·pulseFreq). A 10% margin keeps the march from overshooting.
  const maxR = braidRadius * ( 1 + radiusPulse ) + pipeRadius;
  const pulseSlope = braidRadius * radiusPulse * pulseFreq;
  const twistLipschitz = Math.sqrt(
    1 + ( maxR * twist + pulseSlope ) ** 2
  ) * 1.1;

  // Field of view (degrees) → focal length of the pinhole camera.
  const fov = camera.fov ?? 45;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );
  const camDist = camera.distance ?? 4.2;

  // Light direction from azimuth/elevation sliders (kept off the GLSL form).
  const az = light.azimuth ?? -0.6;
  const el = light.elevation ?? 0.8;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  pipes.render( {
    columns: 1,
    rows: 1,
    uniforms: {
      uT: t,
      uPipeCount: pipeCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uTwist: twist,
      uSpin: braid.spin ?? 0.6,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseSpeed: braid.pulseSpeed ?? 1,
      uTwistLipschitz: twistLipschitz,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: camera.pitch ?? 0.18,
      uYaw: ( camera.yaw ?? 0.5 ) + t * ( camera.orbitSpeed ?? 0.15 ),
      uHueSpeed: colors.hueSpeed ?? 0.05,
      uHueSpread: colors.hueSpread ?? 1.4,
      uHuePhase: colors.huePhase ?? 0,
      uLengthHueShift: colors.lengthHueShift ?? 0.2,
      uPipeHueShift: colors.pipeHueShift ?? 0.33,
      uShimmer: colors.shimmer ?? 0.6,
      uSaturation: colors.saturation ?? 1,
      uBrightness: colors.brightness ?? 1.3,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.18,
      uDiffuse: light.diffuse ?? 0.9,
      uSpecular: light.specular ?? 0.5,
      uSpecPower: light.specPower ?? 40,
      uFresnelPower: light.fresnelPower ?? 2.5,
      uRimStrength: light.rimStrength ?? 0.7,
      uFogDensity: camera.fogDensity ?? 0.14,
      uFogStart: camDist,
      uMaxDist: camDist + 10,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );

  renderTitle();
} );
