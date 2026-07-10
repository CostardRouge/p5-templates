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
// braid v2 — wire mesh.
//
// The braid family's loom: a plain-weave wire mesh being woven forever. The
// warp (vertical wires) runs the full height under tension — dead straight
// below the weaving front, taking up its over/under crimp just beneath it —
// while the weft (horizontal wires) exists only in the already-woven fabric
// above the front. The newest weft row sweeps in from the side like a shuttle
// pass (alternating direction each row, like a real loom), and the whole
// fabric scrolls upward, so the weaving happens at the SAME on-screen spot
// forever.
//
// ── Weave geometry (plain weave, guaranteed no overlap) ──────────────────────
// Wires live in the xy-plane, undulating in z. With spacing s and crimp
// amplitude a (material coordinate ym = y + scroll):
//
//   weft row i (along x, at ym = i·s):  z = +a·(−1)^i·cos(π·x/s)
//   warp col j (along y, at  x = j·s):  z = −a·(−1)^j·cos(π·ym/s)·crimp(y)
//
// At every crossing (j·s, i·s) the two wires sit at z = ±a·(−1)^(i+j): the
// checkerboard over/under of plain weave, separated by exactly 2a. Flooring
// a ≥ 1.15·r on the CPU keeps every crossing at least ~15% clear of touching —
// same clearance cheat as v1, no collision system. The warp's crimp envelope
// completes BELOW the first weft row, so the fabric is never half-crimped
// where wires actually cross.
//
// The cross-section distance to each wire family ignores the crimp's tangent
// slope, so the union is a bound, not a true distance — the march divides by
// a CPU Lipschitz factor covering the crimp slope (a·π/s) and the crimp
// envelope's ramp, exactly like v1.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// The fabric scrolls a WHOLE, EVEN number of rows per loop (the weave pattern
// repeats every 2 rows), and each row's shuttle sweep is a pure function of
// that row's distance above the front — so the frame at uT = TAU is identical
// to uT = 0.
//
// Orientation reuses the family's vector2d → screen-roll (uRoll), so the mesh
// can be woven in any on-screen direction, front and shuttle included.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 128; // sphere-trace iterations per ray

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Wire-mesh geometry ──
  uniform float uSpacing;     // wire pitch (world units between wires)
  uniform float uWireRadius;  // wire gauge
  uniform float uAmp;         // crimp amplitude (CPU-floored: clearance)
  uniform float uScrollVel;   // fabric scroll per uT radian (even rows/loop)
  uniform float uFrontY;      // weaving-front height (world y)
  uniform float uFrontW;      // warp crimp ramp half-width
  uniform float uHalfW;       // shuttle sweep span (covers the visible width)
  uniform float uCentreLipschitz; // CPU safety divisor for the march

  ${ IRIDESCENT_GLSL }

  // Warp crimp envelope: dead straight under tension below the front, fully
  // crimped just before the first weft row lands — so no crossing ever meets
  // a half-crimped wire.
  float warpCrimp(float y) {
    return smoothstep(uFrontY - 2.2 * uFrontW, uFrontY - 0.2 * uFrontW, y);
  }

  // Weft (horizontal wires): rows of the already-woven fabric. Row i's shuttle
  // sweep is a function of its height above the front, alternating direction
  // each row like a real loom pass.
  float weftDistance(vec3 p, float scrollY) {
    float ym = p.y + scrollY;
    float i = floor(ym / uSpacing + 0.5);
    float rowY = i * uSpacing - scrollY;
    float f = (rowY - uFrontY) / uSpacing;

    if (f <= 0.0) { return 1e9; }

    float parity = mod(i, 2.0);
    float z = uAmp * (1.0 - 2.0 * parity) * cos(PI * p.x / uSpacing);
    float d = length(vec2(ym - i * uSpacing, p.z - z)) - uWireRadius;

    if (f < 1.0) {
      // The emerging row: cut by the shuttle plane sweeping across the width.
      float dir = 1.0 - 2.0 * parity;
      float sweep = mix(-uHalfW, uHalfW, f);

      d = max(d, p.x * dir - sweep);
    }

    return d;
  }

  // Warp (vertical wires): full height, crimp phased to the scrolling fabric.
  float warpDistance(vec3 p, float scrollY) {
    float ym = p.y + scrollY;
    float j = floor(p.x / uSpacing + 0.5);
    float parity = mod(j, 2.0);
    float z = -uAmp * (1.0 - 2.0 * parity) * cos(PI * ym / uSpacing) * warpCrimp(p.y);

    return length(vec2(p.x - j * uSpacing, p.z - z)) - uWireRadius;
  }

  float mapScene(vec3 p) {
    float scrollY = uT * uScrollVel;
    float d = min(weftDistance(p, scrollY), warpDistance(p, scrollY));

    return d / uCentreLipschitz;
  }

  // Wire identity for the palette: warp and weft each cycle a few hue bands,
  // offset from each other so the two families read distinctly.
  float nearestPipe(vec3 p) {
    float scrollY = uT * uScrollVel;

    if (weftDistance(p, scrollY) < warpDistance(p, scrollY)) {
      float i = floor((p.y + scrollY) / uSpacing + 0.5);

      return mod(i, 4.0);
    }

    float j = floor(p.x / uSpacing + 0.5);

    return mod(j, 4.0) + 4.0;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  ${ BRAID_CAMERA_MAIN_GLSL }
`;

const meshRenderer = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const mesh = o.mesh ?? {};
  const front = o.front ?? {};
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

  // The plain-weave pattern repeats every 2 rows, so the scroll must advance a
  // whole EVEN number of rows per loop for the seam to be invisible.
  const scrollRows = 2 * Math.round( ( ( mesh.scrollRows ?? 2 ) * timeScale ) / 2 );

  // Hue scroll — whole palette periods per loop (same rule as the siblings).
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0 ) * timeScale * p.TAU * hueSpread );

  const spacing = Math.max(
    mesh.spacing ?? 0.55,
    0.05
  );
  const wireRadius = mesh.wireRadius ?? 0.07;

  // Clearance floor: crossings are separated by 2·amp, so amp ≥ 1.15·r keeps
  // every over/under pass at least ~15% clear of touching.
  const amp = Math.max(
    mesh.crimp ?? 0.12,
    1.15 * wireRadius
  );

  const frontY = front.height ?? -1.2;
  const frontW = Math.max(
    front.sharpness ?? 0.35,
    0.05
  );

  // ── Lipschitz bound ──────────────────────────────────────────────────────
  // The cross-section distance ignores the crimp tangent (max slope a·π/s)
  // and the warp's crimp ramp (smoothstep max slope 1.5 / (2w) times a).
  const crimpSlope = ( amp * Math.PI ) / spacing;
  const rampSlope = ( 1.5 / ( 2 * frontW ) ) * amp;
  const centreLipschitz = lipschitzDivisor( crimpSlope + rampSlope );

  const fov = camera.fov ?? 55;
  const focal = focalFromFov( fov );
  const camDist = camera.distance ?? 6.5;

  // Shuttle span: cover the visible width (plus roll headroom) at the mesh
  // plane so an emerging row starts fully off-screen and ends fully on.
  const aspect = Math.max(
    1,
    p.width / p.height
  );
  const halfW = ( camDist / focal ) * aspect * 1.6 + spacing;

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

  meshRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.75,
    uniforms: {
      uT: t,
      uSpacing: spacing,
      uWireRadius: wireRadius,
      uAmp: amp,
      uScrollVel: ( scrollRows * spacing ) / p.TAU,
      uFrontY: frontY,
      uFrontW: frontW,
      uHalfW: halfW,
      uCentreLipschitz: centreLipschitz,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: camera.pitch ?? 0.45,
      uYaw: camera.yaw ?? 0.35,
      uRoll: roll,
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 2.6,
      uLengthHueShift: colors.lengthHueShift ?? -0.2,
      uPipeHueShift: colors.pipeHueShift ?? 0.45,
      uShimmer: colors.shimmer ?? 2,
      uSaturation: colors.saturation ?? 0.7,
      uBrightness: colors.brightness ?? 1.25,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.8,
      uSpecular: light.specular ?? 1.2,
      uSpecPower: light.specPower ?? 48,
      uFresnelPower: light.fresnelPower ?? 3,
      uRimStrength: light.rimStrength ?? 0.7,
      uShadowSoft: light.shadowSoftness ?? 20,
      uFogDensity: camera.fogDensity ?? 0.15,
      uFogStart: camDist,
      uMaxDist: camDist + 10,
      uAberration: aberration.amount ?? 2,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );
} );
