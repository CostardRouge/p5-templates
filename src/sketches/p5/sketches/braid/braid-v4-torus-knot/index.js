import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  BRAID_CAMERA_MAIN_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov,
  lipschitzDivisor
} from "@/p5/utils/braidShader.js";

// ─────────────────────────────────────────────────────────────────────────────
// braid v4 — torus knot (laid-rope grommet).
//
// The family's first CLOSED knot: a rope ring, cable-laid. Where v1–v3 feed an
// infinite braid/sheet through a fixed front, this is a finite sculptural
// object — a nautical grommet — so the loop is pure ROTATION, seamless with no
// phase bookkeeping at all.
//
// ── Geometry: the untwist trick, bent into a torus ───────────────────────────
// flowers-shaders v2 pipes laid N straight tubes on a small circle and twisted
// the SPACE around a straight axis. Here the same bundle is bent into a ring:
// the axis is the main circle (radius R in the xy-plane, facing the camera),
// and at toroidal angle u the bundle is rotated by turns·u, so the N strands
// spiral around the ring like the lay of a rope.
//
//   u   = atan2(p.y, p.x)                     // angle around the ring
//   q   = vec2(length(p.xy) − R, p.z)         // position in the tube section
//   θ_k = 2π·k/N + turns·u + spin·t           // strand k's poloidal angle
//   d   = min_k |q − minorR·(cosθ_k, sinθ_k)| − tubeR
//
// Integer `turns` makes each strand close onto itself after one trip round the
// ring (a clean N-loop cable); the poloidal `spin` (whole turns per loop) rolls
// the lay in place so the rope looks alive without the object going anywhere.
//
// ── No overlap, by construction ──────────────────────────────────────────────
// The N strands sit on a circle of radius minorR, 2π/N apart, so the CPU floors
// minorR ≥ 1.15·tubeR / sin(π/N): as parallel helices they can never touch. A
// single strand never meets its own next wrap (that wrap is a different
// toroidal position), and R is floored so the ring's hole stays open. Bending
// space is non-isometric, so the union is a bound — divided by a CPU Lipschitz
// factor for the lay's drift (minorR·turns / R), same recipe as v1/v2.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// u is periodic and `turns` is integer, so the object is genuinely closed; the
// poloidal spin, the camera orbit and the hue scroll each complete a whole
// number of turns per loop. Frame at uT = TAU == frame at uT = 0.
//
// Orientation reuses the family's vector2d → screen-roll (uRoll): it spins the
// medallion in its own plane, live and bindable.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STRANDS = 12; // matches the "strands" slider max
const MAX_STEPS = 128; // sphere-trace iterations per ray

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Torus rope geometry ──
  uniform float uRingR;     // main ring radius (torus major)
  uniform float uMinorR;    // lay circle radius (CPU-floored: clearance)
  uniform float uTubeR;     // strand thickness
  uniform float uStrands;   // strands in the lay
  uniform float uTurns;     // toroidal turns of the lay (integer: closes)
  uniform float uSpin;      // poloidal roll over time (whole turns/loop)
  uniform float uLipschitz; // CPU safety divisor for the bent-space march

  ${ IRIDESCENT_GLSL }

  // Poloidal angle of the whole bundle at ring-angle u (+ the rolling spin).
  float layPhase(float u) {
    return uTurns * u + uSpin * uT;
  }

  float mapScene(vec3 p) {
    float u = atan(p.y, p.x);
    vec2  q = vec2(length(p.xy) - uRingR, p.z);
    float phase = layPhase(u);
    float best = 1e9;

    for (int k = 0; k < ${ MAX_STRANDS }; k++) {
      if (float(k) >= uStrands) { break; }

      float th = TAU * float(k) / uStrands + phase;
      vec2  c = uMinorR * vec2(cos(th), sin(th));

      best = min(best, length(q - c) - uTubeR);
    }

    return best / uLipschitz;
  }

  // Strand identity for the palette banding.
  float nearestPipe(vec3 p) {
    float u = atan(p.y, p.x);
    vec2  q = vec2(length(p.xy) - uRingR, p.z);
    float phase = layPhase(u);
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_STRANDS }; k++) {
      if (float(k) >= uStrands) { break; }

      float th = TAU * float(k) / uStrands + phase;
      vec2  c = uMinorR * vec2(cos(th), sin(th));
      float d = length(q - c);

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const knotRenderer = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const rope = o.rope ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};
  const rendering = o.rendering ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;

  // All time-driven rates snap to whole turns per loop for the seamless spin.
  const spinTurns = Math.round( ( rope.spin ?? 1 ) * timeScale );
  const orbitTurns = Math.round( ( camera.orbitSpeed ?? 1 ) * timeScale );

  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0 ) * timeScale * p.TAU * hueSpread );

  const strands = Math.min(
    rope.strands ?? 3,
    MAX_STRANDS
  );
  const turns = Math.round( rope.turns ?? 5 );
  const tubeR = rope.tubeRadius ?? 0.16;

  // Clearance floor: N strands on the lay circle are 2π/N apart, so a minor
  // radius of 1.15·tubeR / sin(π/N) keeps every pair from touching.
  const minorFloor = strands >= 2
    ? ( 1.15 * tubeR ) / Math.sin( Math.PI / strands )
    : 0;
  const minorR = Math.max(
    rope.minorRadius ?? 0.4,
    minorFloor
  );

  // Ring floor: keep the hole open (bundle radius clears the centre).
  const ringR = Math.max(
    rope.ringRadius ?? 1.6,
    ( minorR + tubeR ) * 1.2
  );

  // Bent-space Lipschitz: the lay drifts minorR·turns per radian of u over an
  // arc length ≈ (R − minorR), so the field's slope is bounded by their ratio.
  const lipschitz = lipschitzDivisor( ( minorR * turns ) / Math.max(
    ringR - minorR,
    0.1
  ) );

  const fov = camera.fov ?? 50;
  const focal = focalFromFov( fov );
  const camDist = camera.distance ?? 8.5;

  const orientation = o.orientation ?? {};
  const ox = orientation.x ?? 0;
  const oy = orientation.y ?? 1;
  const roll = Math.hypot(
    ox,
    oy
  ) > 1e-3
    ? Math.atan2(
      oy,
      ox
    ) - Math.PI / 2
    : 0;

  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.5
  );

  knotRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.75,
    uniforms: {
      uT: t,
      uRingR: ringR,
      uMinorR: minorR,
      uTubeR: tubeR,
      uStrands: strands,
      uTurns: turns,
      uSpin: spinTurns,
      uLipschitz: lipschitz,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: camera.pitch ?? 0.42,
      uYaw: ( camera.yaw ?? 0 ) + t * orbitTurns,
      uRoll: roll,
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? 0.4,
      uPipeHueShift: colors.pipeHueShift ?? 0.5,
      uShimmer: colors.shimmer ?? 2,
      uSaturation: colors.saturation ?? 0.7,
      uBrightness: colors.brightness ?? 1.3,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.85,
      uSpecular: light.specular ?? 1.2,
      uSpecPower: light.specPower ?? 48,
      uFresnelPower: light.fresnelPower ?? 3,
      uRimStrength: light.rimStrength ?? 0.7,
      uShadowSoft: light.shadowSoftness ?? 22,
      uFogDensity: camera.fogDensity ?? 0.1,
      uFogStart: camDist,
      uMaxDist: camDist + 12,
      uAberration: aberration.amount ?? 2,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );
} );
