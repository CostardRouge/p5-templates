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
// braid v5 — Turk's head.
//
// The nautical knot the family has been building toward: a rope woven over-under
// around a ring, the diagonal basket weave of a real Turk's head collar. It is
// a CLOSED object like v4's grommet, so the loop is pure rotation.
//
// ── Woven geometry (the v2 checkerboard, wrapped diagonally) ─────────────────
// Two families of strands spiral around the tube of a torus in OPPOSITE
// directions — ascending and descending helices — so on the tube surface they
// form the crossing diagonal lattice that reads as a Turk's head. At poloidal
// angle and minor radius, family A strand k sits at
//
//   θ_A = +leads·u + 2π·k/N + spin·t
//   θ_B = −leads·u + 2π·k/N + spin·t
//
// The over-under is v2's plain weave carried onto these diagonals: each family's
// minor radius is offset by ±depth·cos(N·leads·u). Two counter-helices cross
// wherever 2·leads·u hits a multiple of 2π/N, and cos(N·leads·u) is built to
// flip sign at exactly those points — so A rides OVER B at one crossing and
// UNDER at the next, the alternation that makes a true weave.
//
// ── No overlap, by construction ──────────────────────────────────────────────
// At every crossing the two families are radially separated by 2·depth (the
// cos term evaluates to ±1 there), so depth ≥ 1.15·wireR guarantees the
// over/under passes never touch. Away from crossings the families differ in
// poloidal angle; within a family the N strands are 2π/N apart, so the lay
// radius is floored at 1.15·wireR / sin(π/N). All enforced on the CPU before
// the shader runs. Bending space is non-isometric → the union is divided by a
// CPU Lipschitz factor, same recipe as v1/v2/v4.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Integer `leads` closes every strand onto itself; the poloidal spin, camera
// orbit and hue scroll each complete whole turns per loop.
//
// Orientation reuses the family's vector2d → screen-roll (uRoll).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PER_FAMILY = 8; // strands per family (the "strands" slider max)
const MAX_STEPS = 144; // sphere-trace iterations (woven field marches slower)

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Turk's-head weave ──
  uniform float uRingR;     // main ring radius (torus major)
  uniform float uMinorR;    // lay radius on the tube (CPU-floored: clearance)
  uniform float uWireR;     // strand thickness
  uniform float uWeaveDepth;// radial over-under (CPU-floored: clearance)
  uniform float uStrands;   // strands per family
  uniform float uLeads;     // poloidal wraps per toroidal turn (integer: closes)
  uniform float uWeaveN;    // = strands·leads (over-under alternation rate)
  uniform float uSpin;      // poloidal roll over time (whole turns/loop)
  uniform float uLipschitz; // CPU safety divisor for the bent-space march

  ${ IRIDESCENT_GLSL }

  // One family's nearest-strand distance in the tube cross-section. dir = +1
  // ascending, −1 descending; the ±depth offset is what threads the over-under.
  float familyDist(vec2 cs, float u, float dir, out float ident) {
    float base = dir * uLeads * u + uSpin * uT;
    float r = uMinorR + dir * uWeaveDepth * cos(uWeaveN * u);
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PER_FAMILY }; k++) {
      if (float(k) >= uStrands) { break; }

      float th = base + TAU * float(k) / uStrands;
      vec2  c = r * vec2(cos(th), sin(th));
      float d = length(cs - c);

      if (d < best) { best = d; bestK = float(k); }
    }

    ident = bestK;

    return best - uWireR;
  }

  float mapScene(vec3 p) {
    float u = atan(p.y, p.x);
    vec2  cs = vec2(length(p.xy) - uRingR, p.z);
    float ia;
    float ib;
    float da = familyDist(cs, u, 1.0, ia);
    float db = familyDist(cs, u, -1.0, ib);

    return min(da, db) / uLipschitz;
  }

  // Strand identity for the palette: family A uses 0..3, family B 4..7.
  float nearestPipe(vec3 p) {
    float u = atan(p.y, p.x);
    vec2  cs = vec2(length(p.xy) - uRingR, p.z);
    float ia;
    float ib;
    float da = familyDist(cs, u, 1.0, ia);
    float db = familyDist(cs, u, -1.0, ib);

    return da < db ? mod(ia, 4.0) : mod(ib, 4.0) + 4.0;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const turkRenderer = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const weave = o.weave ?? {};
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

  const spinTurns = Math.round( ( weave.spin ?? 0 ) * timeScale );
  const orbitTurns = Math.round( ( camera.orbitSpeed ?? 1 ) * timeScale );

  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0 ) * timeScale * p.TAU * hueSpread );

  const strands = Math.min(
    weave.strands ?? 3,
    MAX_PER_FAMILY
  );
  const leads = Math.round( weave.leads ?? 5 );
  const wireR = weave.wireRadius ?? 0.09;

  // Over-under clearance: crossings are separated by 2·depth, so depth ≥ 1.15·r
  // keeps every pass clear.
  const weaveDepth = Math.max(
    weave.depth ?? 0.14,
    1.15 * wireR
  );

  // Lay clearance: N strands per family are 2π/N apart on the lay circle, and
  // the lay radius must also clear the weave offset + gauge from the tube axis.
  const minorFloor = strands >= 2
    ? ( 1.15 * wireR ) / Math.sin( Math.PI / strands )
    : 0;
  const minorR = Math.max(
    weave.minorRadius ?? 0.45,
    Math.max(
      minorFloor,
      weaveDepth + wireR + 0.02
    )
  );

  // Ring floor: keep the hole open.
  const ringR = Math.max(
    weave.ringRadius ?? 1.7,
    ( minorR + weaveDepth + wireR ) * 1.2
  );

  const weaveN = strands * leads;

  // Bent-space Lipschitz: the strand centre drifts with u via the lay winding
  // (minorR·leads) and the radial weave (weaveDepth·weaveN), over an arc length
  // ≈ (R − minorR).
  const centreSlope = ( minorR * leads + weaveDepth * weaveN )
    / Math.max(
      ringR - minorR - weaveDepth,
      0.1
    );
  const lipschitz = lipschitzDivisor( centreSlope );

  const fov = camera.fov ?? 50;
  const focal = focalFromFov( fov );
  const camDist = camera.distance ?? 11.5;

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

  turkRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.7,
    uniforms: {
      uT: t,
      uRingR: ringR,
      uMinorR: minorR,
      uWireR: wireR,
      uWeaveDepth: weaveDepth,
      uStrands: strands,
      uLeads: leads,
      uWeaveN: weaveN,
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
      uLengthHueShift: colors.lengthHueShift ?? 0.35,
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
