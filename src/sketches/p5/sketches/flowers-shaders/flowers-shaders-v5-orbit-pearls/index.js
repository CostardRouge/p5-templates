import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// flowers-shaders v5 — orbit pearls.
//
// In "flowers-shaders v4 — pearls" (which stays untouched) the pearls fell
// INSIDE the funnel, threading the braid axis, and their deformation was a
// bulge/pinch of the braid radius — purely axial. Here the pearls fall on the
// OUTSIDE of the tornado: each one orbits at a configurable radius beyond the
// pipes, and an optional SWIRL makes it corkscrew around the structure as it
// falls (whole turns per fall, so the wrap back to the top stays seamless)
// instead of dropping in a straight vertical line. Several staggered pearls
// with swirl enabled chase each other down a helical path, and their combined
// influence prints a travelling spiral wave onto the braid.
//
// ── The deformation: a 3D domain warp (this is the new part) ─────────────────
// An off-axis pearl can't be expressed as a braid-radius modulation (that is
// rotationally symmetric by construction), so v5 deforms SPACE instead of the
// radius. Every pearl carries a Gaussian displacement field
//
//   v(p) = deform · u · exp(−|u|²),   u = (p − pearl) / reach
//
// and the braid SDF is sampled at p − Σ v(p): with deform > 0 the sampled
// point is pulled toward the pearl, so the surface appears PUSHED AWAY from it
// (repulsion — the pipes dent aside to let the pearl pass); with deform < 0
// the pipes lean out of the funnel toward the pearl (attraction). The linear-
// in-u form keeps the field smooth through the pearl's centre (no normalise()
// singularity) and caps the displacement at 0.43 · deform world units.
//
// ── Marching safety ──────────────────────────────────────────────────────────
// A domain warp scales distances, so the sphere-trace divisor now has two
// factors: v2's twist Lipschitz bound (unchanged — the underlying geometry is
// the plain braid) times the warp's own Lipschitz bound. The Jacobian of
// u·exp(−|u|²) is bounded by 1.213 (attained at |u| = 1/√2), giving
// warpLip = 1 + 1.213 · |deform| · count / reach, with every pearl summed as
// if their fields overlapped — conservative, never wrong. Both factors are
// computed on the CPU and passed pre-multiplied.
//
// Pearl motion is loop-exact like v4: whole falls per loop, gravity-eased
// (u = 0 → 0, u = 1 → 1 preserved), fall speed sign = direction (negative
// rises), and the swirl is snapped to whole turns per fall so the top-wrap
// lands on the same azimuth the pearl left from.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 12; // matches the "pipes" slider max
const MAX_PEARLS = 6; // matches the "pearls" slider max
const MAX_STEPS = 128; // sphere-trace iterations per ray
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
  uniform float uMarchLipschitz;  // CPU-computed twist × warp safety divisor

  // ── Pearls (orbiting OUTSIDE the funnel) ──
  uniform float uPearlCount;              // pearls corkscrewing around the braid
  uniform vec4  uPearl[${ MAX_PEARLS }];  // xyz = world position (CPU-side motion)
  uniform float uPearlRadius;             // pearl size
  uniform float uDeform;                  // displacement: >0 repel, <0 attract
  uniform float uDeformWidth;             // reach (world units) of the warp
  uniform float uPearlTint;               // 0 = pure white nacre, 1 = full iridescence
  uniform float uPearlBrightness;
  uniform float uPearlHueShift;           // hue offset between pearls

  // ── Camera ──
  uniform float uCamDist;         // eye distance from the braid axis
  uniform float uFocal;           // focal length (derived from field of view)
  uniform float uPitch;           // eye elevation
  uniform float uYaw;             // eye orbit angle (base + time orbit, CPU-side)

  // ── Iridescent palette (shared vocabulary with v1 / v2 / v4) ──
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

  // Oil-slick / thin-film iridescence — identical palette to flowers-shaders
  // v1/v2/v4: a cosine (IQ) spectrum with the RGB channels phase-shifted so
  // the hue sweeps cleanly through the rainbow, desaturated toward luma and
  // scaled by brightness.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // The pearls' Gaussian displacement field (see header): sampling the braid
  // at the warped point makes its surface dent away from (deform > 0) or lean
  // toward (deform < 0) each passing pearl.
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

  // braidRadius pulsing along the axis — unchanged from v2.
  float braidRadiusAt(float y) {
    return uBraidRadius * (1.0 + uRadiusPulse * sin(y * uPulseFreq + uT * uPulseSpeed));
  }

  // Signed distance to the deformed braid: warp space by the pearls, untwist,
  // then union N straight tubes.
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

    // Conservative bound for the twisted + warped metric (see header).
    return best / uMarchLipschitz;
  }

  // Exact distance to the nearest pearl (spheres on their orbit path).
  float mapPearls(vec3 p) {
    float best = 1e9;

    for (int k = 0; k < ${ MAX_PEARLS }; k++) {
      if (float(k) >= uPearlCount) { break; }

      best = min(best, length(p - uPearl[k].xyz) - uPearlRadius);
    }

    return best;
  }

  // Which pearl owns this point — recomputed once at the hit for its hue.
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

  // Which pipe owns this point — recomputed once at the hit for colour
  // banding, in the same warped space the surface was traced in.
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
    // Fresnel: how grazing the view is — drives the oil-slick hue slide + rim.
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);

    // Material: whichever surface (pipe or pearl) the hit actually sits on.
    vec3 base;

    if (mapPearls(pos) < mapPipes(pos)) {
      // Nacre: mostly-white with a Fresnel-shifted iridescent glaze — the same
      // spectrum as the pipes, blended toward white by the tint slider.
      float k = nearestPearl(pos);
      float phase = k * uPearlHueShift + uT * uHueSpeed + uShimmer * fres;

      base = mix(vec3(1.0), iridescent(phase), uPearlTint) * uPearlBrightness;
      base = clamp(base, 0.0, 1.0);
    } else {
      float k = nearestPipe(pos);
      float phase = pos.y * uLengthHueShift
        + uT * uHueSpeed
        + k * uPipeHueShift;

      base = iridescent(phase + uShimmer * fres);
    }

    // Lighting — diffuse + a glossy spec for the wet sheen (shared by both).
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

const orbitPearls = createNoiseFieldRenderer( FRAGMENT );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const braid = o.braid ?? {};
  const pearl = o.pearls ?? {};
  const camera = o.camera ?? {};
  const quality = o.quality ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const timeScale = o.timeScale ?? 1;

  // ── Loop-exact clock ──────────────────────────────────────────────────────
  // animation.angle sweeps exactly TAU per loop, so the loop seam is invisible
  // only when every time-driven rate completes a WHOLE number of cycles per
  // loop. Each raw slider rate (× time scale) is therefore rounded to whole
  // cycles below — including the pearls' falls and their swirl.
  const t = animation.angle;

  const spinTurns = Math.round( ( braid.spin ?? 0.6 ) * timeScale );
  const pulseCycles = Math.round( ( braid.pulseSpeed ?? 1 ) * timeScale );
  const orbitTurns = Math.round( ( camera.orbitSpeed ?? 0.15 ) * timeScale );

  // Hue scroll — whole palette periods (one period = 1 / hueSpread) per loop.
  const hueSpread = colors.hueSpread ?? 1.4;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 0.05 ) * timeScale * p.TAU * hueSpread );

  const pipeCount = Math.min(
    braid.pipeCount ?? 3,
    MAX_PIPES
  );
  const pipeRadius = braid.pipeRadius ?? 0.28;
  const braidRadius = braid.braidRadius ?? 0.85;
  const twist = braid.twist ?? 2.2;
  const radiusPulse = braid.radiusPulse ?? 0.18;
  const pulseFreq = braid.pulseFreq ?? 0.8;

  // ── Pearl motion (CPU-side — positions are just uniforms to the shader) ───
  // Each pearl falls the whole travel span once per fall on an orbit OUTSIDE
  // the funnel, staggered in phase and azimuth so N pearls chase each other
  // evenly. The swirl corkscrews the pearl around the braid as it falls —
  // snapped to whole turns per fall so the wrap back to the top re-enters on
  // the azimuth it left from. Gravity eases the fall (and the swirl with it,
  // like a tightening vortex); negative fall speed reverses the direction.
  const pearlCount = Math.min(
    pearl.count ?? 3,
    MAX_PEARLS
  );
  const fallCycles = Math.round( ( pearl.speed ?? 1 ) * timeScale );
  const swirlTurns = Math.round( pearl.swirl ?? 1 );
  const gravity = pearl.gravity ?? 0.35;
  const span = pearl.span ?? 6;
  const orbitRadius = pearl.orbitRadius ?? 1.25;
  const pearlRadius = pearl.size ?? 0.3;
  const deform = pearl.deform ?? 0.8;
  const deformWidth = Math.max(
    pearl.deformRadius ?? 0.8,
    0.05
  );

  const pearlData = new Float32Array( MAX_PEARLS * 4 );

  for ( let k = 0; k < pearlCount; k++ ) {
    const raw = ( t / p.TAU ) * fallCycles + k / pearlCount;
    const u = ( ( raw % 1 ) + 1 ) % 1;
    const shaped = u + gravity * ( u * u - u );
    const theta = ( p.TAU * k ) / pearlCount + p.TAU * swirlTurns * shaped;

    pearlData[ k * 4 ] = orbitRadius * Math.cos( theta );
    pearlData[ k * 4 + 1 ] = span * ( 0.5 - shaped );
    pearlData[ k * 4 + 2 ] = orbitRadius * Math.sin( theta );
  }

  // Conservative Lipschitz bound for the march, in two factors (see header):
  // v2's twist bound for the plain braid, times the pearls' warp bound —
  // 1.213 is the maximum Jacobian norm of u·exp(−|u|²), and every pearl is
  // summed as if their fields overlapped. A 10% margin on the twist factor
  // keeps the march from overshooting.
  const maxR = braidRadius * ( 1 + radiusPulse ) + pipeRadius;
  const pulseSlope = braidRadius * radiusPulse * pulseFreq;
  const twistLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope ) ** 2 ) * 1.1;
  const warpLipschitz = 1 + ( 1.213 * Math.abs( deform ) * pearlCount ) / deformWidth;
  const marchLipschitz = twistLipschitz * warpLipschitz;

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

  orbitPearls.render( {
    columns: 1,
    rows: 1,
    resolutionScale: quality.renderScale ?? 0.85,
    uniforms: {
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
      uPearlTint: pearl.tint ?? 0.35,
      uPearlBrightness: pearl.brightness ?? 1.15,
      uPearlHueShift: pearl.hueShift ?? 0.4,
      uCamDist: camDist,
      uFocal: focal,
      uPitch: camera.pitch ?? 0.18,
      uYaw: ( camera.yaw ?? 0.5 ) + t * orbitTurns,
      uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
      uHueSpread: hueSpread,
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
} );
