import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import audio from "@/p5/utils/audio.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// dragon-corridor v2 — "threading the needle". Same legless, wingless dragon
// (a flying snake) as v1, same one-full-screen-raymarch construction, but the
// corridor and its obstacles change character:
//
//   • Obstacles — each wall now covers the ENTIRE corridor cross-section,
//     pierced by one round HOLE at a seed-random position. The dragon no longer
//     dodges into an open half: it aims for the hole and threads through it,
//     wall after wall. Hole centres are hashed on the CPU from a seed (uniform
//     over a disc, so they scatter naturally) and uploaded as a vec2 uniform
//     array — the shader, the weave path and the FPV camera all read the very
//     same values, so they can never disagree.
//
//   • Corridor shape — a "roundness" uniform blends the cross-section metric
//     from Chebyshev (square tube, exactly v1) to Euclidean (a circular
//     tunnel). It is a plain 0…1 slider, safe to animate or drive through the
//     interaction-binding system: every consumer (wall SDF, pane clipping,
//     camera clamp) uses the same blended metric.
//
//   • Undulation — the whole tube can snake left/right and up/down instead of
//     running straight: the corridor centreline is offset by per-axis sine
//     waves of s = z − scroll. One "undulation" amplitude slider (0 = dead
//     straight) plus whole-wave counts per axis and an axis phase. Everything
//     that lives in the corridor (walls, panes, holes, dragon, camera) rides
//     the same centreline, and the camera banks through the bends.
//
//   • The dragon's perpetual swim sway now PINCHES at every wall plane
//     (uSwimDip): the body gathers itself, slips through the hole dead-centre,
//     then breathes again in the open stretch — obstacle-course body language.
//
//   • The hole-to-hole path is a cubic Hermite spline with Catmull-Rom
//     tangents scaled by a "flow" option: at 0 the body stalls on each hole
//     then darts (v1-style hesitation), at 1 it sweeps through every hole at
//     an angle with continuous velocity — no fold in the body, no whip in the
//     FPV camera.
//
// ── Looping ──────────────────────────────────────────────────────────────────
// Identical bookkeeping to v1: everything spatial is a function of
// s = z − scroll, periodic in s with period L = SEG · PERIOD (hole pattern,
// weave, swim, undulation, ribs and pane placement all inherit it). scroll
// advances by exactly ±L per loop, undulation wave counts are whole waves per
// L, and every time-driven rate is snapped to whole cycles per loop, so the
// last frame reproduces the first.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 8; // matches the "pipes" slider max (braid bundle size)
const MAX_STEPS = 130; // sphere-trace iterations per ray
const SURF_EPS = 0.001; // hit threshold (world units)
const SEG = 3.2; // spacing between pierced walls (world units, in s)
const HALF = 1.0; // corridor half-size (walls at cross-distance = HALF)
const MAX_DIST = 34.0; // ray cutoff / far plane
const N_PANES = 14; // pierced walls scanned per ray (≈ MAX_DIST / SEG + margin)
const MAX_PERIOD = 16; // max wall segments per loop (uHoles array size)
const TAIL_LEN = 18.0; // world units over which the tail-thinning acts

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) };
  const float SEG      = ${ SEG.toFixed( 4 ) };
  const float HALF     = ${ HALF.toFixed( 4 ) };
  const float MAX_DIST = ${ MAX_DIST.toFixed( 4 ) };

  uniform float uScroll;      // how far the corridor content has streamed (signed)
  uniform float uPeriod;      // wall segments per loop (pattern period)
  uniform vec2  uHoles[${ MAX_PERIOD }]; // hole centre per segment (tube-relative)
  uniform float uHoleRadius;  // radius of the passage in every wall

  // ── Corridor geometry ──
  uniform float uRoundness;   // cross-section: 0 = square tube, 1 = round tunnel
  uniform vec2  uWaveAmp;     // undulation amplitude per axis (0 = straight)
  uniform vec2  uWaveFreq;    // undulation spatial freq (whole waves per loop)
  uniform float uWavePhase;   // y-axis undulation phase offset
  uniform float uCorridorLipschitz; // safety divisor for the sheared tube SDF

  // ── Dragon braid ──
  uniform float uPipeCount;
  uniform float uPipeRadius;
  uniform float uBraidRadius;
  uniform float uTwist;           // helix winding rate along z
  uniform float uSpin;            // braid rotation over time (whole turns/loop)
  uniform float uRadiusPulse;     // travelling swell of the braid radius
  uniform float uPulseFreq;       // spatial frequency of the swell (whole waves/loop)
  uniform float uPulseT;          // swell travel phase (whole cycles/loop)
  uniform float uHeadZ;           // world z of the head plane (in front of the camera)
  uniform float uHeadRound;       // fillet radius where the body meets the head cap
  uniform float uHeadMerge;       // length over which the braid unwinds into the head
  uniform float uTailThin;        // how much the body thins toward the far tail
  uniform float uDragonLipschitz; // CPU-computed safety divisor for the march

  // ── Swim (perpetual serpentine sway, pinched at every wall plane) ──
  uniform vec2  uSwimAmp;         // lateral sway amplitude (x, y)
  uniform float uSwimFreq;        // spatial frequency (whole waves per loop)
  uniform float uSwimT;           // travel phase (whole cycles per loop)
  uniform float uSwimAxisPhase;   // y-axis phase offset (0 = in phase, π/2 = circling)
  uniform float uSwimDip;         // how completely the sway pauses at each wall

  // ── Threading behaviour ──
  uniform float uDodgeHold;       // fraction of a segment to hold before darting
  uniform float uDodgeSharp;      // commit curve exponent (higher = later, snappier)
  uniform float uBunch;           // body accumulation while threading a hole
  uniform float uFlow;            // 0 = eased dart between holes, 1 = flowing spline

  // ── Camera ──
  uniform vec3  uCamPos;
  uniform float uFocal;
  uniform float uPitch;
  uniform float uYaw;
  uniform float uRoll;            // FPV banking

  // ── Iridescent palette (shared vocabulary with flowers-shaders v2) ──
  uniform float uHueSpeed;        // pre-scaled scroll phase (whole palette periods/loop)
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uLengthHueShift;  // CPU-quantised to whole palette periods per loop
  uniform float uPipeHueShift;
  uniform float uShimmer;
  uniform float uSaturation;
  uniform float uBrightness;

  // ── Lighting ──
  uniform vec3  uLightDir;
  uniform float uAmbient;
  uniform float uDiffuse;
  uniform float uSpecular;
  uniform float uSpecPower;
  uniform float uFresnelPower;
  uniform float uRimStrength;

  // ── Corridor + glass + fog ──
  uniform vec3  uWallColor;
  uniform float uWallGlow;        // brightness of the wall-plane markers
  uniform float uRibFreq;         // wall rib spatial frequency (0 = plain walls)
  uniform vec3  uGlassColor;
  uniform float uGlassAlpha;      // straight-through opacity of one wall
  uniform float uGlassThickness;  // wall thickness (world units)
  uniform float uGlassEdge;       // half-width of the hole rim (small = sharp)
  uniform float uGlassFrost;      // Perlin frost mottling amount
  uniform float uFrostScale;      // frost noise scale
  uniform float uGlassMilk;       // pulls the tint toward white scatter
  uniform float uGlassTint;       // how much each wall borrows the iridescent hue
  uniform float uEdgeGlow;        // bright seam ringing the hole
  uniform float uFogDensity;
  uniform vec3  uBgColor;

  // Oil-slick / thin-film iridescence — identical palette to flowers-shaders v2.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // Corridor centreline offset at scroll-coord s — the undulation. Whole waves
  // per loop on each axis keep it loop-periodic.
  vec2 corridorCentre(float s) {
    return uWaveAmp * vec2(
      sin(s * uWaveFreq.x),
      sin(s * uWaveFreq.y + uWavePhase)
    );
  }

  // Cross-section "radius": Chebyshev (square, exactly v1) blended toward
  // Euclidean (round tunnel) by uRoundness. Both metrics are 1-Lipschitz, so
  // any blend is too — safe to animate.
  float crossDist(vec2 q) {
    return mix(max(abs(q.x), abs(q.y)), length(q), uRoundness);
  }

  // Hole centre for a segment, read from the CPU-computed pattern. Uniform
  // arrays need constant indices in WebGL1 fragment shaders, hence the loop.
  vec2 holeAt(float seg) {
    int mi = int(mod(seg, uPeriod) + 0.5);
    vec2 h = vec2(0.0);

    for (int i = 0; i < ${ MAX_PERIOD }; i++) {
      if (i == mi) { h = uHoles[i]; }
    }

    return h;
  }

  // Hesitating commit curve: hold position for uDodgeHold of the segment, then
  // ease over with a uDodgeSharp-powered smoothstep — the "aiming before the
  // strike" body language.
  float transitionShape(float u) {
    float w = clamp((u - uDodgeHold) / max(1.0 - uDodgeHold, 0.001), 0.0, 1.0);

    w = pow(w, uDodgeSharp);

    return w * w * (3.0 - 2.0 * w);
  }

  // Dragon centreline at scroll-coord s: hole-to-hole weave riding the
  // undulating tube, plus the swim sway pinched at each wall plane so the
  // body threads the hole dead-centre. activity peaks mid-transition and
  // drives the body bunching.
  //
  // The path is a cubic Hermite through the hole centres with Catmull-Rom
  // tangents scaled by uFlow. At uFlow = 0 the tangents vanish and the eased
  // dart takes over (the body stalls on each hole, then darts — v1 body
  // language); at 1 the parameter is linear and the spline crosses every hole
  // AT AN ANGLE with continuous velocity, so the body never folds in two and
  // the FPV camera never whips at a wall plane.
  void weaveInfo(float s, out vec2 centre, out float activity) {
    float f = s / SEG;
    float n0 = floor(f);
    float u = f - n0;
    float w = mix(transitionShape(u), u, uFlow);

    int iPrev = int(mod(n0 - 1.0, uPeriod) + 0.5);
    int i0 = int(mod(n0, uPeriod) + 0.5);
    int i1 = int(mod(n0 + 1.0, uPeriod) + 0.5);
    int iNext = int(mod(n0 + 2.0, uPeriod) + 0.5);
    vec2 hPrev = vec2(0.0);
    vec2 h0 = vec2(0.0);
    vec2 h1 = vec2(0.0);
    vec2 hNext = vec2(0.0);

    for (int i = 0; i < ${ MAX_PERIOD }; i++) {
      if (i == iPrev) { hPrev = uHoles[i]; }
      if (i == i0) { h0 = uHoles[i]; }
      if (i == i1) { h1 = uHoles[i]; }
      if (i == iNext) { hNext = uHoles[i]; }
    }

    vec2 m0 = 0.5 * uFlow * (h1 - hPrev);
    vec2 m1 = 0.5 * uFlow * (hNext - h0);

    float w2 = w * w;
    float w3 = w2 * w;

    // sin²(πu) is 0 at every wall plane with zero slope, so the sway pause is
    // C¹ across segments and vanishes exactly where the hole must be threaded.
    float win = sin(PI * u);
    float dip = mix(1.0, win * win, uSwimDip);

    centre = h0 * (2.0 * w3 - 3.0 * w2 + 1.0)
      + m0 * (w3 - 2.0 * w2 + w)
      + h1 * (-2.0 * w3 + 3.0 * w2)
      + m1 * (w3 - w2)
      + corridorCentre(s);
    centre += dip * vec2(
      uSwimAmp.x * sin(s * uSwimFreq + uSwimT),
      uSwimAmp.y * sin(s * uSwimFreq + uSwimT + uSwimAxisPhase)
    );

    activity = 4.0 * w * (1.0 - w);
  }

  // Smooth intersection (iq): fillets the corner where the tube meets its cap.
  float smoothMax(float a, float b, float k) {
    float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) + k * h * (1.0 - h);
  }

  // Shared body radii so the SDF, the pipe picker and the shading always agree.
  float mergeAt(float z) {
    return smoothstep(uHeadZ, uHeadZ - uHeadMerge, z);
  }

  float tailAt(float z) {
    return 1.0 - uTailThin * clamp((uHeadZ - z) / ${ TAIL_LEN.toFixed( 1 ) }, 0.0, 1.0);
  }

  // ── Dragon SDF: untwist space, then union N straight tubes about the weave. ──
  // The infinite braid is capped at uHeadZ with a rounded intersection so the
  // dragon terminates in a blunt head pointing at the camera; the body recedes
  // down the corridor, thinning toward the tail, and bunches up mid-thread.
  float mapDragon(vec3 p) {
    float s = p.z - uScroll;
    vec2  centre;
    float activity;

    weaveInfo(s, centre, activity);

    vec2 rel = p.xy - centre;

    float phi = p.z * uTwist + uSpin;
    float c = cos(phi);
    float sn = sin(phi);
    vec2  q = vec2(c * rel.x - sn * rel.y, sn * rel.x + c * rel.y);

    // Bunching fattens the PIPES (mass gathering for the squeeze); the braid
    // orbit grows only slightly, so the tubes swell together instead of
    // splaying apart.
    float tail = tailAt(p.z);
    float swell = 1.0 + uRadiusPulse * sin(s * uPulseFreq + uPulseT);
    float br = uBraidRadius * mergeAt(p.z) * swell * (1.0 + 0.25 * uBunch * activity) * tail;
    float pr = uPipeRadius * tail * (1.0 + uBunch * activity);
    float best = 1e9;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  pc = br * vec2(cos(a), sin(a));
      float d = length(q - pc) - pr;

      best = min(best, d);
    }

    // Cap: keep only the body behind the head plane (z < uHeadZ), rounded.
    float capped = smoothMax(best, p.z - uHeadZ, uHeadRound);

    return capped / uDragonLipschitz;
  }

  // Which pipe owns a point — recomputed at the hit for colour banding. Uses the
  // same braid radius as the SDF so the ownership bands land on the geometry.
  float nearestPipe(vec3 p) {
    float s = p.z - uScroll;
    vec2  centre;
    float activity;

    weaveInfo(s, centre, activity);

    vec2 rel = p.xy - centre;

    float phi = p.z * uTwist + uSpin;
    float c = cos(phi);
    float sn = sin(phi);
    vec2  q = vec2(c * rel.x - sn * rel.y, sn * rel.x + c * rel.y);

    float swell = 1.0 + uRadiusPulse * sin(s * uPulseFreq + uPulseT);
    float br = uBraidRadius * mergeAt(p.z) * swell * (1.0 + 0.25 * uBunch * activity) * tailAt(p.z);
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  pc = br * vec2(cos(a), sin(a));
      float d = length(q - pc);

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  // Distance to the inside of the (possibly round, possibly undulating) tube
  // (0 at the wall, grows inward). The undulation shears the SDF along z, so
  // the CPU-computed Lipschitz divisor keeps the march conservative.
  float mapCorridor(vec3 p) {
    vec2 q = p.xy - corridorCentre(p.z - uScroll);

    return (HALF - crossDist(q)) / uCorridorLipschitz;
  }

  // The opaque scene the ray stops on: dragon ∪ corridor walls.
  float mapScene(vec3 p) {
    return min(mapDragon(p), mapCorridor(p));
  }

  // 4-tap tetrahedron normal.
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

  // Cheap AO — a few short steps along the normal.
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

  // Iridescent wet-tube shading for the dragon body. The per-pipe hue offset
  // fades out with the braid merge so the colours flow seamlessly into the head
  // instead of meeting in bands.
  vec3 shadeDragon(vec3 pos, vec3 n, vec3 rd) {
    float k = nearestPipe(pos);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);

    float phase = (pos.z - uScroll) * uLengthHueShift
      + uHueSpeed
      + k * uPipeHueShift * mergeAt(pos.z);

    vec3 base = iridescent(phase + uShimmer * fres);

    float diff = max(dot(n, uLightDir), 0.0);
    vec3  hlf = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = calcAO(pos, n);

    vec3 col = base * (uAmbient + uDiffuse * diff * ao);
    col += base * fres * uRimStrength;
    col += vec3(spec) * ao;

    return col;
  }

  // Corridor wall shading — streams with s so the tunnel reads as motion, and
  // lights up with a coloured band at every wall plane, tinted by the hole's
  // angular position so the tunnel telegraphs where the next passage is.
  vec3 shadeWall(vec3 pos, vec3 n, vec3 rd) {
    float s = pos.z - uScroll;
    vec2 rel = pos.xy - corridorCentre(s);

    // Longitudinal ribs that flow through the tunnel (0 frequency = plain wall).
    float rib = 0.5 + 0.5 * cos(s * uRibFreq);
    float ribShade = mix(0.55, 1.0, pow(rib, 3.0));

    // Corner accents only exist on the square tube — they fade out with
    // roundness as the cross-section loses its corners.
    float across = max(abs(rel.x), abs(rel.y));
    float corner = smoothstep(HALF * 0.82, HALF * 0.995, across) * (1.0 - uRoundness);

    vec3 base = uWallColor * ribShade;
    base += uWallColor * corner * 0.6;

    float seg = floor(s / SEG + 0.5);
    float planeS = seg * SEG;
    float band = exp(-abs(s - planeS) * 6.0);
    vec2 h = holeAt(seg);
    vec3 marker = iridescent(atan(h.y, h.x + 1e-4) * 0.159 + 0.1);

    base += marker * band * uWallGlow;

    // Gentle diffuse so the tube has some form.
    float diff = max(dot(n, uLightDir), 0.0);

    return base * (0.65 + 0.35 * diff);
  }

  // Sphere-trace the opaque scene. Returns colour in .rgb and hit distance in .a
  // (MAX_DIST if the ray escaped through the vanishing point).
  vec4 traceOpaque(vec3 ro, vec3 rd) {
    float t = 0.0;
    bool  hit = false;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
      vec3  pos = ro + rd * t;
      float d = mapScene(pos);

      if (d < SURF_EPS) { hit = true; break; }

      t += d;

      if (t > MAX_DIST) { break; }
    }

    if (!hit) { return vec4(uBgColor, MAX_DIST); }

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);

    // Closer of the two fields decides the material.
    vec3 col = mapDragon(pos) < mapCorridor(pos)
      ? shadeDragon(pos, n, rd)
      : shadeWall(pos, n, rd);

    float fog = exp(-uFogDensity * t);

    return vec4(mix(uBgColor, col, fog), t);
  }

  // Analytic pierced walls: walk the panes front-to-back, clip the ray's span
  // inside each slab, and turn the traversed path length into a Beer–Lambert
  // opacity. Each pane covers the whole cross-section except a round hole —
  // coverage goes to zero inside the passage, so the tunnel stays flyable.
  vec4 glassLayer(vec3 ro, vec3 rd, float tHit) {
    vec3 acc = vec3(0.0);
    float trans = 1.0;

    // First slab index at/behind the camera, then walk deeper each step (panes
    // behind the camera fall out through the t-span clip).
    float nStart = floor((ro.z - uScroll) / SEG) + 1.0;
    float halfTh = 0.5 * max(uGlassThickness, 0.02);

    // Straight-through opacity uGlassAlpha → extinction per unit path.
    float extinction = -log(1.0 - min(uGlassAlpha, 0.97)) / (2.0 * halfTh);

    for (int i = 0; i < ${ N_PANES }; i++) {
      float seg = nStart - float(i);
      float planeS = seg * SEG;
      float zc = planeS + uScroll;

      float tA = (zc + halfTh - ro.z) / rd.z;
      float tB = (zc - halfTh - ro.z) / rd.z;
      float t0 = max(min(tA, tB), 0.0);
      float t1 = min(max(tA, tB), tHit);

      if (t1 <= t0) { continue; }

      vec3 hp = ro + rd * (0.5 * (t0 + t1));

      // Tube-relative position at the wall plane — the pane (and its hole)
      // rides the undulating centreline with everything else.
      vec2 rel = hp.xy - corridorCentre(planeS);

      // Inside the corridor cross-section? (roundness-aware)
      float inside = 1.0 - smoothstep(HALF * 0.9, HALF, crossDist(rel));

      if (inside <= 0.001) { continue; }

      // Coverage: full wall minus the round passage. uGlassEdge sets the rim
      // softness: small = razor-sharp hole edge, large = feathered.
      float edge = max(uGlassEdge, 0.002);
      float cover = smoothstep(
        uHoleRadius - edge,
        uHoleRadius + edge,
        length(rel - holeAt(seg))
      );

      // Path length through the slab → physical opacity.
      float a = (1.0 - exp(-extinction * (t1 - t0))) * cover * inside;

      // Frost mottling: a fixed Perlin pattern per pane (m is loop-periodic).
      float m = mod(seg, uPeriod);

      if (uGlassFrost > 0.001) {
        float frost = perlinNoise(vec3(hp.xy * uFrostScale, m * 7.31));

        a *= mix(1.0, clamp(0.35 + 1.4 * frost, 0.0, 1.2), uGlassFrost);
      }

      if (a <= 0.001) { continue; }

      // Milky scatter pulls the tint toward white; iridescence borrows the
      // dragon's palette per pane (loop-periodic index).
      vec3 tint = mix(uGlassColor, iridescent(m * 0.23 + 0.11), uGlassTint);
      tint = mix(tint, vec3(1.0), uGlassMilk);

      // Grazing view brightens the frost; the bright seam now RINGS the hole
      // (cover crosses 0.5 exactly on the rim), haloing every passage.
      float grazing = 1.0 - abs(rd.z);
      float seam = exp(-abs(cover - 0.5) * 9.0) * uEdgeGlow;

      vec3 paneCol = tint * (0.7 + 0.6 * grazing) + tint * seam;

      // Fog attenuates the pane's colour AND its opacity — far walls melt into
      // the depth instead of stacking up into a white column that would hide
      // the vanishing point.
      float fog = exp(-uFogDensity * (0.5 * (t0 + t1)));

      paneCol = mix(uBgColor, paneCol, fog);
      a = clamp(a * (0.85 + 0.5 * grazing) * fog, 0.0, 0.97);

      acc += trans * a * paneCol;
      trans *= (1.0 - a);
    }

    return vec4(acc, trans);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    // Forward-looking corridor camera; yaw/pitch aim it, roll banks it (FPV).
    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float cy = cos(uYaw);
    float sy = sin(uYaw);

    vec3 ro = uCamPos;
    vec3 fwd = normalize(vec3(cp * sy, sp, -cp * cy));
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);

    float cr = cos(uRoll);
    float sr = sin(uRoll);
    vec3 rollRight = right * cr + up * sr;
    vec3 rollUp = up * cr - right * sr;

    vec3 rd = normalize(fwd * uFocal + rollRight * uv.x + rollUp * uv.y);

    vec4 opaque = traceOpaque(ro, rd);
    vec4 glass = glassLayer(ro, rd, opaque.a);

    vec3 col = glass.rgb + glass.a * opaque.rgb;

    // Alpha: opaque scene (dragon + walls) is always solid; only the escaped
    // vanishing-point ray with no glass in front stays fully transparent so the
    // p5 background shows through as the deepest point of the tunnel.
    float opaqueSolid = opaque.a < MAX_DIST ? 1.0 : 0.0;
    float alpha = (1.0 - glass.a) + glass.a * opaqueSolid;

    gl_FragColor = vec4(col, alpha);
  }
`;

const scene = createNoiseFieldRenderer( FRAGMENT );

// ── CPU mirror of the dragon path ─────────────────────────────────────────────
// The FPV camera needs the exact weave the shader renders, so the hole pattern
// is generated here (from a seed) and shared with the GPU as a vec2 uniform
// array, and the path maths below mirrors weaveInfo() above.

// One hole centre per segment, hashed from the seed: uniform over a disc of
// radius maxOffset (√ for area-uniformity), so the passages scatter naturally
// around the tube without ever breaching the wall.
function buildHoles(
  period, seed, maxOffset
) {
  const holes = [];

  for ( let i = 0; i < MAX_PERIOD; i++ ) {
    const n = ( i % period ) * 1.61803 + seed * 0.7317 + 3.7;
    const h1 = Math.sin( n * 12.9898 ) * 43758.5453;
    const h2 = Math.sin( n * 78.233 + 1.37 ) * 24634.6345;
    const angle = ( h1 - Math.floor( h1 ) ) * Math.PI * 2;
    const radius = Math.sqrt( h2 - Math.floor( h2 ) ) * maxOffset;

    holes.push( [
      radius * Math.cos( angle ),
      radius * Math.sin( angle )
    ] );
  }

  return holes;
}

// Camera position along the corridor, in wall units, from the previous frame —
// crossing an integer means a pierced wall just swept past the camera plane.
let lastWallU = null;

// Index of the last fired hum grain. The dragon's constant hum is a bed of
// overlapping drone grains fired at a fixed count per loop, so it loops
// seamlessly, pauses with the animation, and records deterministically.
let lastGrainIndex = null;

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const corridor = o.corridor ?? {};
  const dragon = o.dragon ?? {};
  const motion = o.motion ?? {};
  const dodge = o.dodge ?? {};
  const obstacles = o.obstacles ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const sound = o.sound ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    4,
    4,
    10
  ] ) );

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;

  // ── Loop-exact clock ───────────────────────────────────────────────────────
  // One loop scrolls the corridor by exactly PERIOD segments (signed by the
  // direction option) and the hole pattern repeats with that period, so the
  // seam is invisible. Time rates are snapped to whole cycles per loop.
  const period = Math.min(
    MAX_PERIOD,
    Math.max(
      1,
      Math.round( obstacles.segmentsPerLoop ?? 5 )
    )
  );
  const loopLength = SEG * period;
  const direction = ( motion.direction ?? "backward" ) === "forward" ? 1 : -1;
  const scroll = direction * animation.progression * loopLength;

  // ── Holes ──────────────────────────────────────────────────────────────────
  // The passage must fit inside the cross-section wherever it lands, so the
  // centre offset is capped at HALF − holeRadius (minus a hair of wall) and
  // scaled by the spread option. A disc cap is valid for both the round AND
  // the square cross-section (the disc inscribes the square).
  const holeRadius = obstacles.holeRadius ?? 0.36;
  const holeSpread = obstacles.holeSpread ?? 0.6;
  const maxHoleOffset = Math.max(
    0,
    HALF - holeRadius - 0.06
  ) * holeSpread;
  const holes = buildHoles(
    period,
    Math.round( obstacles.seed ?? 7 ),
    maxHoleOffset
  );

  // ── Corridor shape ─────────────────────────────────────────────────────────
  // Roundness is a plain 0…1 value — bindable/animatable. Undulation is one
  // amplitude with whole-wave counts per axis (0 waves disables an axis
  // entirely so no constant offset sneaks in through the phase).
  const roundness = Math.min(
    Math.max(
      corridor.roundness ?? 1,
      0
    ),
    1
  );
  const undulation = corridor.undulation ?? 0.3;
  const wavesXInt = Math.max(
    0,
    Math.round( corridor.wavesX ?? 1 )
  );
  const wavesYInt = Math.max(
    0,
    Math.round( corridor.wavesY ?? 1 )
  );
  const wavePhase = corridor.wavePhase ?? 1.57;
  const waveFreqX = ( p.TAU * wavesXInt ) / loopLength;
  const waveFreqY = ( p.TAU * wavesYInt ) / loopLength;
  const waveAmpX = wavesXInt > 0 ? undulation : 0;
  const waveAmpY = wavesYInt > 0 ? undulation : 0;

  const spinTurns = Math.round( ( dragon.spin ?? 0 ) * timeScale );
  const pulseWavesInt = Math.max(
    1,
    Math.round( dragon.pulseWaves ?? 3 )
  );
  const pulseTravelInt = Math.round( ( dragon.pulseTravel ?? 2 ) * timeScale );

  // Spatial frequencies chosen so travelling waves pack a whole number of
  // cycles into one loop length — keeps sin( s · freq + t · k ) seamless.
  const pulseFreq = ( p.TAU * pulseWavesInt ) / loopLength;

  const swimWavesInt = Math.max(
    1,
    Math.round( motion.swimWaves ?? 2 )
  );
  const swimFreq = ( p.TAU * swimWavesInt ) / loopLength;
  const swimCycles = Math.round( ( motion.swimSpeed ?? 1 ) * timeScale );
  const swimT = t * swimCycles;
  const swimAmpX = motion.swimX ?? 0.11;
  const swimAmpY = motion.swimY ?? 0.08;
  const swimAxisPhase = motion.swimPhase ?? 1.7;
  const swimDip = Math.min(
    Math.max(
      motion.swimDip ?? 0.7,
      0
    ),
    1
  );

  const pipeCount = Math.min(
    dragon.pipeCount ?? 3,
    MAX_PIPES
  );
  const pipeRadius = dragon.pipeRadius ?? 0.09;
  const braidRadius = dragon.braidRadius ?? 0.13;
  const twist = dragon.twist ?? 0.8;
  const radiusPulse = dragon.radiusPulse ?? 0.35;
  const tailThin = dragon.tailThin ?? 0.3;

  const dodgeHold = Math.min(
    dodge.hesitation ?? 0.25,
    0.9
  );
  const dodgeSharp = dodge.sharpness ?? 1.6;
  const bunch = dodge.bunch ?? 0.5;
  const flow = Math.min(
    Math.max(
      dodge.flow ?? 0.8,
      0
    ),
    1
  );

  // Conservative Lipschitz divisor for the marched dragon field. The radial
  // gradient is amplified by the helix winding (maxR·twist), the travelling
  // pulse slope, the hole-to-hole weave slope (steepened by the hesitation
  // squeezing the dart into (1 − hold) of a segment), the swim sway (including
  // the dip window's own slope), the tube undulation and the bunching swell.
  const transRate = ( 2 * Math.max(
    1,
    dodgeSharp
  ) ) / Math.max(
    1 - dodgeHold,
    0.15
  );
  const maxR = braidRadius * ( 1 + radiusPulse ) * ( 1 + 0.25 * bunch )
    + pipeRadius * ( 1 + bunch );
  const pulseSlope = braidRadius * radiusPulse * pulseFreq;
  const waveSlope = waveAmpX * waveFreqX + waveAmpY * waveFreqY;

  // Hermite slope bound: |dP/dw| ≤ (3 + 2·flow)·maxOffset (basis extrema plus
  // the two flow-scaled tangents) and |dw/du| ≤ (1 − flow)·transRate + flow.
  const paramRate = Math.max(
    ( 1 - flow ) * transRate + flow,
    1
  );
  const weaveSlope = ( ( 3 + 2 * flow ) * maxHoleOffset * paramRate ) / SEG
    + ( swimAmpX + swimAmpY ) * ( swimFreq + ( Math.PI / SEG ) * swimDip )
    + waveSlope;
  const bunchSlope = ( ( 0.25 * braidRadius * ( 1 + radiusPulse ) + pipeRadius )
    * bunch * 4 * transRate ) / SEG;
  const dragonLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope + weaveSlope + bunchSlope ) ** 2 ) * 1.25;

  // The undulation shears the tube SDF along z; crossDist itself stays
  // 1-Lipschitz in xy for any roundness, so only the centreline slope matters.
  const corridorLipschitz = Math.sqrt( 1 + waveSlope ** 2 ) * 1.1;

  const fov = camera.fov ?? 62;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );

  // The head sits a fixed gap in front of the camera, weaving with the body; the
  // braid unwinds into a single rounded head over headMerge world units.
  const camZ = camera.z ?? 2.5;
  const headZ = camZ - ( dragon.headGap ?? 1.9 );
  const headRound = dragon.headRound ?? 0.1;
  const headMerge = dragon.headMerge ?? 1;

  // ── CPU weave mirror (drives the FPV camera) ───────────────────────────────
  const transitionShape = ( u ) => {
    const w = Math.min(
      Math.max(
        ( u - dodgeHold ) / Math.max(
          1 - dodgeHold,
          0.001
        ),
        0
      ),
      1
    );
    const pw = Math.pow(
      w,
      dodgeSharp
    );

    return pw * pw * ( 3 - 2 * pw );
  };

  const corridorCentreAt = ( s ) => [
    waveAmpX * Math.sin( s * waveFreqX ),
    waveAmpY * Math.sin( s * waveFreqY + wavePhase )
  ];

  const weaveAt = ( s ) => {
    const f = s / SEG;
    const n0 = Math.floor( f );
    const u = f - n0;
    const w = transitionShape( u ) * ( 1 - flow ) + u * flow;
    const iPrev = ( ( ( n0 - 1 ) % period ) + period ) % period;
    const i0 = ( ( n0 % period ) + period ) % period;
    const i1 = ( ( ( n0 + 1 ) % period ) + period ) % period;
    const iNext = ( ( ( n0 + 2 ) % period ) + period ) % period;
    const hPrev = holes[ iPrev ];
    const a = holes[ i0 ];
    const b = holes[ i1 ];
    const hNext = holes[ iNext ];
    const w2 = w * w;
    const w3 = w2 * w;
    const b00 = 2 * w3 - 3 * w2 + 1;
    const b10 = w3 - 2 * w2 + w;
    const b01 = -2 * w3 + 3 * w2;
    const b11 = w3 - w2;
    const win = Math.sin( Math.PI * u );
    const dip = 1 + swimDip * ( win * win - 1 );
    const cc = corridorCentreAt( s );

    return [
      a[ 0 ] * b00 + 0.5 * flow * ( b[ 0 ] - hPrev[ 0 ] ) * b10
        + b[ 0 ] * b01 + 0.5 * flow * ( hNext[ 0 ] - a[ 0 ] ) * b11
        + cc[ 0 ] + dip * swimAmpX * Math.sin( s * swimFreq + swimT ),
      a[ 1 ] * b00 + 0.5 * flow * ( b[ 1 ] - hPrev[ 1 ] ) * b10
        + b[ 1 ] * b01 + 0.5 * flow * ( hNext[ 1 ] - a[ 1 ] ) * b11
        + cc[ 1 ] + dip * swimAmpY * Math.sin( s * swimFreq + swimT + swimAxisPhase )
    ];
  };

  // FPV: follow the (box-filtered) path, aim at the head, bank into turns.
  const fpvFollow = camera.fpvFollow ?? 0;
  const fpvAim = camera.fpvAim ?? 0;
  const fpvBank = camera.fpvBank ?? 0;
  const fpvSmooth = ( camera.fpvSmooth ?? 0.5 ) * SEG * 0.6;

  const camS = camZ - scroll;
  const camCentre = corridorCentreAt( camS );
  const w0 = weaveAt( camS - fpvSmooth );
  const w1 = weaveAt( camS );
  const w2 = weaveAt( camS + fpvSmooth );
  const followX = ( w0[ 0 ] + w1[ 0 ] + w2[ 0 ] ) / 3;
  const followY = ( w0[ 1 ] + w1[ 1 ] + w2[ 1 ] ) / 3;

  // The camera always rides the undulating tube (its base offset and the FPV
  // follow are TUBE-relative), and the offset is clamped radially — valid for
  // any roundness, since the disc inscribes the square cross-section.
  let camOffX = ( camera.x ?? 0 ) + fpvFollow * ( followX - camCentre[ 0 ] );
  let camOffY = ( camera.y ?? 0.12 ) + fpvFollow * ( followY - camCentre[ 1 ] );

  const camLimit = HALF - 0.22;
  const camOffLen = Math.hypot(
    camOffX,
    camOffY
  );

  if ( camOffLen > camLimit ) {
    camOffX *= camLimit / camOffLen;
    camOffY *= camLimit / camOffLen;
  }

  const camX = camCentre[ 0 ] + camOffX;
  const camY = camCentre[ 1 ] + camOffY;

  const headW = weaveAt( headZ - scroll );
  const dz = headZ - camZ;
  const aimYaw = Math.atan2(
    headW[ 0 ] - camX,
    -dz
  );
  const aimPitch = Math.atan2(
    headW[ 1 ] - camY,
    Math.hypot(
      headW[ 0 ] - camX,
      dz
    )
  );
  const yaw = ( camera.yaw ?? 0 ) + fpvAim * aimYaw;
  const pitch = ( camera.pitch ?? -0.05 ) + fpvAim * aimPitch;

  const bankEps = 0.3;
  const dxds = ( weaveAt( camS + bankEps )[ 0 ] - weaveAt( camS - bankEps )[ 0 ] )
    / ( 2 * bankEps );
  const roll = fpvBank * dxds * direction;

  // ── Whoosh on every wall pass ──────────────────────────────────────────────
  // The camera sits at u = camS / SEG in wall units; each time u crosses an
  // integer, a pierced wall has just swept past the camera plane. The
  // comparison is wrap-aware (the loop seam jumps u by exactly `period`), and
  // scrub jumps of more than two walls stay silent instead of machine-gunning.
  // In capture mode audio.trigger only logs the event, so recordings get the
  // whoosh muxed in at the exact frame time.
  const wallU = camS / SEG;

  if ( lastWallU === null ) {
    lastWallU = wallU;
  } else if ( wallU !== lastWallU ) {
    let delta = wallU - lastWallU;

    if ( delta > period / 2 ) {
      delta -= period;
    } else if ( delta < -period / 2 ) {
      delta += period;
    }

    const crossings = Math.floor( wallU ) - Math.floor( wallU - delta );

    if ( ( sound.whooshEnabled ?? true )
      && crossings !== 0
      && Math.abs( crossings ) <= 2 ) {
      // The wall just crossed: its hole position places the whoosh in the
      // stereo field (hole x pans, hole y shifts the pitch).
      const crossed = delta > 0 ? Math.floor( wallU ) : Math.ceil( wallU );
      const hole = holes[ ( ( crossed % period ) + period ) % period ];
      const norm = maxHoleOffset > 1e-4 ? 1 / maxHoleOffset : 0;

      const panAmount = sound.whooshPan ?? 0.7;
      const pitch = sound.whooshPitch ?? 1;
      const pitchShift = 1 + 0.18 * hole[ 1 ] * norm;

      audio.trigger(
        "whoosh",
        {
          duration: sound.whooshLength ?? 0.45,
          freq: 550 * pitch * pitchShift,
          gain: 0.55 * ( sound.whooshVolume ?? 0.6 ),
          pan: hole[ 0 ] * norm * panAmount
        }
      );
    }

    lastWallU = wallU;
  }

  // ── Constant dragon hum ────────────────────────────────────────────────────
  // A bed of overlapping drone grains fired at a fixed count per loop: the
  // trapezoid envelopes crossfade into a steady breathy rumble that follows the
  // head in the stereo field, wobbles gently with the swim, loops seamlessly,
  // and (being one-shot events) records correctly in deterministic capture.
  if ( sound.humEnabled ?? true ) {
    const loopDuration = sketch.sketchOptions?.animation?.duration ?? 12;
    const grainsPerLoop = Math.max(
      4,
      Math.round( loopDuration / 0.35 )
    );
    const grainIndex = Math.floor( animation.progression * grainsPerLoop ) % grainsPerLoop;

    if ( grainIndex !== lastGrainIndex ) {
      lastGrainIndex = grainIndex;

      const grainSpacing = loopDuration / grainsPerLoop;
      const humPitch = sound.humPitch ?? 1;
      const wobble = 1 + 0.1 * Math.sin( swimT );

      audio.trigger(
        "drone",
        {
          duration: grainSpacing * 2.2,
          freq: 175 * humPitch * wobble,
          gain: 0.4 * ( sound.humVolume ?? 0.45 ),
          sub: 0.4,
          pan: Math.min(
            Math.max(
              headW[ 0 ] * 0.8,
              -1
            ),
            1
          )
        }
      );
    }
  } else {
    lastGrainIndex = null;
  }

  const az = light.azimuth ?? -0.6;
  const el = light.elevation ?? 0.7;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  // ── Seamless hues ──────────────────────────────────────────────────────────
  // The palette is periodic in 1 / hueSpread. The time scroll advances a whole
  // number of palette periods per loop, and the along-the-body shift is
  // quantised so one loop length also spans whole palette periods — otherwise
  // the colours would visibly reset at the seam.
  const hueSpread = colors.hueSpread ?? 1.6;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );
  const hueSpeedPhase = hueSpread ? ( t * hueCycles ) / ( p.TAU * hueSpread ) : 0;

  const lengthHueRaw = colors.lengthHueShift ?? 0.22;
  const lengthHueShift = hueSpread
    ? Math.round( lengthHueRaw * loopLength * hueSpread ) / ( loopLength * hueSpread )
    : lengthHueRaw;

  const ribsInt = Math.max(
    0,
    Math.round( corridor.ribs ?? 2 )
  );
  const ribFreq = ( p.TAU * ribsInt ) / SEG;

  scene.render( {
    columns: 1,
    rows: 1,
    resolutionScale: camera.quality ?? 0.85,
    uniforms: {
      uScroll: scroll,
      uPeriod: period,
      uHoles: {
        vec2v: holes.flat()
      },
      uHoleRadius: holeRadius,
      uRoundness: roundness,
      uWaveAmp: [
        waveAmpX,
        waveAmpY
      ],
      uWaveFreq: [
        waveFreqX,
        waveFreqY
      ],
      uWavePhase: wavePhase,
      uCorridorLipschitz: corridorLipschitz,
      uPipeCount: pipeCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uTwist: twist,
      uSpin: t * spinTurns,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseT: t * pulseTravelInt,
      uHeadZ: headZ,
      uHeadRound: headRound,
      uHeadMerge: headMerge,
      uTailThin: tailThin,
      uDragonLipschitz: dragonLipschitz,
      uSwimAmp: [
        swimAmpX,
        swimAmpY
      ],
      uSwimFreq: swimFreq,
      uSwimT: swimT,
      uSwimAxisPhase: swimAxisPhase,
      uSwimDip: swimDip,
      uDodgeHold: dodgeHold,
      uDodgeSharp: dodgeSharp,
      uBunch: bunch,
      uFlow: flow,
      uCamPos: [
        camX,
        camY,
        camZ
      ],
      uFocal: focal,
      uPitch: pitch,
      uYaw: yaw,
      uRoll: roll,
      uHueSpeed: hueSpeedPhase,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 0.4,
      uLengthHueShift: lengthHueShift,
      uPipeHueShift: colors.pipeHueShift ?? 0.33,
      uShimmer: colors.shimmer ?? 0.9,
      uSaturation: colors.saturation ?? 0.9,
      uBrightness: colors.brightness ?? 1.1,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.22,
      uDiffuse: light.diffuse ?? 0.8,
      uSpecular: light.specular ?? 0.5,
      uSpecPower: light.specPower ?? 32,
      uFresnelPower: light.fresnelPower ?? 2.8,
      uRimStrength: light.rimStrength ?? 0.45,
      uWallColor: corridor.wallColor
        ? corridor.wallColor.map( ( v ) => v / 255 )
        : [
          0.09,
          0.10,
          0.16
        ],
      uWallGlow: corridor.wallGlow ?? 0.7,
      uRibFreq: ribFreq,
      uGlassColor: obstacles.glassColor
        ? obstacles.glassColor.map( ( v ) => v / 255 )
        : [
          0.55,
          0.78,
          0.95
        ],
      uGlassAlpha: obstacles.glassAlpha ?? 0.32,
      uGlassThickness: obstacles.thickness ?? 0.12,
      uGlassEdge: obstacles.edgeSoftness ?? 0.03,
      uGlassFrost: obstacles.frost ?? 0.5,
      uFrostScale: obstacles.frostScale ?? 9,
      uGlassMilk: obstacles.milk ?? 0.3,
      uGlassTint: obstacles.glassTint ?? 0.3,
      uEdgeGlow: obstacles.edgeGlow ?? 0.8,
      uFogDensity: corridor.fogDensity ?? 0.13,
      uBgColor: ( o.backgroundColor ?? [
        4,
        4,
        10
      ] ).map( ( v ) => v / 255 )
    }
  } );
} );
