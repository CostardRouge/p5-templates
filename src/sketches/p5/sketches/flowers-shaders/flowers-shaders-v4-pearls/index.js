import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// flowers-shaders v4 — pearls.
//
// "flowers-shaders v2 — pipes" (which stays untouched) renders the iridescent
// tornado: a bundle of solid pipes winding helically around a shared vertical
// axis. This version drops PEARLS into that tornado — glossy spheres that fall
// along the braid axis, from the top of the funnel to the bottom, the way a
// bead would drop through a vortex under gravity. Each pearl carries a
// DEFORMATION field: as it passes, the braid locally reacts to it. With a
// positive deformation the pipes bulge outward around the pearl (the tornado
// opens to let it through); with a negative one they pinch inward, drawn onto
// the pearl as if it attracted them. Zero deformation lets the pearls thread
// the funnel without disturbing it.
//
// ── What is kept from v2, and what is new ────────────────────────────────────
// Kept: the whole braid geometry (untwist trick, radius pulse), the cosine
// iridescent palette, the shading model (Fresnel oil-slick hue slide, rim
// glow, spec, AO, fog) and the chromatic-aberration option.
//
// New:
//   • N pearls on the braid axis, evenly staggered in phase, travelling the
//     visible span once per fall. Their motion is loop-exact: the fall rate is
//     snapped to whole falls per loop, and a "gravity" slider eases each fall
//     from linear (0) to accelerating (1) — the shaping keeps u = 0 → 0 and
//     u = 1 → 1, so the wrap (pearl exits the bottom, re-enters the top) lands
//     exactly on the loop seam. A negative fall speed reverses the direction
//     (the pearls rise through the funnel instead).
//   • The deformation: each pearl multiplies the local braid radius by
//     1 + deform · exp(−((y − pearlY)/reach)²) — a Gaussian bulge (deform > 0)
//     or pinch (deform < 0, clamped so the radius never goes negative) centred
//     on the pearl and fading over "reach" world units.
//
// ── Marching with the extra deformation ──────────────────────────────────────
// The pearls themselves are exact sphere SDFs unioned in world space — they
// need no correction. The braid field, however, gains a new slope along y (the
// Gaussian's derivative), so the conservative Lipschitz divisor from v2 is
// extended: the radial amplification now uses the worst-case bulged radius,
// and the pulse-slope term adds the Gaussian's maximum slope (√(2/e)/reach per
// pearl, summed as if all pearls overlapped — conservative, never wrong). The
// march step budget is raised to compensate, and a render-scale option is
// exposed for the heavy end of the sliders.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 12; // matches the "pipes" slider max
const MAX_PEARLS = 6; // matches the "pearls" slider max
const MAX_STEPS = 160; // sphere-trace iterations per ray
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

  // ── Pearls ──
  uniform float uPearlCount;               // pearls falling through the funnel
  uniform float uPearlY[${ MAX_PEARLS }];  // axis height of each pearl (CPU-side motion)
  uniform float uPearlRadius;              // pearl size
  uniform float uDeform;                   // braid reaction: >0 repel, <0 attract
  uniform float uDeformWidth;              // reach (world units) of that reaction
  uniform float uPearlTint;                // 0 = pure white nacre, 1 = full iridescence
  uniform float uPearlBrightness;
  uniform float uPearlHueShift;            // hue offset between pearls

  // ── Camera ──
  uniform float uCamDist;         // eye distance from the braid axis
  uniform float uFocal;           // focal length (derived from field of view)
  uniform float uPitch;           // eye elevation
  uniform float uYaw;             // eye orbit angle (base + time orbit, CPU-side)

  // ── Iridescent palette (shared vocabulary with v1 / v2 / torsade-shaders) ──
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

  // Oil-slick / thin-film iridescence — identical palette to flowers-shaders
  // v1/v2: a cosine (IQ) spectrum with the RGB channels phase-shifted so the
  // hue sweeps cleanly through the rainbow, desaturated toward luma and scaled
  // by brightness.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // Summed Gaussian influence of every pearl at height y — the deformation the
  // pearls print onto the funnel as they pass.
  float pearlInfluence(float y) {
    if (uPearlCount < 0.5) { return 0.0; }

    float sum = 0.0;

    for (int k = 0; k < ${ MAX_PEARLS }; k++) {
      if (float(k) >= uPearlCount) { break; }

      float dy = (y - uPearlY[k]) / uDeformWidth;

      sum += exp(-dy * dy);
    }

    return sum;
  }

  // braidRadius along the axis: v2's travelling pulse, multiplied by the pearl
  // reaction — bulge (deform > 0) or pinch (deform < 0). The clamp keeps a
  // strong pinch from folding the radius negative (pipes stop at the axis).
  float braidRadiusAt(float y) {
    float pulse = 1.0 + uRadiusPulse * sin(y * uPulseFreq + uT * uPulseSpeed);
    float react = max(1.0 + uDeform * pearlInfluence(y), 0.0);

    return uBraidRadius * pulse * react;
  }

  // Signed distance to the braid: untwist space, then union N straight tubes.
  float mapPipes(vec3 p) {
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

    // Conservative bound for the twisted + deformed metric (see header).
    return best / uTwistLipschitz;
  }

  // Exact distance to the nearest pearl (spheres on the braid axis).
  float mapPearls(vec3 p) {
    float best = 1e9;

    for (int k = 0; k < ${ MAX_PEARLS }; k++) {
      if (float(k) >= uPearlCount) { break; }

      best = min(best, length(p - vec3(0.0, uPearlY[k], 0.0)) - uPearlRadius);
    }

    return best;
  }

  // Which pearl owns this point — recomputed once at the hit for its hue.
  float nearestPearl(vec3 p) {
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PEARLS }; k++) {
      if (float(k) >= uPearlCount) { break; }

      float d = length(p - vec3(0.0, uPearlY[k], 0.0));

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  float mapScene(vec3 p) {
    return min(mapPipes(p), mapPearls(p));
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

    // Step-starved rays: where one pipe presses onto another (or a strong
    // deformation inflates the Lipschitz divisor), a ray creeping along the
    // contact crease runs out of iterations without ever crossing SURF_EPS —
    // classically leaving a dark "invisible contour" along the overlap. Accept
    // ONLY rays that ended their budget still glued to the surface (final d a
    // hair above the hit threshold): their end point is on the crease, so its
    // normal and colour are sound. Rays that merely grazed something and flew
    // past (escaped, or stalled mid-gap with a larger d) must stay background —
    // shading those instead paints ghost membranes across every gap.
    if (!hit && !escaped && d < SURF_EPS * 4.0) {
      hit = true;
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

    vec3 rd = normalize(fwd * uFocal + right * uv.x + up * uv.y);

    gl_FragColor = traceRay(ro, rd);
  }
`;

const pearls = createNoiseFieldRenderer( FRAGMENT );

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

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const timeScale = o.timeScale ?? 1;

  // ── Loop-exact clock ──────────────────────────────────────────────────────
  // animation.angle sweeps exactly TAU per loop, so the loop seam is invisible
  // only when every time-driven rate completes a WHOLE number of cycles per
  // loop. Each raw slider rate (× time scale) is therefore rounded to whole
  // cycles below — including the pearls' falls.
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
  // Each pearl falls the whole travel span once per fall, staggered in phase
  // so N pearls thread the funnel evenly. The gravity slider eases each fall
  // from linear (0) toward accelerating (1); the shaping fixes u = 0 → 0 and
  // u = 1 → 1, so the wrap back to the top always lands on the loop seam.
  // Negative fall speed reverses the direction (pearls rise).
  const pearlCount = Math.min(
    pearl.count ?? 1,
    MAX_PEARLS
  );
  const fallCycles = Math.round( ( pearl.speed ?? 1 ) * timeScale );
  const gravity = pearl.gravity ?? 0.35;
  const span = pearl.span ?? 6;
  const pearlRadius = pearl.size ?? 0.34;
  const deform = pearl.deform ?? 0.6;
  const deformWidth = Math.max(
    pearl.deformRadius ?? 0.9,
    0.05
  );

  const pearlY = new Float32Array( MAX_PEARLS );

  for ( let k = 0; k < pearlCount; k++ ) {
    const raw = ( t / p.TAU ) * fallCycles + k / pearlCount;
    const u = ( ( raw % 1 ) + 1 ) % 1;
    const shaped = u + gravity * ( u * u - u );

    pearlY[ k ] = span * ( 0.5 - shaped );
  }

  // Conservative Lipschitz bound for the twisted + deformed field. Relative to
  // v2: the radial term uses the worst-case bulged radius (every Gaussian at
  // its peak), and the axial slope adds the pulse's slope times that bulge
  // plus the Gaussians' own maximum slope (√(2/e)/reach each, summed as if
  // all pearls overlapped). A 10% margin keeps the march from overshooting.
  const bulgeMax = 1 + Math.max(
    deform,
    0
  ) * pearlCount;
  const maxR = braidRadius * ( 1 + radiusPulse ) * bulgeMax + pipeRadius;
  const gaussSlope = Math.sqrt( 2 / Math.E ) / deformWidth;
  const pulseSlope = braidRadius * (
    radiusPulse * pulseFreq * bulgeMax
    + ( 1 + radiusPulse ) * Math.abs( deform ) * pearlCount * gaussSlope
  );
  const twistLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope ) ** 2 ) * 1.1;

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

  pearls.render( {
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
      uTwistLipschitz: twistLipschitz,
      uPearlCount: pearlCount,
      uPearlY: {
        floatv: pearlY
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
      uMaxDist: camDist + 10
    }
  } );
} );
