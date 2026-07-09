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
// braid v1 — progressive.
//
// The flowers-shaders v2 pipes braid, but *being tied*. In v2 the twist is
// uniform everywhere (phi = y·twist + t·spin): the braid exists fully formed
// along its whole length. Here the strands enter loose — a flat fan of straight
// tubes — and get progressively interlaced as they cross a fixed "braiding
// front", like hair mid-plait. The tied pattern then scrolls away along the
// axis while fresh loose material keeps feeding in, so the knot forms at the
// SAME on-screen spot forever.
//
// ── Geometry ─────────────────────────────────────────────────────────────────
// Strand k's tube centre in the xz-plane at height y blends two arrangements:
//
//   • loose(k):  a static row spread along x (plus a gentle seamless sway, so
//                the waiting strands read as alive), and
//   • knot(k):   the braided position at winding phase φ(y,t) = y·wind − t·S:
//                  – spiral: br·(cos, sin)(aₖ + φ)      (the v2 helix bundle)
//                  – plait:  x = br·sin(θₖ), z = br·depth·sin(2θₖ)
//                            θₖ = φ + TAU·k/N — the classic hair-braid
//                            lissajous: strands weave over/under as they cross.
//
//   centre(k,y) = mix( loose(k), knot(k), e(y) )
//   e(y) = smoothstep(frontY − w, frontY + w, y)
//
// e(y) is fixed in world space, so the tying always happens at the same place;
// the traveling phase −t·S makes the tied braid scroll upward through it. This
// per-height centre drift makes the union-of-tubes field a bound rather than a
// true distance, so the march divides by a CPU-computed Lipschitz factor
// (lipschitzDivisor) — same technique as v2, but the bound now also covers the
// loose→knot blend slope and the sway.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// uT sweeps animation.angle (0 → TAU per loop); every time-driven rate (scroll,
// sway, pulse, hue) is rounded to a WHOLE number of cycles per loop, so the
// frame at uT = TAU is identical to uT = 0 — a seamless infinite loop that
// "starts at the right phase" by construction.
//
// ── Orientation ──────────────────────────────────────────────────────────────
// A vector2d option (bindable: gyroscope / orbit / mouse / hands) sets the
// braid's on-screen direction. It becomes a screen-space roll of the camera ray
// basis (uRoll), so the whole scene — braid, front, scroll — rotates together:
// the knots keep forming at the same spot relative to the braid axis whatever
// the orientation. That is the requested scroll compensation.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STRANDS = 12; // matches the "strands" slider max
const MAX_STEPS = 160; // sphere-trace iterations (higher: blended field marches slower)

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Progressive braid geometry ──
  uniform float uStrandCount;     // strands feeding the braid
  uniform float uPipeRadius;      // tube thickness
  uniform float uBraidRadius;     // braided-pattern amplitude
  uniform int   uKnotType;        // 0 = spiral, 1 = plait (over-under weave)
  uniform float uPlaitDepth;      // plait z amplitude as a ratio of x
  uniform float uWind;            // winding rate (radians per unit height)
  uniform float uScroll;          // whole pattern cycles per loop (CPU-rounded)
  uniform float uFrontY;          // braiding-front height (world y)
  uniform float uFrontW;          // front half-width (attach sharpness)
  uniform float uLooseSpread;     // half-width of the loose fan
  uniform float uSway;            // loose-strand sway amplitude
  uniform float uSwayFreq;        // sway spatial frequency along y
  uniform float uSwaySpeed;       // sway cycles per loop (CPU-rounded)
  uniform float uRadiusPulse;     // 0..1 swell of the braided amplitude
  uniform float uPulseFreq;       // spatial frequency of that swell
  uniform float uPulseSpeed;      // pulse cycles per loop (CPU-rounded)
  uniform float uCentreLipschitz; // CPU-computed safety divisor for the march

  ${ IRIDESCENT_GLSL }

  // How braided the bundle is at height y: 0 = loose fan, 1 = fully tied.
  // World-fixed, so the tying always happens at the same (screen) place.
  float engagement(float y) {
    return smoothstep(uFrontY - uFrontW, uFrontY + uFrontW, y);
  }

  // Strand k's tube centre in the xz-plane at height y.
  vec2 strandCentre(float k, float y) {
    // Loose arrangement: a row along x, swaying seamlessly while it waits.
    float fx = uStrandCount > 1.0
      ? (k / (uStrandCount - 1.0) - 0.5) * 2.0
      : 0.0;
    vec2 loose = vec2(fx * uLooseSpread, 0.0);

    loose.x += uSway * sin(y * uSwayFreq + uT * uSwaySpeed + k * 2.399);
    loose.y += uSway * 0.6 * cos(y * uSwayFreq * 0.8 + uT * uSwaySpeed + k * 1.7);

    // Braided arrangement at the traveling winding phase.
    float phase = y * uWind - uT * uScroll;
    float a = TAU * k / uStrandCount;
    float br = uBraidRadius
      * (1.0 + uRadiusPulse * sin(y * uPulseFreq + uT * uPulseSpeed));

    vec2 knot;

    if (uKnotType == 1) {
      // Plait: three-phase lissajous — sin for the side-to-side crossing,
      // sin(2θ) for the over-under depth, the classic hair-braid weave.
      float th = phase + a;
      knot = vec2(br * sin(th), br * uPlaitDepth * sin(2.0 * th));
    } else {
      // Spiral: the proven v2-pipes helix bundle.
      knot = br * vec2(cos(a + phase), sin(a + phase));
    }

    return mix(loose, knot, engagement(y));
  }

  // Signed-distance bound to the bundle: union of tubes whose centres drift
  // with height, kept conservative by the CPU Lipschitz divisor.
  float mapScene(vec3 p) {
    float best = 1e9;

    for (int k = 0; k < ${ MAX_STRANDS }; k++) {
      if (float(k) >= uStrandCount) { break; }

      vec2 c = strandCentre(float(k), p.y);
      float d = length(p.xz - c) - uPipeRadius;

      best = min(best, d);
    }

    return best / uCentreLipschitz;
  }

  // Which strand owns this point — recomputed at the hit for colour banding.
  float nearestPipe(vec3 p) {
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_STRANDS }; k++) {
      if (float(k) >= uStrandCount) { break; }

      vec2 c = strandCentre(float(k), p.y);
      float d = length(p.xz - c);

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const braidRenderer = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const braid = o.braid ?? {};
  const front = o.front ?? {};
  const loose = o.loose ?? {};
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

  // ── Loop-exact clock ────────────────────────────────────────────────────
  // animation.angle sweeps exactly TAU per loop; every time-driven rate is
  // rounded to whole cycles per loop so the last frame equals the first.
  const t = animation.angle;

  const scrollCycles = Math.round( ( braid.scrollSpeed ?? 1 ) * timeScale );
  const pulseCycles = Math.round( ( braid.pulseSpeed ?? 1 ) * timeScale );
  const swayCycles = Math.round( ( loose.swaySpeed ?? 1 ) * timeScale );

  // Hue scroll — whole palette periods (one period = 1 / hueSpread) per loop.
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );

  const strandCount = Math.min(
    braid.strandCount ?? 3,
    MAX_STRANDS
  );
  const pipeRadius = braid.pipeRadius ?? 0.16;
  const braidRadius = braid.braidRadius ?? 0.6;
  const knotType = braid.knotType ?? "plait";
  const plaitDepth = braid.plaitDepth ?? 0.45;
  const wind = braid.wind ?? 3;
  const radiusPulse = braid.radiusPulse ?? 0;
  const pulseFreq = braid.pulseFreq ?? 1;

  const frontY = front.height ?? -1;
  const frontW = Math.max(
    front.sharpness ?? 0.5,
    0.05
  );

  const looseSpread = loose.spread ?? 1.1;
  const sway = loose.sway ?? 0.12;
  const swayFreq = loose.swayFreq ?? 1.2;

  // ── Conservative Lipschitz bound for the blended field ──────────────────
  // The tube centres drift with height at a rate bounded by: the winding slope
  // of the braided pattern (amplified by the plait's 2θ depth term and the
  // radius pulse), the loose→knot blend slope across the front (smoothstep max
  // slope 1.5 / (2w) times the biggest centre jump), and the sway slope.
  const brMax = braidRadius * ( 1 + radiusPulse );
  const knotSlope = brMax * wind * Math.max(
    1,
    2 * plaitDepth
  ) + braidRadius * radiusPulse * pulseFreq;
  const mixSlope = ( 1.5 / ( 2 * frontW ) ) * ( looseSpread + brMax + sway * 1.6 );
  const swaySlope = sway * swayFreq * 1.6;
  const centreLipschitz = lipschitzDivisor( knotSlope + mixSlope + swaySlope );

  const fov = camera.fov ?? 55;
  const focal = focalFromFov( fov );
  const camDist = camera.distance ?? 6;

  // ── Orientation (vector2d, bindable) → screen roll ──────────────────────
  // {x:0, y:1} is the default upright braid; any direction rolls the whole
  // scene so the front stays perpendicular to the braid axis on screen.
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
    light.azimuth ?? -1.29,
    light.elevation ?? -0.6
  );

  braidRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.75,
    uniforms: {
      uT: t,
      uStrandCount: strandCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uKnotType: {
        int: knotType === "spiral" ? 0 : 1
      },
      uPlaitDepth: plaitDepth,
      uWind: wind,
      uScroll: scrollCycles,
      uFrontY: frontY,
      uFrontW: frontW,
      uLooseSpread: looseSpread,
      uSway: sway,
      uSwayFreq: swayFreq,
      uSwaySpeed: swayCycles,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseSpeed: pulseCycles,
      uCentreLipschitz: centreLipschitz,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: camera.pitch ?? 0,
      uYaw: camera.yaw ?? 0,
      uRoll: roll,
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.35,
      uPipeHueShift: colors.pipeHueShift ?? -0.95,
      uShimmer: colors.shimmer ?? 2.8,
      uSaturation: colors.saturation ?? 0.85,
      uBrightness: colors.brightness ?? 1.3,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.34,
      uDiffuse: light.diffuse ?? 0.66,
      uSpecular: light.specular ?? 0.99,
      uSpecPower: light.specPower ?? 24,
      uFresnelPower: light.fresnelPower ?? 3.3,
      uRimStrength: light.rimStrength ?? 0.87,
      uFogDensity: camera.fogDensity ?? 0.12,
      uFogStart: camDist,
      uMaxDist: camDist + 10,
      uAberration: aberration.amount ?? 0,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );
} );
