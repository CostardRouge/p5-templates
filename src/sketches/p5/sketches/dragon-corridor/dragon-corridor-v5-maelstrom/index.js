import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import audio from "@/p5/utils/audio.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// dragon-corridor v5 — "maelström". A funnel of light, and dragons caught in
// it: the ONE dragon circling inside a reference cell is replicated into an
// infinite procession of self-similar copies — each one rotated by a swirl
// offset and shrunk by a fixed factor per depth octave — spiralling forever
// down the throat of the vortex. Deeper copies are smaller, darker, hue-
// shifted, until the drain swallows them.
//
//   • Perpetual fall, perfect loop — the whole ensemble is advanced by
//     exactly ONE whole screw step (rotate α, shrink σ) per loop (the
//     infinite-zoom trick): at the seam every copy lands exactly where the
//     next one started, so the fall never ends and never jumps. The wall is
//     a cone through the apex — the one surface invariant under that screw —
//     and its glowing spiral arms are phase-locked to the same screw, so
//     they stream into the drain seamlessly too.
//
//   • The dance — the v4 waypoint machinery bent into a ring: K seeded
//     waypoints circle the axis once per loop (radius and height wobbling,
//     swim sway on top), joined by a cyclic 3D Hermite. The dragon chases
//     its own tail around the drain while the screw drags it down.
//
//   • The march — one copy's SDF is the v3/v4 capsule chain; the ensemble is
//     evaluated by finding the point's depth octave from its radius and
//     testing the three nearest copies, each behind a cheap ring-band bound,
//     so the infinite procession costs about one evaluation. Octaves are
//     cut off in the dark of the drain, where the copies fade out anyway.
//
//   • Cameras — STATIC by default: "brink" leans over the rim (default),
//     "abyss" stares straight down the throat, "drift" is the only moving
//     one (whole orbits per loop). The vertigo comes from the scene itself.
//
// ── Looping ──────────────────────────────────────────────────────────────────
// The head advances by exactly K waypoints per loop over a cyclic ring path;
// the screw advances by a whole number of octaves per loop; per-copy depth
// effects (fade, hue drift) depend only on the continuous octave coordinate,
// which relabels onto itself at the seam; wall-arm phases shift by whole
// periods. Time-driven rates (stripe spin, pulse travel, swim travel, hue
// scroll, camera drift) are snapped to whole cycles per loop.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SEQ = 16; // max waypoints per loop (uniform array size)
const ARC_SAMPLES = 10; // tapered capsules sampled per arc
const MAX_STEPS = 90; // sphere-trace iterations per ray
const SURF_EPS = 0.0012; // hit threshold (world units)
const MAX_DIST = 40.0; // ray cutoff / far plane
const OCT_MIN = -2.0; // largest copy rendered (octaves above the cell)
const OCT_MAX = 14.0; // deepest copy rendered (the drain swallows the rest)

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) };
  const float MAX_DIST = ${ MAX_DIST.toFixed( 4 ) };

  // ── Path / sequence (one copy, in cell space) ──
  uniform float uSeqLen;      // K = waypoints per loop
  uniform float uHead;        // head parameter, in waypoints
  uniform float uBodyLen;     // body length, in waypoints (< K)
  uniform vec4  uArcP[${ MAX_SEQ }]; // xy = start waypoint, zw = end (horizontal)
  uniform vec4  uArcM[${ MAX_SEQ }]; // xy / zw = Hermite tangents (pre-scaled by flow)
  uniform vec4  uArcZ[${ MAX_SEQ }]; // x/y = start/end height, z/w = height tangents

  // ── Path shaping ──
  uniform float uPose;        // settle on each waypoint (0 = uniform glide)
  uniform vec2  uSwimAmp;     // swim sway amplitude (horizontal axes)
  uniform float uSwimFreq;    // sway spatial freq (rad per waypoint, body-anchored)
  uniform float uSwimT;       // sway travel phase (whole cycles per loop)
  uniform float uSwimPhase;   // second-axis sway phase offset

  // ── Body radii ──
  uniform float uPipeRadius;
  uniform float uTailLen;
  uniform float uHeadBulge;
  uniform float uHeadLen;
  uniform float uRadiusPulse;
  uniform float uPulseFreq;
  uniform float uPulseT;
  uniform float uBoundPad;    // CPU-computed inflation for the per-arc bound
  uniform float uLip;         // CPU-computed safety divisor for the march

  // ── Pipe braid (the v1/v2 bundle, wound around the free centreline) ──
  uniform float uPipeCount;   // pipes in the bundle (1 = plain snake)
  uniform float uBraidRadius; // bundle orbit radius (0 = pipes merged)
  uniform float uBraidMerge;  // body length over which the braid unwinds into the head
  uniform float uTwist;       // braid winding (rad per waypoint along the body)
  uniform float uSpin;        // braid rotation over time (whole turns per loop)
  uniform float uPipeHueShift;

  // ── The screw (self-similar vortex) ──
  uniform float uLogShrink;   // log σ (< 0): scale per depth octave
  uniform float uLogInvShrink; // 1 / log σ
  uniform float uAlpha;       // swirl offset per octave (radians)
  uniform float uFallPhase;   // whole-octaves-per-loop × progression
  uniform float uCellRMid;    // cell mid radius (octave estimate origin)
  uniform vec2  uCellRBand;   // cell radius band, body reach included
  uniform vec2  uCellYBand;   // cell height band, body reach included
  uniform float uDragonRMax;  // global airspace bound for all copies
  uniform float uDragonYMax;
  uniform float uDrainFade;   // per-octave brightness fade into the drain
  uniform float uOctaveHueShift; // per-octave hue drift of the copies

  // ── Funnel wall ──
  uniform float uSlope;       // wall: y = slope · radius (apex at the origin)
  uniform float uWallNorm;    // 1 / √(1 + slope²)
  uniform float uWallRim;     // bowl radius (the brink)
  uniform float uDrainHole;   // open throat radius (0 = closed)
  uniform vec3  uWallColor;
  uniform float uArms;        // spiral arm count
  uniform float uArmB;        // CPU: TAU·armPitch − arms·α (screw invariance)
  uniform float uWallAnim;    // CPU: TAU·armPitch·fallPhase (whole periods/loop)
  uniform float uArmSharp;    // arm sharpness
  uniform float uStreakGlow;  // arm brightness
  uniform float uWallHueStep; // static iridescent banding per octave
  uniform float uDrainDark;   // octave where the drain darkness takes over
  uniform float uRimGlow;     // bright lip at the brink

  // ── Camera (full basis computed on the CPU) ──
  uniform vec3  uCamPos;
  uniform vec3  uCamFwd;
  uniform vec3  uCamRight;
  uniform vec3  uCamUp;
  uniform float uFocal;

  // ── Iridescent palette (shared vocabulary with v1…v4) ──
  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uLengthHueShift;
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

  // Oil-slick / thin-film iridescence — identical palette to v1…v4.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  float segDist3(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);

    return length(pa - ba * h);
  }

  // Centreline point of arc k at local parameter u — cyclic 3D Hermite ring
  // around the axis (y up), pose warp and swim sway on top.
  vec3 arcPoint(float k, float u, vec4 P, vec4 M, vec4 Z) {
    float w = mix(u, u * u * (3.0 - 2.0 * u), uPose);
    float w2 = w * w;
    float w3 = w2 * w;
    float h00 = 2.0 * w3 - 3.0 * w2 + 1.0;
    float h10 = w3 - 2.0 * w2 + w;
    float h01 = -2.0 * w3 + 3.0 * w2;
    float h11 = w3 - w2;

    vec2 xz = P.xy * h00 + M.xy * h10 + P.zw * h01 + M.zw * h11;
    float y = Z.x * h00 + Z.z * h10 + Z.y * h01 + Z.w * h11;

    float behind = uHead - (k + u);

    xz += uSwimAmp * vec2(
      sin(behind * uSwimFreq - uSwimT),
      sin(behind * uSwimFreq - uSwimT + uSwimPhase)
    );

    return vec3(xz.x, y, xz.y);
  }

  // Analytic (unnormalised) centreline tangent at the same parameter — the
  // Hermite derivative in the ring plane and in height. Adjacent capsules
  // share their sample tangents, so the braid frame built on them is
  // CONTINUOUS along the whole body (chord-based frames would jump at every
  // joint and chop the pipes into segments).
  vec3 arcTangent(float k, float u, vec4 P, vec4 M, vec4 Z) {
    float w = mix(u, u * u * (3.0 - 2.0 * u), uPose);
    float w2 = w * w;
    float g00 = 6.0 * w2 - 6.0 * w;
    float g10 = 3.0 * w2 - 4.0 * w + 1.0;
    float g01 = -6.0 * w2 + 6.0 * w;
    float g11 = 3.0 * w2 - 2.0 * w;

    vec2 xz = P.xy * g00 + M.xy * g10 + P.zw * g01 + M.zw * g11;
    float y = Z.x * g00 + Z.z * g10 + Z.y * g01 + Z.w * g11;

    return vec3(xz.x, y, xz.y);
  }

  float pipeRadiusAt(float behind) {
    float taper = smoothstep(uBodyLen, uBodyLen - uTailLen, behind);
    float hb = behind / max(uHeadLen, 0.05);
    float r = uPipeRadius * mix(0.08, 1.0, taper);

    // The swell only appears where the braid has already merged into one
    // head — swelling separate pipes would bead them into a grape cluster.
    float mg = smoothstep(0.0, max(uBraidMerge, 0.02), behind);

    r *= 1.0 + uHeadBulge * exp(-hb * hb) * (1.0 - mg);
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
  // bundle, so the cost is independent of how many pipes there are. The frame
  // rides the SMOOTH end tangents (shared between neighbouring capsules), so
  // the pipes flow seamlessly across the joints. Slightly non-metric (taper,
  // twist) — uLip covers the shortfall.
  float braidCap(vec3 p, vec3 a, vec3 b, float bA, float bB, vec3 tA, vec3 tB) {
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

    vec3 Tm = mix(tA, tB, h);
    float tl = dot(Tm, Tm);
    vec3 T = tl > 1e-6 ? Tm * inversesqrt(tl) : ba * inversesqrt(bb);
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

  // ── Dragon SDF (one copy, cell space) — v3/v4 slot walk ───────────────────
  float mapDragonSingle(vec3 p) {
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
      vec4 Z = uArcZ[i];

      float bound = segDist3(
        p,
        vec3(P.x, Z.x, P.y),
        vec3(P.z, Z.y, P.w)
      ) - uBoundPad;

      if (bound > best) { continue; }

      vec3 prev = arcPoint(k, u0, P, M, Z);
      vec3 tPrev = arcTangent(k, u0, P, M, Z);
      float bPrev = uHead - (k + u0);

      for (int m = 1; m <= ${ ARC_SAMPLES }; m++) {
        float un = mix(u0, u1, float(m) / ${ ARC_SAMPLES.toFixed( 1 ) });
        vec3 cur = arcPoint(k, un, P, M, Z);
        vec3 tCur = arcTangent(k, un, P, M, Z);
        float bCur = uHead - (k + un);

        best = min(best, braidCap(p, prev, cur, bPrev, bCur, tPrev, tCur));
        prev = cur;
        tPrev = tCur;
        bPrev = bCur;
      }
    }

    return best / uLip;
  }

  // ── The procession: min over the self-similar copies ──────────────────────
  // A point's depth octave follows from its radius, so only the three nearest
  // copies can matter; each is gated by its ring-band bound before the full
  // capsule walk. Scaled evaluation stays an exact SDF (uniform scale).
  float mapDragons(vec3 p) {
    float rp = length(p.xz);
    float dB = max(rp - uDragonRMax, p.y - uDragonYMax);

    if (dB > 0.35) { return dB; }

    float k0 = floor(
      log(max(rp, 1e-4) / uCellRMid) * uLogInvShrink - uFallPhase + 0.5
    );
    float best = 1e9;

    for (int j = -1; j <= 1; j++) {
      float k = clamp(k0 + float(j), ${ OCT_MIN.toFixed( 1 ) }, ${ OCT_MAX.toFixed( 1 ) });
      float ll = k + uFallPhase;
      float e = exp(uLogShrink * ll);

      float bnd = max(
        max(e * uCellRBand.x - rp, rp - e * uCellRBand.y),
        max(e * uCellYBand.x - p.y, p.y - e * uCellYBand.y)
      );

      if (bnd > best) { continue; }

      float a = -uAlpha * ll;
      float ca = cos(a);
      float sa = sin(a);
      vec3 q = vec3(
        (ca * p.x - sa * p.z) / e,
        p.y / e,
        (sa * p.x + ca * p.z) / e
      );

      best = min(best, e * mapDragonSingle(q));
    }

    return best;
  }

  // Winning copy at the hit: cell-space point + its depth coordinate.
  vec4 dragonWinner(vec3 p) {
    float rp = length(p.xz);
    float k0 = floor(
      log(max(rp, 1e-4) / uCellRMid) * uLogInvShrink - uFallPhase + 0.5
    );
    float best = 1e9;
    vec4 win = vec4(p, 0.0);

    for (int j = -1; j <= 1; j++) {
      float k = clamp(k0 + float(j), ${ OCT_MIN.toFixed( 1 ) }, ${ OCT_MAX.toFixed( 1 ) });
      float ll = k + uFallPhase;
      float e = exp(uLogShrink * ll);
      float a = -uAlpha * ll;
      float ca = cos(a);
      float sa = sin(a);
      vec3 q = vec3(
        (ca * p.x - sa * p.z) / e,
        p.y / e,
        (sa * p.x + ca * p.z) / e
      );
      float d = e * mapDragonSingle(q);

      if (d < best) {
        best = d;
        win = vec4(q, ll);
      }
    }

    return win;
  }

  // Body coordinate of the closest point on the chain (cell space) and which
  // pipe of the bundle owns the hit (for its hue band).
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
      vec4 Z = uArcZ[i];

      float bound = segDist3(
        p,
        vec3(P.x, Z.x, P.y),
        vec3(P.z, Z.y, P.w)
      ) - uBoundPad;

      if (bound > best) { continue; }

      float uPrev = u0;
      vec3 prev = arcPoint(k, u0, P, M, Z);
      vec3 tPrev = arcTangent(k, u0, P, M, Z);
      float bPrev = uHead - (k + u0);

      for (int m = 1; m <= ${ ARC_SAMPLES }; m++) {
        float un = mix(u0, u1, float(m) / ${ ARC_SAMPLES.toFixed( 1 ) });
        vec3 cur = arcPoint(k, un, P, M, Z);
        vec3 tCur = arcTangent(k, un, P, M, Z);
        float bCur = uHead - (k + un);
        float d = braidCap(p, prev, cur, bPrev, bCur, tPrev, tCur);

        if (d < best) {
          best = d;

          // Recover the owning pipe from the winning capsule's fold, in the
          // same smooth-tangent frame braidCap used.
          vec3 pa = p - prev;
          vec3 ba = cur - prev;
          float bb = max(dot(ba, ba), 1e-8);
          float h = clamp(dot(pa, ba) / bb, 0.0, 1.0);
          vec3 qq = pa - ba * h;
          vec3 Tm = mix(tPrev, tCur, h);
          float tl = dot(Tm, Tm);
          vec3 T = tl > 1e-6 ? Tm * inversesqrt(tl) : ba * inversesqrt(bb);
          vec3 refUp = normalize(mix(
            vec3(0.0, 1.0, 0.0),
            vec3(1.0, 0.0, 0.0),
            smoothstep(0.8, 0.98, abs(T.y))
          ));
          vec3 fN = normalize(cross(refUp, T));
          vec3 fB = cross(T, fN);
          vec3 perp = qq - T * dot(qq, T);
          float phi = atan(dot(perp, fB), dot(perp, fN) + 1e-6);
          float behind = mix(bPrev, bCur, h);
          float psi = phi + uTwist * behind + uSpin;
          float sector = TAU / max(uPipeCount, 1.0);

          sBest = k + mix(uPrev, un, h);
          pipeBest = mod(floor(psi / sector + 0.5), max(uPipeCount, 1.0));
        }

        uPrev = un;
        prev = cur;
        tPrev = tCur;
        bPrev = bCur;
      }
    }

    return vec2(sBest, pipeBest);
  }

  // ── Funnel wall: a cone bowl with a rim and an open throat ────────────────
  float mapWall(vec3 p) {
    float rp = length(p.xz);
    float d = (p.y - uSlope * rp) * uWallNorm;

    d = max(d, rp - uWallRim);

    if (uDrainHole > 0.001) { d = max(d, uDrainHole - rp); }

    return d;
  }

  float mapScene(vec3 p) {
    return min(mapDragons(p), mapWall(p));
  }

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

  float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;

    for (int i = 0; i < 3; i++) {
      float h = 0.03 + 0.11 * float(i);
      float d = mapScene(p + n * h);

      occ += (h - d) * sca;
      sca *= 0.6;
    }

    return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
  }

  // Dragon shading — the v1/v2 pipe braid, each pipe carrying its own hue
  // band (fading into the merged head), with the copy's depth octave
  // darkening and hue-drifting it toward the drain. Depth effects depend only
  // on the continuous octave coordinate, so the loop seam just relabels them.
  vec3 shadeDragon(vec3 pos, vec3 n, vec3 rd) {
    vec4 win = dragonWinner(pos);
    vec3 q = win.xyz;
    float ll = win.w;
    vec2 info = dragonInfo(q);
    float behind = max(uHead - info.x, 0.0);
    float merge = smoothstep(0.0, max(uBraidMerge, 0.02), behind);

    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);
    float phase = behind * uLengthHueShift + uHueSpeed
      + info.y * uPipeHueShift * merge
      + ll * uOctaveHueShift;
    vec3 base = iridescent(phase + uShimmer * fres);

    float diff = max(dot(n, uLightDir), 0.0);
    vec3 hlf = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = calcAO(pos, n);

    vec3 col = base * (uAmbient + uDiffuse * diff * ao);

    col += base * fres * uRimStrength;
    col += vec3(spec) * ao;

    // Swallowed by the drain: deeper octaves fade to black.
    col *= exp(-max(ll, 0.0) * uDrainFade);

    return col;
  }

  // Wall shading — glowing spiral arms streaming into the throat. The arm
  // phase is built to be invariant under the screw (uArmB) and its animation
  // shifts by whole periods per loop (uWallAnim), so the streaming loops.
  vec3 shadeWall(vec3 pos, vec3 n, vec3 rd) {
    float rp = max(length(pos.xz), 1e-4);
    float theta = atan(pos.z, pos.x);
    float oct = log(rp / uCellRMid) * uLogInvShrink;

    float phase = uArms * theta + uArmB * oct + uWallAnim;
    float streak = pow(0.5 + 0.5 * cos(phase), uArmSharp);

    // Static iridescent banding by depth octave, tempered toward the wall
    // colour so the bowl stays deep; darkness eats the throat.
    vec3 glass = mix(uWallColor * 1.6, iridescent(oct * uWallHueStep + 0.2), 0.55);
    float drain = 1.0 - smoothstep(uDrainDark, uDrainDark + 2.5, oct);
    float lip = exp(-abs(rp - uWallRim) * 3.0) * uRimGlow;

    float diff = max(dot(n, uLightDir), 0.0);
    vec3 col = uWallColor * (0.25 + 0.75 * diff) * drain;

    col += glass * streak * uStreakGlow * drain;
    col += glass * lip;

    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);

    col += uWallColor * fres * 0.35;

    return col;
  }

  vec4 traceScene(vec3 ro, vec3 rd) {
    float t = 0.0;
    bool hit = false;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
      vec3 pos = ro + rd * t;
      float d = mapScene(pos);

      if (d < SURF_EPS) { hit = true; break; }

      t += d;

      if (t > MAX_DIST) { break; }
    }

    if (!hit) { return vec4(uBgColor, MAX_DIST); }

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);

    vec3 col = mapDragons(pos) < mapWall(pos)
      ? shadeDragon(pos, n, rd)
      : shadeWall(pos, n, rd);

    float fog = exp(-uFogDensity * t);

    return vec4(mix(uBgColor, col, fog), t);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 ro = uCamPos;
    vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);

    vec4 opaque = traceScene(ro, rd);

    // Escaped rays (sky above the rim, the void through the open throat) stay
    // transparent so the p5 background shows through.
    float alpha = opaque.a < MAX_DIST ? 1.0 : 0.0;

    gl_FragColor = vec4(opaque.rgb, alpha);
  }
`;

const scene = createNoiseFieldRenderer( FRAGMENT );

// ── CPU side ─────────────────────────────────────────────────────────────────

// Deterministic xorshift32 — identical sequences on every platform.
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

// Seeded ring of waypoints circling the axis once: angles sweep the full
// turn, radii wobble around the cell (alternating in/out when weave is on),
// heights ride the funnel wall with a hover gap. Cyclic 3D Hermite.
function buildArcs( {
  waypoints,
  seed,
  rMid,
  rSpread,
  slope,
  hover,
  heightJitter,
  weave,
  flow
} ) {
  const rng = makeRng( seed );
  const points = [];

  for ( let k = 0; k < waypoints; k++ ) {
    const theta = ( ( k + ( rng() - 0.5 ) * 0.55 ) / waypoints ) * Math.PI * 2;

    let radius;

    if ( weave ) {
      radius = k % 2 === 0
        ? rMid - rSpread * ( 0.35 + 0.65 * rng() )
        : rMid + rSpread * ( 0.35 + 0.65 * rng() );
    } else {
      radius = rMid + rSpread * ( rng() * 2 - 1 );
    }

    points.push( {
      x: radius * Math.cos( theta ),
      z: radius * Math.sin( theta ),
      y: slope * radius + hover + heightJitter * ( rng() * 2 - 1 ),
      radius
    } );
  }

  const arcs = [];

  for ( let k = 0; k < waypoints; k++ ) {
    const prev = points[ ( k - 1 + waypoints ) % waypoints ];
    const a = points[ k ];
    const b = points[ ( k + 1 ) % waypoints ];
    const next = points[ ( k + 2 ) % waypoints ];

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
      z0: a.y,
      z1: b.y,
      mz0: 0.5 * flow * ( b.y - prev.y ),
      mz1: 0.5 * flow * ( next.y - a.y ),
      point: a
    } );
  }

  return arcs;
}

// Waypoint-crossing bookkeeping for the eddy whoosh (wrap-aware, as in v3/v4).
let lastCrossU = null;

// Index of the last fired hum grain (the family's seamless drone bed).
let lastGrainIndex = null;

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const vortex = o.vortex ?? {};
  const path = o.path ?? {};
  const dragon = o.dragon ?? {};
  const wall = o.wall ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const sound = o.sound ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    4,
    5,
    12
  ] ) );

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;

  // ── The screw ──────────────────────────────────────────────────────────────
  const shrink = Math.min(
    Math.max(
      vortex.shrink ?? 0.78,
      0.5
    ),
    0.94
  );
  const alpha = vortex.swirlOffset ?? 2.4;
  const plungeInt = Math.max(
    1,
    Math.round( vortex.fallSpeed ?? 1 )
  );
  const fallPhase = animation.progression * plungeInt;
  const logShrink = Math.log( shrink );

  // ── Loop-exact clock ───────────────────────────────────────────────────────
  const waypoints = Math.min(
    MAX_SEQ,
    Math.max(
      4,
      Math.round( path.waypointsPerLoop ?? 10 )
    )
  );
  const f = animation.progression * waypoints;

  // ── The dance (cell ring) ──────────────────────────────────────────────────
  const flow = Math.min(
    Math.max(
      path.flow ?? 0.85,
      0
    ),
    1
  );
  const pose = Math.min(
    Math.max(
      path.pose ?? 0.3,
      0
    ),
    1
  );
  const rMid = 2.0;
  const rSpread = Math.min(
    Math.max(
      vortex.ringSpread ?? 0.3,
      0.05
    ),
    0.8
  );
  const slope = Math.min(
    Math.max(
      vortex.steepness ?? 0.75,
      0.2
    ),
    2
  );
  const hover = vortex.hover ?? 0.3;
  const seed = Math.round( path.seed ?? 17 );

  const arcs = buildArcs( {
    waypoints,
    seed,
    rMid,
    rSpread,
    slope,
    hover,
    heightJitter: path.heightJitter ?? 0.15,
    weave: path.weave ?? true,
    flow
  } );

  // ── Body ───────────────────────────────────────────────────────────────────
  const bodyLen = Math.min(
    Math.max(
      dragon.bodyLength ?? 4.5,
      0.5
    ),
    waypoints - 0.55
  );
  const pipeCount = Math.min(
    Math.max(
      Math.round( dragon.pipes ?? 5 ),
      1
    ),
    8
  );
  const pipeRadius = Math.max(
    dragon.pipeRadius ?? 0.065,
    0.02
  );
  const braidRadius = Math.max(
    dragon.braidRadius ?? 0.1,
    0
  );
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
  const pulseTravelInt = Math.round( ( dragon.pulseTravel ?? -3 ) * timeScale );

  const swimWavesInt = Math.max(
    1,
    Math.round( path.swimWaves ?? 3 )
  );
  const swimFreq = ( p.TAU * swimWavesInt ) / bodyLen;
  const swimCycles = Math.round( ( path.swimSpeed ?? 2 ) * timeScale );
  const swimT = t * swimCycles;
  const swimAmpX = path.swimX ?? 0.06;
  const swimAmpY = path.swimY ?? 0.06;
  const swimPhase = path.swimPhase ?? 1.6;

  const twist = ( p.TAU * ( dragon.twist ?? 2 ) ) / bodyLen;
  const spinTurns = Math.round( ( dragon.spin ?? -2 ) * timeScale );

  // ── March safety & cell bounds ─────────────────────────────────────────────
  let maxTangent = 0;
  let minRk = Infinity;
  let maxRk = 0;
  let minYk = Infinity;
  let maxYk = 0;

  for ( const arc of arcs ) {
    maxTangent = Math.max(
      maxTangent,
      Math.hypot(
        arc.m0[ 0 ],
        arc.m0[ 1 ],
        arc.mz0
      ),
      Math.hypot(
        arc.m1[ 0 ],
        arc.m1[ 1 ],
        arc.mz1
      )
    );
    minRk = Math.min(
      minRk,
      arc.point.radius
    );
    maxRk = Math.max(
      maxRk,
      arc.point.radius
    );
    minYk = Math.min(
      minYk,
      arc.point.y
    );
    maxYk = Math.max(
      maxYk,
      arc.point.y
    );
  }

  const swimLen = Math.hypot(
    swimAmpX,
    swimAmpY
  );
  const maxR = braidRadius
    + pipeRadius * ( 1 + headBulge ) * ( 1 + radiusPulse );
  const overshoot = ( 8 / 27 ) * maxTangent;
  const reach = overshoot + swimLen + maxR + 0.05;

  // Lipschitz divisor: taper/pulse slopes plus the braid's own twist gradient
  // (pipe positions rotate along the body, steepening the field between pipes).
  let minChord = Infinity;

  for ( const arc of arcs ) {
    minChord = Math.min(
      minChord,
      Math.hypot(
        arc.p1[ 0 ] - arc.p0[ 0 ],
        arc.p1[ 1 ] - arc.p0[ 1 ],
        arc.z1 - arc.z0
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

  // Biggest rendered copy (OCT_MIN octaves above the cell) sets the airspace.
  const biggest = Math.pow(
    shrink,
    -2
  );
  const dragonRMax = ( maxRk + reach ) * biggest + 0.1;
  const dragonYMax = ( maxYk + reach ) * biggest + 0.1;

  // ── Funnel wall ────────────────────────────────────────────────────────────
  const wallRim = wall.rim ?? 4.2;
  const armsInt = Math.max(
    1,
    Math.round( wall.arms ?? 3 )
  );
  const armPitchInt = Math.round( wall.armPitch ?? 2 );
  const armB = p.TAU * armPitchInt - armsInt * alpha;
  const wallAnim = p.TAU * armPitchInt * fallPhase;

  // ── Camera (static by default) ─────────────────────────────────────────────
  // Same fit convention as v4: distance = 1 frames the whole bowl.
  const view = camera.view ?? "brink";
  const fov = camera.fov ?? 50;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );
  const dist = ( camera.distance ?? 1 ) * 1.7 * focal * wallRim;

  let elevation;
  let azimuth = camera.azimuth ?? 0.6;

  if ( view === "abyss" ) {
    elevation = 1.5;
  } else {
    elevation = Math.min(
      Math.max(
        camera.elevation ?? 0.95,
        0.25
      ),
      1.5
    );
  }

  if ( view === "drift" ) {
    const driftTurnsInt = Math.round( camera.driftTurns ?? 1 );

    azimuth += p.TAU * driftTurnsInt * animation.progression;
  }

  const target = [
    0,
    slope * wallRim * 0.3,
    0
  ];
  const camPos = [
    target[ 0 ] + Math.cos( elevation ) * Math.sin( azimuth ) * dist,
    target[ 1 ] + Math.sin( elevation ) * dist,
    target[ 2 ] + Math.cos( elevation ) * Math.cos( azimuth ) * dist
  ];

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

  const fwd = norm3(
    [
      target[ 0 ] - camPos[ 0 ],
      target[ 1 ] - camPos[ 1 ],
      target[ 2 ] - camPos[ 2 ]
    ],
    [
      0,
      -1,
      0
    ]
  );
  const right = norm3(
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
  const up = [
    right[ 1 ] * fwd[ 2 ] - right[ 2 ] * fwd[ 1 ],
    right[ 2 ] * fwd[ 0 ] - right[ 0 ] * fwd[ 2 ],
    right[ 0 ] * fwd[ 1 ] - right[ 1 ] * fwd[ 0 ]
  ];

  // ── Eddy whoosh on every waypoint pass ─────────────────────────────────────
  // The head sweeping past each ring waypoint stirs a soft airy eddy: pitch
  // rises for the inner poses (closer to the drain), pan follows the home
  // copy. Wrap-aware, silent on big scrubs.
  if ( lastCrossU === null ) {
    lastCrossU = f;
  } else if ( f !== lastCrossU ) {
    let delta = f - lastCrossU;

    if ( delta > waypoints / 2 ) {
      delta -= waypoints;
    } else if ( delta < -waypoints / 2 ) {
      delta += waypoints;
    }

    const crossed = Math.floor( f ) - Math.floor( f - delta );

    if ( ( sound.eddyEnabled ?? true )
      && crossed !== 0
      && Math.abs( crossed ) <= 2 ) {
      const c = delta > 0 ? Math.floor( f ) : Math.ceil( f );
      const ci = ( ( c % waypoints ) + waypoints ) % waypoints;
      const wp = arcs[ ci ].point;
      const inward = 1 - ( wp.radius - ( rMid - rSpread ) ) / Math.max(
        2 * rSpread,
        0.01
      );

      audio.trigger(
        "whoosh",
        {
          duration: sound.eddyLength ?? 0.7,
          freq: 420 * ( sound.eddyPitch ?? 1 ) * ( 0.8 + 0.5 * inward ),
          gain: 0.5 * ( sound.eddyVolume ?? 0.6 ),
          pan: Math.min(
            Math.max(
              ( wp.x / rMid ) * ( sound.eddyPan ?? 0.7 ),
              -1
            ),
            1
          )
        }
      );
    }

    lastCrossU = f;
  }

  // ── Constant maelström roar (the family hum bed, pitched low) ──────────────
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
      const humPitch = sound.humPitch ?? 0.7;
      const wobble = 1 + 0.1 * Math.sin( swimT );

      audio.trigger(
        "drone",
        {
          duration: grainSpacing * 2.2,
          freq: 150 * humPitch * wobble,
          gain: 0.4 * ( sound.humVolume ?? 0.5 ),
          sub: 0.55,
          pan: 0
        }
      );
    }
  } else {
    lastGrainIndex = null;
  }

  const az = light.azimuth ?? 2.4;
  const el = light.elevation ?? 0.9;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  // ── Seamless hues (family bookkeeping) ─────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 1.55;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );
  const hueSpeedPhase = hueSpread ? ( t * hueCycles ) / ( p.TAU * hueSpread ) : 0;
  const lengthHueShift = hueSpread
    ? ( colors.bodyHueWaves ?? 1.5 ) / ( bodyLen * hueSpread )
    : 0;

  const flatten = ( key ) => {
    const out = [];

    for ( let i = 0; i < MAX_SEQ; i++ ) {
      out.push( ...key( arcs[ i % waypoints ] ) );
    }

    return out;
  };

  scene.render( {
    columns: 1,
    rows: 1,
    resolutionScale: camera.quality ?? 0.75,
    uniforms: {
      uSeqLen: waypoints,
      uHead: f,
      uBodyLen: bodyLen,
      uArcP: {
        vec4v: flatten( ( arc ) => [
          arc.p0[ 0 ],
          arc.p0[ 1 ],
          arc.p1[ 0 ],
          arc.p1[ 1 ]
        ] )
      },
      uArcM: {
        vec4v: flatten( ( arc ) => [
          arc.m0[ 0 ],
          arc.m0[ 1 ],
          arc.m1[ 0 ],
          arc.m1[ 1 ]
        ] )
      },
      uArcZ: {
        vec4v: flatten( ( arc ) => [
          arc.z0,
          arc.z1,
          arc.mz0,
          arc.mz1
        ] )
      },
      uPose: pose,
      uSwimAmp: [
        swimAmpX,
        swimAmpY
      ],
      uSwimFreq: swimFreq,
      uSwimT: swimT,
      uSwimPhase: swimPhase,
      uPipeRadius: pipeRadius,
      uTailLen: tailLen,
      uHeadBulge: headBulge,
      uHeadLen: headLen,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseT: t * pulseTravelInt,
      uBoundPad: reach,
      uLip: lipschitz,
      uPipeCount: pipeCount,
      uBraidRadius: braidRadius,
      uBraidMerge: braidMerge,
      uTwist: twist,
      uSpin: t * spinTurns,
      uPipeHueShift: colors.pipeHueShift ?? 0.33,
      uLogShrink: logShrink,
      uLogInvShrink: 1 / logShrink,
      uAlpha: alpha,
      uFallPhase: fallPhase,
      uCellRMid: rMid,
      uCellRBand: [
        Math.max(
          minRk - reach,
          0.05
        ),
        maxRk + reach
      ],
      uCellYBand: [
        Math.max(
          minYk - reach,
          0
        ),
        maxYk + reach
      ],
      uDragonRMax: dragonRMax,
      uDragonYMax: dragonYMax,
      uDrainFade: vortex.drainFade ?? 0.28,
      uOctaveHueShift: vortex.octaveHueShift ?? 0.12,
      uSlope: slope,
      uWallNorm: 1 / Math.sqrt( 1 + slope * slope ),
      uWallRim: wallRim,
      uDrainHole: wall.drainHole ?? 0.3,
      uWallColor: ( wall.color ?? [
        30,
        42,
        70
      ] ).map( ( v ) => v / 255 ),
      uArms: armsInt,
      uArmB: armB,
      uWallAnim: wallAnim,
      uArmSharp: wall.armSharpness ?? 5,
      uStreakGlow: wall.streakGlow ?? 0.8,
      uWallHueStep: wall.hueStep ?? 0.09,
      uDrainDark: wall.drainDarkness ?? 3,
      uRimGlow: wall.rimGlow ?? 0.5,
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
      uFogDensity: o.fogDensity ?? 0.02,
      uBgColor: ( o.backgroundColor ?? [
        4,
        5,
        12
      ] ).map( ( v ) => v / 255 )
    }
  } );
} );
