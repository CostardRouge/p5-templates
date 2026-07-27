import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import audio from "@/p5/utils/audio.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// dragon-corridor v3 — "whack-a-dragon". The corridor is gone: the same
// legless, wingless dragon now lives around a single horizontal plate of
// frosted ice pierced by a GRID of round holes (rows × columns options), like
// the arcade mole game seen from the mole's side. The dragon pops up out of a
// hole, arcs through the air, dives into another hole, swims under the
// translucent plate and resurfaces somewhere else — forever.
//
//   • The plate — one analytic slab (no marching), shaded exactly like v2's
//     pierced walls: Beer–Lambert opacity from the ray's path length, Perlin
//     frost, milky scatter, iridescent tint, a glowing seam ringing every hole
//     rim and the plate's outer edge, plus a pulsing iridescent ring that
//     telegraphs the hole the head is about to use. Because the plate is
//     translucent, the submerged body stays dimly visible through the ice.
//
//   • The path — the loop is divided into K crossings (K even, so up/down
//     parity closes). A seeded shuffle picks K DISTINCT holes of the grid per
//     loop, so the dragon can never thread a hole its body still occupies:
//     within one loop every crossing uses a different hole, and the body is
//     clamped shorter than the loop. Between crossings the centreline is a
//     cubic Hermite in the plane (Catmull-Rom tangents scaled by "flow", as in
//     v2) with a sine arc in height — above the plate on even crossings, below
//     on odd ones, with per-arc seeded height jitter so airborne and submerged
//     arcs never look (or collide) the same.
//
//   • Behaviour — "hesitation" warps each airborne arc's clock so the head
//     pops out, hangs at the apex looking around, then dives fast; at 0 the
//     glide is uniform. "flow" blends vertical periscope dives (zero Hermite
//     tangents) into one continuous slither that crosses every hole at an
//     angle. A swim sway wiggles the body but pinches to zero at each plane
//     crossing (v2's swimDip) so the body always threads dead-centre.
//
//   • The dragon — a finite snake this time: tapered tail, swelling head, a
//     travelling radius pulse, and the v1/v2 PIPE BRAID around the free
//     centreline: each capsule segment folds the angle around its local axis
//     by the pipe count (the untwist trick, per capsule), so the bundle of
//     twisted tubes costs the same as a single one. The braid unwinds into
//     the rounded head exactly like v2. Every pattern is anchored to the HEAD
//     (distance-behind-head), so loop closure is automatic and only time
//     phases need cycle snapping.
//
//   • Cameras — orbit (see the whole plate and the dragon making its
//     choices), top (straight-down whack-a-mole view), follow (chase cam
//     behind the head) and pov (ride the head through the holes), all
//     loop-periodic. No chromatic aberration here — nothing to smear.
//
// ── Looping ──────────────────────────────────────────────────────────────────
// The head parameter advances by exactly K crossings per loop and the hole
// sequence is cyclic with period K (K even keeps the above/below parity).
// Body-anchored phases (pulse, swim, hue along the body) depend only on
// (head − s), so they are loop-invariant by construction; time-driven rates
// (spin, pulse travel, swim travel, hue scroll, camera orbit) are snapped to
// whole cycles per loop, so the last frame reproduces the first.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SEQ = 24; // max crossings per loop (uniform array size)
const ARC_SAMPLES = 9; // tapered capsules sampled per arc
const MAX_STEPS = 96; // sphere-trace iterations per ray
const SURF_EPS = 0.0012; // hit threshold (world units)
const MAX_DIST = 40.0; // ray cutoff / far plane
const SP = 1.0; // hole grid spacing (world units)

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) };
  const float MAX_DIST = ${ MAX_DIST.toFixed( 4 ) };
  const float SP       = ${ SP.toFixed( 4 ) };

  // ── Path / sequence ──
  uniform float uSeqLen;      // K = crossings per loop (even)
  uniform float uHead;        // head parameter, in crossings
  uniform float uBodyLen;     // body length, in crossings (< K − 1)
  uniform vec4  uArcP[${ MAX_SEQ }]; // xy = start hole, zw = end hole (plate xz)
  uniform vec4  uArcM[${ MAX_SEQ }]; // xy / zw = Hermite tangents (pre-scaled by flow)
  uniform vec4  uArcE[${ MAX_SEQ }]; // x = signed arc height, y = hole hue tag

  // ── Path shaping ──
  uniform float uHes;         // apex dwell on airborne arcs (0 = uniform glide)
  uniform vec2  uSwimAmp;     // swim sway amplitude (x, z)
  uniform float uSwimFreq;    // sway spatial freq (rad per crossing, body-anchored)
  uniform float uSwimT;       // sway travel phase (whole cycles per loop)
  uniform float uSwimPhase;   // z-axis sway phase offset
  uniform float uSwimDip;     // how completely the sway pauses at each crossing

  // ── Body radii ──
  uniform float uPipeRadius;
  uniform float uTailLen;     // crossings over which the tail tapers away
  uniform float uHeadBulge;   // head swell amount
  uniform float uHeadLen;     // head swell falloff (in crossings behind the head)
  uniform float uRadiusPulse; // travelling swell of the body radius
  uniform float uPulseFreq;   // swell spatial freq (rad per crossing)
  uniform float uPulseT;      // swell travel phase (whole cycles per loop)
  uniform float uBoundPad;    // CPU-computed inflation for the per-arc bound
  uniform float uLip;         // CPU-computed safety divisor for the march

  // ── Pipe braid (the v1/v2 bundle, wound around the free centreline) ──
  uniform float uPipeCount;   // pipes in the bundle (1 = plain snake)
  uniform float uBraidRadius; // bundle orbit radius (0 = pipes merged)
  uniform float uBraidMerge;  // body length over which the braid unwinds into the head
  uniform float uTwist;       // braid winding (rad per crossing along the body)
  uniform float uSpin;        // braid rotation over time (whole turns per loop)
  uniform float uPipeHueShift;

  // ── Ice plate ──
  uniform vec2  uPlaneHalf;   // plate half-extents (xz)
  uniform float uGridCols;    // (uColumns/uRows are taken by the shared header)
  uniform float uGridRows;
  uniform float uHoleRadius;
  uniform float uPlaneThick;
  uniform vec3  uGlassColor;
  uniform float uGlassAlpha;  // straight-through opacity of the plate
  uniform float uGlassEdge;   // half-width of the hole rim (small = sharp)
  uniform float uGlassFrost;  // Perlin frost mottling amount
  uniform float uFrostScale;
  uniform float uGlassMilk;   // pulls the tint toward white scatter
  uniform float uGlassTint;   // how much each cell borrows the iridescent hue
  uniform float uEdgeGlow;    // bright seam ringing every hole
  uniform float uBorderGlow;  // bright seam along the plate's outer edge
  uniform vec2  uTargetHole;  // hole the head is about to use
  uniform float uTargetGlow;  // pre-pulsed ring brightness for that hole
  uniform float uTargetTag;   // its palette tag
  uniform float uShadow;      // dragon contact shadow on the plate
  uniform float uShadowSoft;
  uniform float uDepthDim;    // extra murk on the submerged body

  // ── Camera (full basis computed on the CPU) ──
  uniform vec3  uCamPos;
  uniform vec3  uCamFwd;
  uniform vec3  uCamRight;
  uniform vec3  uCamUp;
  uniform float uFocal;

  // ── Iridescent palette (shared vocabulary with v1/v2) ──
  uniform float uHueSpeed;    // pre-scaled scroll phase (whole palette periods/loop)
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uLengthHueShift; // hue waves along the body (body-anchored)
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

  uniform float uFogDensity;
  uniform vec3  uBgColor;
  uniform vec3  uBoundMin;    // dragon bounding box (march early-out)
  uniform vec3  uBoundMax;

  // Oil-slick / thin-film iridescence — identical palette to v1/v2.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // Arc clock warp: monotone cubic that is FAST at both crossings and SLOW at
  // the apex — the head pops out, hangs there, then dives. k = 0 is linear.
  float warpApex(float u, float k) {
    float x = 2.0 * u - 1.0;
    float a = 1.0 - k;

    return 0.5 + 0.5 * (a * x + (1.0 - a) * x * x * x);
  }

  float segDist3(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);

    return length(pa - ba * h);
  }

  // Centreline point of arc k at local parameter u — Hermite in the plate
  // plane, sine arc in height, swim sway pinched at the crossings. Mirrored on
  // the CPU (pathAt) for the cameras and the sound, so they can never disagree.
  vec3 arcPoint(float k, float u, vec4 P, vec4 M, vec4 E) {
    float dwell = E.x > 0.0 ? uHes : 0.0;
    float w = warpApex(u, dwell);
    float w2 = w * w;
    float w3 = w2 * w;

    vec2 xz = P.xy * (2.0 * w3 - 3.0 * w2 + 1.0)
      + M.xy * (w3 - 2.0 * w2 + w)
      + P.zw * (-2.0 * w3 + 3.0 * w2)
      + M.zw * (w3 - w2);

    float behind = uHead - (k + u);
    float win = sin(PI * u);
    float dip = mix(1.0, win * win, uSwimDip);

    xz += dip * uSwimAmp * vec2(
      sin(behind * uSwimFreq - uSwimT),
      sin(behind * uSwimFreq - uSwimT + uSwimPhase)
    );

    return vec3(xz.x, E.x * sin(PI * w), xz.y);
  }

  // Pipe radius at a distance behind the head: tail taper, head swell and the
  // travelling pulse. All body-anchored, so the loop closes by construction.
  float pipeRadiusAt(float behind) {
    float taper = smoothstep(uBodyLen, uBodyLen - uTailLen, behind);
    float hb = behind / max(uHeadLen, 0.05);
    float r = uPipeRadius * mix(0.08, 1.0, taper);

    r *= 1.0 + uHeadBulge * exp(-hb * hb);
    r *= 1.0 + uRadiusPulse * sin(behind * uPulseFreq - uPulseT);

    return r;
  }

  // Braid orbit radius: the bundle unwinds into a single rounded head over
  // uBraidMerge (exactly v2's head merge) and collapses again at the tail tip.
  float braidRadiusAt(float behind) {
    float merge = smoothstep(0.0, max(uBraidMerge, 0.02), behind);
    float taper = smoothstep(uBodyLen, uBodyLen - uTailLen, behind);

    return uBraidRadius * merge * taper;
  }

  // One braided capsule segment. Instead of one tube per pipe, the angle
  // around the local axis is FOLDED by the pipe count (v1/v2's untwist trick,
  // per capsule): a single circle distance then covers every pipe of the
  // bundle, so the cost is independent of how many pipes there are. Slightly
  // non-metric (taper, twist) — uLip covers the shortfall.
  float braidCap(vec3 p, vec3 a, vec3 b, float bA, float bB) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float bb = max(dot(ba, ba), 1e-8);
    float h = clamp(dot(pa, ba) / bb, 0.0, 1.0);
    vec3 q = pa - ba * h;
    float behind = mix(bA, bB, h);
    float pr = pipeRadiusAt(behind);
    float br = braidRadiusAt(behind);

    if (uPipeCount < 1.5 || br < 0.004) {
      return length(q) - (pr + br);
    }

    vec3 T = ba * inversesqrt(bb);
    vec3 refUp = normalize(mix(
      vec3(0.0, 1.0, 0.0),
      vec3(1.0, 0.0, 0.0),
      smoothstep(0.8, 0.98, abs(T.y))
    ));
    vec3 fN = normalize(cross(refUp, T));
    vec3 fB = cross(T, fN);
    vec3 perp = q - T * dot(q, T);
    float rho = length(perp);
    float phi = atan(dot(perp, fB), dot(perp, fN) + 1e-6);
    float psi = phi + uTwist * behind + uSpin;
    float sector = TAU / uPipeCount;
    float pm = mod(psi + 0.5 * sector, sector) - 0.5 * sector;
    float d2 = dot(q, q) + br * br - 2.0 * rho * br * cos(pm);

    return sqrt(max(d2, 0.0)) - pr;
  }

  // ── Dragon SDF ────────────────────────────────────────────────────────────
  // The body spans s ∈ [uHead − uBodyLen, uHead]. One pass over the uniform
  // arrays: each slot i hosts at most ONE active arc k ≡ i (mod K) because the
  // body is shorter than the loop — k is recovered arithmetically, so the
  // arrays are only ever indexed by the loop variable (WebGL1-safe). A cheap
  // hole-to-hole capsule bound rejects far arcs before the fine sampling.
  float mapDragon(vec3 p) {
    float sTail = uHead - uBodyLen;
    float kStart = floor(sTail);
    float kLast = floor(uHead) + 0.5;
    float best = 1e9;

    for (int i = 0; i < ${ MAX_SEQ }; i++) {
      if (float(i) >= uSeqLen) { break; }

      float k = float(i) + uSeqLen * ceil((kStart - float(i)) / uSeqLen);

      if (k > kLast) { continue; }

      float u0 = max(sTail - k, 0.0);
      float u1 = min(uHead - k, 1.0);

      if (u1 - u0 < 1e-4) { continue; }

      vec4 P = uArcP[i];
      vec4 M = uArcM[i];
      vec4 E = uArcE[i];

      float bound = segDist3(
        p,
        vec3(P.x, 0.0, P.y),
        vec3(P.z, 0.0, P.w)
      ) - (abs(E.x) + uBoundPad);

      if (bound > best) { continue; }

      vec3 prev = arcPoint(k, u0, P, M, E);
      float bPrev = uHead - (k + u0);

      for (int m = 1; m <= ${ ARC_SAMPLES }; m++) {
        float un = mix(u0, u1, float(m) / ${ ARC_SAMPLES.toFixed( 1 ) });
        vec3 cur = arcPoint(k, un, P, M, E);
        float bCur = uHead - (k + un);

        best = min(best, braidCap(p, prev, cur, bPrev, bCur));
        prev = cur;
        bPrev = bCur;
      }
    }

    return best / uLip;
  }

  // Same walk, recomputed once at the hit point, returning the winning body
  // coordinate and which pipe of the bundle owns the hit (for its hue band).
  vec2 dragonInfo(vec3 p) {
    float sTail = uHead - uBodyLen;
    float kStart = floor(sTail);
    float kLast = floor(uHead) + 0.5;
    float best = 1e9;
    float sBest = uHead;
    float pipeBest = 0.0;

    for (int i = 0; i < ${ MAX_SEQ }; i++) {
      if (float(i) >= uSeqLen) { break; }

      float k = float(i) + uSeqLen * ceil((kStart - float(i)) / uSeqLen);

      if (k > kLast) { continue; }

      float u0 = max(sTail - k, 0.0);
      float u1 = min(uHead - k, 1.0);

      if (u1 - u0 < 1e-4) { continue; }

      vec4 P = uArcP[i];
      vec4 M = uArcM[i];
      vec4 E = uArcE[i];

      float bound = segDist3(
        p,
        vec3(P.x, 0.0, P.y),
        vec3(P.z, 0.0, P.w)
      ) - (abs(E.x) + uBoundPad);

      if (bound > best) { continue; }

      float uPrev = u0;
      vec3 prev = arcPoint(k, u0, P, M, E);
      float bPrev = uHead - (k + u0);

      for (int m = 1; m <= ${ ARC_SAMPLES }; m++) {
        float un = mix(u0, u1, float(m) / ${ ARC_SAMPLES.toFixed( 1 ) });
        vec3 cur = arcPoint(k, un, P, M, E);
        float bCur = uHead - (k + un);
        float d = braidCap(p, prev, cur, bPrev, bCur);

        if (d < best) {
          best = d;

          // Recover the owning pipe from the winning capsule's fold.
          vec3 pa = p - prev;
          vec3 ba = cur - prev;
          float bb = max(dot(ba, ba), 1e-8);
          float h = clamp(dot(pa, ba) / bb, 0.0, 1.0);
          vec3 q = pa - ba * h;
          vec3 T = ba * inversesqrt(bb);
          vec3 refUp = normalize(mix(
            vec3(0.0, 1.0, 0.0),
            vec3(1.0, 0.0, 0.0),
            smoothstep(0.8, 0.98, abs(T.y))
          ));
          vec3 fN = normalize(cross(refUp, T));
          vec3 fB = cross(T, fN);
          vec3 perp = q - T * dot(q, T);
          float phi = atan(dot(perp, fB), dot(perp, fN) + 1e-6);
          float behind = mix(bPrev, bCur, h);
          float psi = phi + uTwist * behind + uSpin;
          float sector = TAU / max(uPipeCount, 1.0);

          sBest = k + mix(uPrev, un, h);
          pipeBest = mod(floor(psi / sector + 0.5), max(uPipeCount, 1.0));
        }

        uPrev = un;
        prev = cur;
        bPrev = bCur;
      }
    }

    return vec2(sBest, pipeBest);
  }

  // 4-tap tetrahedron normal.
  vec3 calcNormal(vec3 p) {
    vec2 k = vec2(1.0, -1.0);
    float e = SURF_EPS;

    return normalize(
      k.xyy * mapDragon(p + k.xyy * e) +
      k.yyx * mapDragon(p + k.yyx * e) +
      k.yxy * mapDragon(p + k.yxy * e) +
      k.xxx * mapDragon(p + k.xxx * e)
    );
  }

  // Cheap AO — a few short steps along the normal.
  float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;

    for (int i = 0; i < 3; i++) {
      float h = 0.03 + 0.11 * float(i);
      float d = mapDragon(p + n * h);

      occ += (h - d) * sca;
      sca *= 0.6;
    }

    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
  }

  // Iridescent wet-tube shading, v2 style: each pipe of the braid carries its
  // own hue band, fading out where the bundle merges into the head so the
  // colours flow seamlessly into it.
  vec3 shadeDragon(vec3 pos, vec3 n, vec3 rd) {
    vec2 info = dragonInfo(pos);
    float behind = max(uHead - info.x, 0.0);
    float merge = smoothstep(0.0, max(uBraidMerge, 0.02), behind);

    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);
    float phase = behind * uLengthHueShift + uHueSpeed
      + info.y * uPipeHueShift * merge;
    vec3 base = iridescent(phase + uShimmer * fres);

    float diff = max(dot(n, uLightDir), 0.0);
    vec3 hlf = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = calcAO(pos, n);

    vec3 col = base * (uAmbient + uDiffuse * diff * ao);

    col += base * fres * uRimStrength;
    col += vec3(spec) * ao;

    // Submerged murk: below the plate the body cools toward the ice tint.
    float under = smoothstep(0.03, -0.4, pos.y);

    col = mix(col, col * uGlassColor * 1.15, under * uDepthDim);

    return col;
  }

  // Sphere-trace the dragon only (the plate is analytic). A ray/box test
  // against the CPU-computed dragon bounds skips empty pixels entirely.
  vec4 traceDragon(vec3 ro, vec3 rd) {
    vec3 inv = 1.0 / vec3(
      abs(rd.x) < 1e-6 ? 1e-6 : rd.x,
      abs(rd.y) < 1e-6 ? 1e-6 : rd.y,
      abs(rd.z) < 1e-6 ? 1e-6 : rd.z
    );
    vec3 tA = (uBoundMin - ro) * inv;
    vec3 tB = (uBoundMax - ro) * inv;
    vec3 tMin = min(tA, tB);
    vec3 tMax = max(tA, tB);
    float tEnter = max(max(tMin.x, tMin.y), tMin.z);
    float tExit = min(min(tMax.x, tMax.y), tMax.z);

    if (tExit < max(tEnter, 0.0)) { return vec4(uBgColor, MAX_DIST); }

    float t = max(tEnter, 0.0);
    float tEnd = min(tExit + 0.05, MAX_DIST);
    bool hit = false;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
      vec3 pos = ro + rd * t;
      float d = mapDragon(pos);

      if (d < SURF_EPS) { hit = true; break; }

      t += d;

      if (t > tEnd) { break; }
    }

    if (!hit) { return vec4(uBgColor, MAX_DIST); }

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    vec3 col = shadeDragon(pos, n, rd);
    float fog = exp(-uFogDensity * t);

    return vec4(mix(uBgColor, col, fog), t);
  }

  // ── Analytic frosted plate ──────────────────────────────────────────────────
  // One horizontal slab pierced by the hole grid: clip the ray's span inside
  // the slab, find the nearest grid hole at the crossing point, and turn the
  // traversed path length into a Beer–Lambert opacity minus the hole coverage.
  // Works from either side (the POV camera dives straight through).
  vec4 glassLayer(vec3 ro, vec3 rd, float tHit) {
    float ry = abs(rd.y) < 1e-5 ? (rd.y < 0.0 ? -1e-5 : 1e-5) : rd.y;
    float halfTh = 0.5 * max(uPlaneThick, 0.02);
    float tA = (halfTh - ro.y) / ry;
    float tB = (-halfTh - ro.y) / ry;
    float t0 = max(min(tA, tB), 0.0);
    float t1 = min(max(tA, tB), tHit);

    if (t1 <= t0) { return vec4(vec3(0.0), 1.0); }

    vec3 hp = ro + rd * (0.5 * (t0 + t1));
    vec2 rel = hp.xz;

    // Rounded-rectangle plate footprint; rays outside pass freely.
    vec2 q = abs(rel) - uPlaneHalf + 0.18;
    float rect = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.18;
    float inside = 1.0 - smoothstep(-0.03, 0.0, rect);

    if (inside <= 0.001) { return vec4(vec3(0.0), 1.0); }

    // Nearest hole of the grid (regular lattice → pure arithmetic).
    float ix = clamp(floor(rel.x / SP + uGridCols * 0.5), 0.0, uGridCols - 1.0);
    float iz = clamp(floor(rel.y / SP + uGridRows * 0.5), 0.0, uGridRows - 1.0);
    vec2 hole = vec2(
      (ix - (uGridCols - 1.0) * 0.5) * SP,
      (iz - (uGridRows - 1.0) * 0.5) * SP
    );
    float holeDist = length(rel - hole);

    // Coverage: full plate minus the round passage.
    float edge = max(uGlassEdge, 0.002);
    float cover = smoothstep(uHoleRadius - edge, uHoleRadius + edge, holeDist);

    // Path length through the slab → physical opacity.
    float extinction = -log(1.0 - min(uGlassAlpha, 0.97)) / (2.0 * halfTh);
    float a = (1.0 - exp(-extinction * (t1 - t0))) * cover * inside;

    // Frost mottling: a fixed Perlin pattern over the plate.
    if (uGlassFrost > 0.001) {
      float frost = perlinNoise(vec3(rel * uFrostScale, 3.7));

      a *= mix(1.0, clamp(0.35 + 1.4 * frost, 0.0, 1.2), uGlassFrost);
    }

    // Per-cell iridescent tint + milky scatter.
    vec3 tint = mix(
      uGlassColor,
      iridescent((ix + iz * uGridCols) * 0.17 + 0.09),
      uGlassTint
    );

    tint = mix(tint, vec3(1.0), uGlassMilk);

    // Grazing views brighten the frost; seams ring every hole rim and the
    // plate's outer edge; the target hole gets its pulsing iridescent halo.
    float grazing = 1.0 - abs(rd.y);
    float seam = exp(-abs(holeDist - uHoleRadius) * 18.0) * uEdgeGlow;
    float border = exp(-abs(rect) * 14.0) * uBorderGlow;
    float targetRing = exp(-abs(length(rel - uTargetHole) - uHoleRadius) * 10.0)
      * uTargetGlow;

    // Top-face specular streak so the ice catches the light.
    vec3 hlf = normalize(uLightDir - rd);
    float spec = pow(max(hlf.y, 0.0), uSpecPower) * uSpecular * 0.5;

    vec3 paneCol = tint * (0.65 + 0.6 * grazing)
      + tint * (seam + border)
      + iridescent(uTargetTag) * targetRing
      + vec3(spec);

    // Dragon contact shadow: one SDF probe at the crossing point.
    if (uShadow > 0.001) {
      float dd = max(mapDragon(hp) * uLip, 0.0);

      paneCol *= 1.0 - uShadow * exp(-dd / max(uShadowSoft, 0.02));
    }

    // Fog attenuates the plate's colour AND its opacity with distance.
    float fog = exp(-uFogDensity * (0.5 * (t0 + t1)));

    paneCol = mix(uBgColor, paneCol, fog);
    a = clamp(a * (0.85 + 0.5 * grazing) * fog, 0.0, 0.97);

    return vec4(a * paneCol, 1.0 - a);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 ro = uCamPos;
    vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);

    vec4 opaque = traceDragon(ro, rd);
    vec4 glass = glassLayer(ro, rd, opaque.a);

    vec3 col = glass.rgb + glass.a * opaque.rgb;

    // Alpha: the dragon is solid; escaped rays with no ice in front stay
    // transparent so the p5 background shows through as the open sky / abyss.
    float opaqueSolid = opaque.a < MAX_DIST ? 1.0 : 0.0;
    float alpha = (1.0 - glass.a) + glass.a * opaqueSolid;

    gl_FragColor = vec4(col, alpha);
  }
`;

const scene = createNoiseFieldRenderer( FRAGMENT );

// ── CPU side ─────────────────────────────────────────────────────────────────
// The cameras and the sound need the exact path the shader renders, so the
// hole sequence, the Hermite arcs and the centreline maths all live here too
// and are shared with the GPU through uniforms.

// Deterministic xorshift32 — identical sequences on every platform, so the
// recorded video always matches the preview.
function makeRng( seed ) {
  let s = ( Math.imul(
    seed + 1,
    2654435761
  ) ^ 0x9e3779b9 ) >>> 0;

  if ( s === 0 ) {
    s = 1;
  }

  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;

    return s / 4294967296;
  };
}

// Seeded shuffle of every hole in the grid; the first K entries become the
// loop's visiting order. All K holes are DISTINCT, which is the whole
// self-collision guarantee: the body (shorter than the loop) can never occupy
// the same hole twice at once.
function buildArcs( {
  cols,
  rows,
  crossings,
  seed,
  flow,
  apexHeight,
  diveDepth,
  arcJitter
} ) {
  const total = cols * rows;
  const order = [];
  const rng = makeRng( seed );

  for ( let i = 0; i < total; i++ ) {
    order.push( i );
  }

  for ( let i = total - 1; i > 0; i-- ) {
    const j = Math.floor( rng() * ( i + 1 ) );
    const tmp = order[ i ];

    order[ i ] = order[ j ];
    order[ j ] = tmp;
  }

  const holes = [];

  for ( let k = 0; k < crossings; k++ ) {
    const idx = order[ k ];

    holes.push( {
      idx,
      x: ( ( idx % cols ) - ( cols - 1 ) / 2 ) * SP,
      z: ( Math.floor( idx / cols ) - ( rows - 1 ) / 2 ) * SP
    } );
  }

  const arcs = [];

  for ( let k = 0; k < crossings; k++ ) {
    const prev = holes[ ( k - 1 + crossings ) % crossings ];
    const a = holes[ k ];
    const b = holes[ ( k + 1 ) % crossings ];
    const next = holes[ ( k + 2 ) % crossings ];
    const above = k % 2 === 0;
    const jitter = 1 + arcJitter * ( rng() - 0.5 );

    arcs.push( {
      p0: [
        a.x,
        a.z
      ],
      p1: [
        b.x,
        b.z
      ],
      m0: [
        0.5 * flow * ( b.x - prev.x ),
        0.5 * flow * ( b.z - prev.z )
      ],
      m1: [
        0.5 * flow * ( next.x - a.x ),
        0.5 * flow * ( next.z - a.z )
      ],
      amp: above ? apexHeight * jitter : -diveDepth * jitter,
      tag: a.idx / total,
      hole: a
    } );
  }

  return arcs;
}

// Head-crossing bookkeeping for the splash sound (wrap-aware, as in v2).
let lastCrossU = null;

// Index of the last fired hum grain (see v2 — a seamless drone bed).
let lastGrainIndex = null;

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const grid = o.grid ?? {};
  const dragon = o.dragon ?? {};
  const motion = o.motion ?? {};
  const plate = o.plate ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const sound = o.sound ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    6,
    8,
    16
  ] ) );

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;

  // ── Grid & loop-exact clock ────────────────────────────────────────────────
  // K crossings per loop, forced even so the up/down parity closes, and capped
  // by the number of holes so every crossing in a loop uses a distinct hole.
  const cols = Math.min(
    6,
    Math.max(
      2,
      Math.round( grid.cols ?? 4 )
    )
  );
  const rows = Math.min(
    6,
    Math.max(
      2,
      Math.round( grid.rows ?? 4 )
    )
  );
  const total = cols * rows;

  let crossings = Math.min(
    Math.round( grid.divesPerLoop ?? 12 ),
    total,
    MAX_SEQ
  );

  crossings -= crossings % 2;
  crossings = Math.max(
    crossings,
    2
  );

  const f = animation.progression * crossings;

  // ── Behaviour ──────────────────────────────────────────────────────────────
  const flow = Math.min(
    Math.max(
      motion.flow ?? 0.35,
      0
    ),
    1
  );
  const hesitation = Math.min(
    Math.max(
      motion.hesitation ?? 0.55,
      0
    ),
    1
  );
  const apexHeight = motion.apexHeight ?? 0.85;
  const diveDepth = motion.diveDepth ?? 0.75;
  const arcJitter = Math.min(
    Math.max(
      motion.arcJitter ?? 0.5,
      0
    ),
    1
  );

  const seed = Math.round( grid.seed ?? 7 );
  const arcs = buildArcs( {
    cols,
    rows,
    crossings,
    seed,
    flow,
    apexHeight,
    diveDepth,
    arcJitter
  } );

  // ── Body ───────────────────────────────────────────────────────────────────
  // The body must stay shorter than the loop (self-collision guarantee) and
  // thinner than the passages it threads.
  const holeRadius = grid.holeRadius ?? 0.34;
  const bodyLen = Math.min(
    Math.max(
      dragon.bodyLength ?? 4,
      0.5
    ),
    crossings - 1.2
  );
  // The whole bundle (orbit + pipe) must fit through the holes: when the
  // requested braid exceeds the passage, both radii scale down together.
  const pipeCount = Math.min(
    Math.max(
      Math.round( dragon.pipes ?? 5 ),
      1
    ),
    8
  );
  const pipeRadiusRaw = Math.max(
    dragon.pipeRadius ?? 0.06,
    0.02
  );
  const braidRadiusRaw = Math.max(
    dragon.braidRadius ?? 0.1,
    0
  );
  const holeFit = Math.max(
    holeRadius * 0.9 - 0.02,
    0.05
  );
  const bundle = pipeRadiusRaw + braidRadiusRaw;
  const bundleScale = bundle > holeFit ? holeFit / bundle : 1;
  const pipeRadius = pipeRadiusRaw * bundleScale;
  const braidRadius = braidRadiusRaw * bundleScale;
  const braidMerge = dragon.braidMerge ?? 0.5;
  const headBulge = dragon.headBulge ?? 0.35;
  const headLen = dragon.headLength ?? 0.6;
  const tailLen = Math.min(
    dragon.tailLength ?? 1.6,
    bodyLen
  );
  const radiusPulse = dragon.radiusPulse ?? 0.18;

  const pulseWavesInt = Math.max(
    1,
    Math.round( dragon.pulseWaves ?? 5 )
  );
  const pulseFreq = ( p.TAU * pulseWavesInt ) / bodyLen;
  const pulseTravelInt = Math.round( ( dragon.pulseTravel ?? -4 ) * timeScale );

  const swimWavesInt = Math.max(
    1,
    Math.round( motion.swimWaves ?? 3 )
  );
  const swimFreq = ( p.TAU * swimWavesInt ) / bodyLen;
  const swimCycles = Math.round( ( motion.swimSpeed ?? 2 ) * timeScale );
  const swimT = t * swimCycles;
  const swimAmpX = motion.swimX ?? 0.05;
  const swimAmpZ = motion.swimZ ?? 0.05;
  const swimPhase = motion.swimPhase ?? 1.6;
  const swimDip = Math.min(
    Math.max(
      motion.swimDip ?? 0.85,
      0
    ),
    1
  );

  const twist = ( p.TAU * ( dragon.twist ?? 2 ) ) / bodyLen;
  const spinTurns = Math.round( ( dragon.spin ?? -2 ) * timeScale );

  // ── March safety ───────────────────────────────────────────────────────────
  // Bound inflation: the Hermite can overshoot the hole-to-hole chord by at
  // most (4/27)·(|m0|+|m1|), plus the swim sway and the fattest body radius.
  let maxTangent = 0;

  for ( const arc of arcs ) {
    maxTangent = Math.max(
      maxTangent,
      Math.hypot(
        arc.m0[ 0 ],
        arc.m0[ 1 ]
      ),
      Math.hypot(
        arc.m1[ 0 ],
        arc.m1[ 1 ]
      )
    );
  }

  const swimLen = Math.hypot(
    swimAmpX,
    swimAmpZ
  );
  const maxR = braidRadius
    + pipeRadius * ( 1 + headBulge ) * ( 1 + radiusPulse );
  const overshoot = ( 8 / 27 ) * maxTangent;
  const boundPad = maxR + overshoot + swimLen + 0.05;

  // Lipschitz divisor: the tapered-capsule approximation plus the pulse, head
  // swell and tail taper slopes, and the braid's own twist gradient (pipe
  // positions rotate along the body, steepening the field between pipes).
  let minChord = Infinity;

  for ( const arc of arcs ) {
    minChord = Math.min(
      minChord,
      Math.hypot(
        arc.p1[ 0 ] - arc.p0[ 0 ],
        arc.p1[ 1 ] - arc.p0[ 1 ]
      )
    );
  }

  const lipschitz = 1.3 + pipeRadius * (
    radiusPulse * pulseFreq
    + headBulge / Math.max(
      headLen,
      0.1
    )
    + 1 / Math.max(
      tailLen,
      0.3
    )
  ) + braidRadius * (
    twist / Math.max(
      minChord,
      0.4
    )
    + 1 / Math.max(
      braidMerge,
      0.25
    )
  );

  // Dragon bounding box for the march early-out.
  const holeReachX = ( ( cols - 1 ) / 2 ) * SP;
  const holeReachZ = ( ( rows - 1 ) / 2 ) * SP;
  const reachPad = overshoot + swimLen + maxR + 0.1;
  const maxAmp = Math.max(
    apexHeight,
    diveDepth
  ) * ( 1 + arcJitter * 0.55 );

  // ── CPU path mirror (drives the cameras and the sound) ────────────────────
  const warpApex = (
    u, k
  ) => {
    const x = 2 * u - 1;
    const a = 1 - k;

    return 0.5 + 0.5 * ( a * x + ( 1 - a ) * x * x * x );
  };

  const pathAt = ( s ) => {
    const kf = Math.floor( s );
    const u = s - kf;
    const arc = arcs[ ( ( kf % crossings ) + crossings ) % crossings ];
    const w = warpApex(
      u,
      arc.amp > 0 ? hesitation : 0
    );
    const w2 = w * w;
    const w3 = w2 * w;
    const b00 = 2 * w3 - 3 * w2 + 1;
    const b10 = w3 - 2 * w2 + w;
    const b01 = -2 * w3 + 3 * w2;
    const b11 = w3 - w2;
    const behind = f - s;
    const win = Math.sin( Math.PI * u );
    const dip = 1 + swimDip * ( win * win - 1 );

    return [
      arc.p0[ 0 ] * b00 + arc.m0[ 0 ] * b10 + arc.p1[ 0 ] * b01 + arc.m1[ 0 ] * b11
        + dip * swimAmpX * Math.sin( behind * swimFreq - swimT ),
      arc.amp * Math.sin( Math.PI * w ),
      arc.p0[ 1 ] * b00 + arc.m0[ 1 ] * b10 + arc.p1[ 1 ] * b01 + arc.m1[ 1 ] * b11
        + dip * swimAmpZ * Math.sin( behind * swimFreq - swimT + swimPhase )
    ];
  };

  // ── Camera ─────────────────────────────────────────────────────────────────
  const view = camera.view ?? "orbit";
  const planeHalfX = ( cols * SP ) / 2 + 0.45;
  const planeHalfZ = ( rows * SP ) / 2 + 0.45;
  const gridRadius = Math.hypot(
    planeHalfX,
    planeHalfZ
  );

  const smoothWin = ( camera.smoothing ?? 0.5 ) * 0.7 + 0.02;
  const smoothAt = ( s ) => {
    const a = pathAt( s - smoothWin );
    const b = pathAt( s );
    const c = pathAt( s + smoothWin );

    return [
      ( a[ 0 ] + b[ 0 ] + c[ 0 ] ) / 3,
      ( a[ 1 ] + b[ 1 ] + c[ 1 ] ) / 3,
      ( a[ 2 ] + b[ 2 ] + c[ 2 ] ) / 3
    ];
  };

  const norm3 = (
    v, fallback
  ) => {
    const len = Math.hypot(
      v[ 0 ],
      v[ 1 ],
      v[ 2 ]
    );

    if ( len < 1e-5 ) {
      return fallback;
    }

    return [
      v[ 0 ] / len,
      v[ 1 ] / len,
      v[ 2 ] / len
    ];
  };

  const aimAhead = camera.aimAhead ?? 0.5;
  const bank = camera.bank ?? 0.6;
  const headSmooth = smoothAt( f );

  let camPos;
  let camTarget;
  let roll = 0;

  if ( view === "follow" || view === "pov" ) {
    if ( view === "follow" ) {
      const back = smoothAt( f - 0.6 );
      const dir = norm3(
        [
          headSmooth[ 0 ] - back[ 0 ],
          0,
          headSmooth[ 2 ] - back[ 2 ]
        ],
        [
          0,
          0,
          1
        ]
      );
      const dist = camera.followDistance ?? 2.2;

      camPos = [
        headSmooth[ 0 ] - dir[ 0 ] * dist,
        headSmooth[ 1 ] + ( camera.followHeight ?? 0.8 ),
        headSmooth[ 2 ] - dir[ 2 ] * dist
      ];
      camTarget = smoothAt( f + aimAhead );
    } else {
      const seat = smoothAt( f - 0.35 );

      camPos = [
        seat[ 0 ],
        seat[ 1 ] + ( camera.povLift ?? 0.12 ),
        seat[ 2 ]
      ];
      camTarget = smoothAt( f + Math.max(
        aimAhead,
        0.25
      ) );
    }

    // Banking: lateral acceleration of the path, measured in the camera frame.
    const e = 0.3;
    const pa = pathAt( f + e );
    const pb = pathAt( f - e );
    const pc = pathAt( f );
    const acc = [
      pa[ 0 ] + pb[ 0 ] - 2 * pc[ 0 ],
      0,
      pa[ 2 ] + pb[ 2 ] - 2 * pc[ 2 ]
    ];
    const fwd0 = norm3(
      [
        camTarget[ 0 ] - camPos[ 0 ],
        camTarget[ 1 ] - camPos[ 1 ],
        camTarget[ 2 ] - camPos[ 2 ]
      ],
      [
        0,
        0,
        -1
      ]
    );
    const right0 = norm3(
      [
        fwd0[ 2 ],
        0,
        -fwd0[ 0 ]
      ],
      [
        1,
        0,
        0
      ]
    );
    const lat = acc[ 0 ] * right0[ 0 ] + acc[ 2 ] * right0[ 2 ];

    roll = Math.min(
      Math.max(
        -bank * lat * 6,
        -0.9
      ),
      0.9
    );
  } else {
    // Orbit / top: circle the plate centre, optionally tracking the head.
    const elevation = view === "top"
      ? 1.5
      : Math.min(
        Math.max(
          camera.elevation ?? 0.72,
          0.12
        ),
        1.5
      );
    const orbitTurnsInt = Math.round( camera.orbitTurns ?? 0 );
    const az = ( camera.orbitPhase ?? 0.6 )
      + p.TAU * orbitTurnsInt * animation.progression;
    const dist = ( camera.distance ?? 1.45 ) * ( gridRadius + 1.4 );
    const trackHead = Math.min(
      Math.max(
        camera.trackHead ?? 0,
        0
      ),
      1
    );

    camPos = [
      Math.cos( elevation ) * Math.cos( az ) * dist,
      Math.sin( elevation ) * dist,
      Math.cos( elevation ) * Math.sin( az ) * dist
    ];
    camTarget = [
      headSmooth[ 0 ] * trackHead,
      0.1 + ( headSmooth[ 1 ] - 0.1 ) * trackHead,
      headSmooth[ 2 ] * trackHead
    ];
  }

  // Look-at basis (+ roll), uploaded whole so the shader stays trivial.
  const fwd = norm3(
    [
      camTarget[ 0 ] - camPos[ 0 ],
      camTarget[ 1 ] - camPos[ 1 ],
      camTarget[ 2 ] - camPos[ 2 ]
    ],
    [
      0,
      0,
      -1
    ]
  );
  const rightRaw = norm3(
    [
      fwd[ 2 ],
      0,
      -fwd[ 0 ]
    ],
    [
      1,
      0,
      0
    ]
  );
  const upRaw = [
    rightRaw[ 1 ] * fwd[ 2 ] - rightRaw[ 2 ] * fwd[ 1 ],
    rightRaw[ 2 ] * fwd[ 0 ] - rightRaw[ 0 ] * fwd[ 2 ],
    rightRaw[ 0 ] * fwd[ 1 ] - rightRaw[ 1 ] * fwd[ 0 ]
  ];
  const cr = Math.cos( roll );
  const sr = Math.sin( roll );
  const right = [
    rightRaw[ 0 ] * cr + upRaw[ 0 ] * sr,
    rightRaw[ 1 ] * cr + upRaw[ 1 ] * sr,
    rightRaw[ 2 ] * cr + upRaw[ 2 ] * sr
  ];
  const up = [
    upRaw[ 0 ] * cr - rightRaw[ 0 ] * sr,
    upRaw[ 1 ] * cr - rightRaw[ 1 ] * sr,
    upRaw[ 2 ] * cr - rightRaw[ 2 ] * sr
  ];

  const fov = camera.fov ?? 55;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );

  // ── Target-hole telegraph ──────────────────────────────────────────────────
  // The ring around the head's next hole brightens as the crossing approaches.
  const nextIdx = ( ( Math.ceil( f ) % crossings ) + crossings ) % crossings;
  const targetArc = arcs[ nextIdx ];
  const ft = f - Math.floor( f );
  const anticipation = ft * ft * ( 3 - 2 * ft );

  // ── Splash on every crossing ───────────────────────────────────────────────
  // The head crosses the plate each time f passes an integer. Wrap-aware (the
  // loop seam jumps f by exactly `crossings`), silent on big scrubs, and the
  // hole's position places the splash in the stereo field. Emerging crossings
  // whoosh brighter than dives.
  if ( lastCrossU === null ) {
    lastCrossU = f;
  } else if ( f !== lastCrossU ) {
    let delta = f - lastCrossU;

    if ( delta > crossings / 2 ) {
      delta -= crossings;
    } else if ( delta < -crossings / 2 ) {
      delta += crossings;
    }

    const crossed = Math.floor( f ) - Math.floor( f - delta );

    if ( ( sound.splashEnabled ?? true )
      && crossed !== 0
      && Math.abs( crossed ) <= 2 ) {
      const c = delta > 0 ? Math.floor( f ) : Math.ceil( f );
      const ci = ( ( c % crossings ) + crossings ) % crossings;
      const arc = arcs[ ci ];
      const emerging = arc.amp > 0;
      const panNorm = holeReachX > 1e-4 ? arc.hole.x / holeReachX : 0;

      audio.trigger(
        "whoosh",
        {
          duration: sound.splashLength ?? 0.5,
          freq: 520 * ( sound.splashPitch ?? 1 ) * ( emerging ? 1.2 : 0.82 ),
          gain: 0.55 * ( sound.splashVolume ?? 0.6 ),
          pan: panNorm * ( sound.splashPan ?? 0.7 )
        }
      );
    }

    lastCrossU = f;
  }

  // ── Constant dragon hum (same seamless grain bed as v2) ────────────────────
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
      const head = pathAt( f );

      audio.trigger(
        "drone",
        {
          duration: grainSpacing * 2.2,
          freq: 175 * humPitch * wobble,
          gain: 0.4 * ( sound.humVolume ?? 0.45 ),
          sub: 0.4,
          pan: Math.min(
            Math.max(
              ( holeReachX > 1e-4 ? head[ 0 ] / holeReachX : 0 ) * 0.8,
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

  const az = light.azimuth ?? -0.9;
  const el = light.elevation ?? 0.85;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  // ── Seamless hues ──────────────────────────────────────────────────────────
  // Time scroll: whole palette periods per loop (v2's bookkeeping). The hue
  // shift ALONG the body is anchored to the head, so it needs no quantising —
  // it is converted so the slider counts whole hue waves over the body.
  const hueSpread = colors.hueSpread ?? 1.55;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );
  const hueSpeedPhase = hueSpread ? ( t * hueCycles ) / ( p.TAU * hueSpread ) : 0;
  const lengthHueShift = hueSpread
    ? ( colors.bodyHueWaves ?? 1.5 ) / ( bodyLen * hueSpread )
    : 0;

  const flatten = (
    key, size
  ) => {
    const out = [];

    for ( let i = 0; i < MAX_SEQ; i++ ) {
      const arc = arcs[ i % crossings ];

      out.push( ...key( arc ) );
    }

    return out.slice(
      0,
      MAX_SEQ * size
    );
  };

  scene.render( {
    columns: 1,
    rows: 1,
    resolutionScale: camera.quality ?? 0.8,
    uniforms: {
      uSeqLen: crossings,
      uHead: f,
      uBodyLen: bodyLen,
      uArcP: {
        vec4v: flatten(
          ( arc ) => [
            arc.p0[ 0 ],
            arc.p0[ 1 ],
            arc.p1[ 0 ],
            arc.p1[ 1 ]
          ],
          4
        )
      },
      uArcM: {
        vec4v: flatten(
          ( arc ) => [
            arc.m0[ 0 ],
            arc.m0[ 1 ],
            arc.m1[ 0 ],
            arc.m1[ 1 ]
          ],
          4
        )
      },
      uArcE: {
        vec4v: flatten(
          ( arc ) => [
            arc.amp,
            arc.tag,
            0,
            0
          ],
          4
        )
      },
      uHes: hesitation,
      uSwimAmp: [
        swimAmpX,
        swimAmpZ
      ],
      uSwimFreq: swimFreq,
      uSwimT: swimT,
      uSwimPhase: swimPhase,
      uSwimDip: swimDip,
      uPipeRadius: pipeRadius,
      uTailLen: tailLen,
      uHeadBulge: headBulge,
      uHeadLen: headLen,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseT: t * pulseTravelInt,
      uBoundPad: boundPad,
      uLip: lipschitz,
      uPipeCount: pipeCount,
      uBraidRadius: braidRadius,
      uBraidMerge: braidMerge,
      uTwist: twist,
      uSpin: t * spinTurns,
      uPipeHueShift: colors.pipeHueShift ?? 0.33,
      uPlaneHalf: [
        planeHalfX,
        planeHalfZ
      ],
      uGridCols: cols,
      uGridRows: rows,
      uHoleRadius: holeRadius,
      uPlaneThick: plate.thickness ?? 0.1,
      uGlassColor: ( plate.color ?? [
        150,
        190,
        235
      ] ).map( ( v ) => v / 255 ),
      uGlassAlpha: plate.alpha ?? 0.55,
      uGlassEdge: plate.edgeSoftness ?? 0.02,
      uGlassFrost: plate.frost ?? 0.45,
      uFrostScale: plate.frostScale ?? 7,
      uGlassMilk: plate.milk ?? 0.5,
      uGlassTint: plate.tint ?? 0.12,
      uEdgeGlow: plate.holeGlow ?? 0.9,
      uBorderGlow: plate.borderGlow ?? 0.6,
      uTargetHole: [
        targetArc.hole.x,
        targetArc.hole.z
      ],
      uTargetGlow: ( plate.targetGlow ?? 1.2 ) * ( 0.25 + 0.75 * anticipation ),
      uTargetTag: targetArc.tag,
      uShadow: plate.shadow ?? 0.55,
      uShadowSoft: plate.shadowSoft ?? 0.35,
      uDepthDim: plate.depthDim ?? 0.55,
      uCamPos: camPos,
      uCamFwd: fwd,
      uCamRight: right,
      uCamUp: up,
      uFocal: focal,
      uHueSpeed: hueSpeedPhase,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 1.17,
      uLengthHueShift: lengthHueShift,
      uShimmer: colors.shimmer ?? 1.1,
      uSaturation: colors.saturation ?? 0.9,
      uBrightness: colors.brightness ?? 1.05,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 1,
      uSpecular: light.specular ?? 0.6,
      uSpecPower: light.specPower ?? 24,
      uFresnelPower: light.fresnelPower ?? 2.5,
      uRimStrength: light.rimStrength ?? 0.5,
      uFogDensity: o.fogDensity ?? 0.05,
      uBgColor: ( o.backgroundColor ?? [
        6,
        8,
        16
      ] ).map( ( v ) => v / 255 ),
      uBoundMin: [
        -( holeReachX + reachPad ),
        -( maxAmp + maxR + 0.1 ),
        -( holeReachZ + reachPad )
      ],
      uBoundMax: [
        holeReachX + reachPad,
        maxAmp + maxR + 0.1,
        holeReachZ + reachPad
      ]
    }
  } );
} );
