import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import audio from "@/p5/utils/audio.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// dragon-corridor v4 — "mandala". The dragon becomes the entire scene: a
// kaleidoscope chamber folds space around the z axis, so the ONE dragon
// dancing inside a single angular cell is replicated into a living rosette of
// iridescent dragons in perfect N-fold (optionally mirrored) symmetry — a
// rose window whose tracery is alive.
//
//   • The fold — polar domain folding in the fragment shader. The dragon's
//     path is generated INSIDE one cell (a wedge of TAU/sectors, or half that
//     with mirror symmetry on), and every marched sample point is folded back
//     into that cell before evaluating the v3-style capsule-chain SDF. Near
//     the two cell borders the folded evaluation alone would overestimate the
//     distance to the neighbouring copies (crack artifacts exactly where
//     twins kiss), so the two mirror/rotation neighbours are ALSO evaluated —
//     but only when a cheap plane-distance gate says they could be closer
//     than the best so far, which keeps the usual cost at ~one evaluation.
//
//   • The dance — a seeded chain of K waypoints per loop inside the cell
//     (radius alternating inner/outer for a petalled rhythm, plus a little
//     depth relief), joined by a cyclic 3D Hermite spline. "pose" makes the
//     dragon settle on each waypoint before whipping to the next — the
//     mandala repeatedly locks into a figure, holds it, and dissolves it —
//     while "flow" rounds the whole dance into one continuous calligraphy.
//
//   • The rose window — an analytic stained-glass disc behind the dragons
//     (the v2/v3 frosted vocabulary): iridescent cells by ring and folded
//     angle, dark lead lines with a glow option along every ring and sector
//     seam, a bright hub, and the dragons casting their own coloured light
//     onto the glass as they pass.
//
//   • Cameras — STATIC by default: "facade" looks at the rosette dead-on like
//     a rose window; "oblique" is a fixed three-quarter view that reveals the
//     depth relief; "drift" is the only moving one (whole orbits per loop,
//     for those who want motion). The mandala's own rotation is a separate
//     whole-turns-per-loop option, 0 by default.
//
// ── Looping ──────────────────────────────────────────────────────────────────
// The head advances by exactly K waypoints per loop over a cyclic path, and
// every pattern on the body (pulse, swim, hue) is anchored to the head, so
// loop closure is automatic. Time-driven rates (braid spin, pulse travel,
// swim travel, hue scroll, mandala spin, camera drift) are snapped to whole
// cycles per loop, so the last frame reproduces the first.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SEQ = 16; // max waypoints per loop (uniform array size)
const ARC_SAMPLES = 9; // tapered capsules sampled per arc
const MAX_STEPS = 88; // sphere-trace iterations per ray
const SURF_EPS = 0.0012; // hit threshold (world units)
const MAX_DIST = 30.0; // ray cutoff / far plane

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) };
  const float MAX_DIST = ${ MAX_DIST.toFixed( 4 ) };

  // ── Path / sequence ──
  uniform float uSeqLen;      // K = waypoints per loop
  uniform float uHead;        // head parameter, in waypoints
  uniform float uBodyLen;     // body length, in waypoints (< K)
  uniform vec4  uArcP[${ MAX_SEQ }]; // xy = start waypoint, zw = end (cell plane)
  uniform vec4  uArcM[${ MAX_SEQ }]; // xy / zw = Hermite tangents (pre-scaled by flow)
  uniform vec4  uArcZ[${ MAX_SEQ }]; // x/y = start/end depth, z/w = depth tangents

  // ── Path shaping ──
  uniform float uPose;        // settle on each waypoint (0 = uniform glide)
  uniform vec2  uSwimAmp;     // swim sway amplitude (cell x, y)
  uniform float uSwimFreq;    // sway spatial freq (rad per waypoint, body-anchored)
  uniform float uSwimT;       // sway travel phase (whole cycles per loop)
  uniform float uSwimPhase;   // second-axis sway phase offset

  // ── Body radii ──
  uniform float uPipeRadius;
  uniform float uTailLen;     // waypoints over which the tail tapers away
  uniform float uHeadBulge;   // head swell amount
  uniform float uHeadLen;     // head swell falloff (waypoints behind the head)
  uniform float uRadiusPulse; // travelling swell of the body radius
  uniform float uPulseFreq;   // swell spatial freq (rad per waypoint)
  uniform float uPulseT;      // swell travel phase (whole cycles per loop)
  uniform float uBoundPad;    // CPU-computed inflation for the per-arc bound
  uniform float uLip;         // CPU-computed safety divisor for the march

  // ── Pipe braid (the v1/v2 bundle, wound around the free centreline) ──
  uniform float uPipeCount;   // pipes in the bundle (1 = plain snake)
  uniform float uBraidRadius; // bundle orbit radius (0 = pipes merged)
  uniform float uBraidMerge;  // body length over which the braid unwinds into the head
  uniform float uTwist;       // braid winding (rad per waypoint along the body)
  uniform float uSpin;        // braid rotation over time (whole turns per loop)
  uniform float uPipeHueShift;

  // ── Kaleidoscope fold ──
  uniform float uSectorAngle; // TAU / sectors
  uniform float uCellAngle;   // canonical cell: sector (rotation) or sector/2 (mirror)
  uniform float uMirror;      // 1 = dihedral (mirrored) symmetry
  uniform float uMandalaSpin; // whole-turns-per-loop rotation of the whole rosette
  uniform float uSectorHueShift; // per-sector hue offset (0 = uniform copies)
  uniform float uRInner;      // dragon annulus bounds for the march early-out
  uniform float uROuter;
  uniform float uZPad;

  // ── Rose window (stained-glass backdrop) ──
  uniform float uBackAlpha;
  uniform float uBackDepth;   // plane sits at z = −uBackDepth
  uniform float uBackRadius;
  uniform float uRings;       // stained-glass rings across the disc
  uniform float uBackHueShift;
  uniform float uBackHuePhase;
  uniform float uBackBrightness;
  uniform float uCenterGlow;  // bright hub, light through the window
  uniform float uLeadDark;    // dark lead lines on ring/sector seams
  uniform float uLeadGlow;    // glowing rim on those same seams
  uniform float uGlassFrost;
  uniform float uFrostScale;
  uniform float uDragonGlow;  // coloured light the dragons cast on the glass

  // ── Camera (full basis computed on the CPU) ──
  uniform vec3  uCamPos;
  uniform vec3  uCamFwd;
  uniform vec3  uCamRight;
  uniform vec3  uCamUp;
  uniform float uFocal;

  // ── Iridescent palette (shared vocabulary with v1/v2/v3) ──
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

  // Oil-slick / thin-film iridescence — identical palette to v1/v2/v3.
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

  // Centreline point of arc k at local parameter u — cyclic 3D Hermite inside
  // the cell, with the pose warp (settle on each waypoint) and the swim sway.
  vec3 arcPoint(float k, float u, vec4 P, vec4 M, vec4 Z) {
    float w = mix(u, u * u * (3.0 - 2.0 * u), uPose);
    float w2 = w * w;
    float w3 = w2 * w;
    float h00 = 2.0 * w3 - 3.0 * w2 + 1.0;
    float h10 = w3 - 2.0 * w2 + w;
    float h01 = -2.0 * w3 + 3.0 * w2;
    float h11 = w3 - w2;

    vec2 xy = P.xy * h00 + M.xy * h10 + P.zw * h01 + M.zw * h11;
    float z = Z.x * h00 + Z.z * h10 + Z.y * h01 + Z.w * h11;

    float behind = uHead - (k + u);

    xy += uSwimAmp * vec2(
      sin(behind * uSwimFreq - uSwimT),
      sin(behind * uSwimFreq - uSwimT + uSwimPhase)
    );

    return vec3(xy, z);
  }

  // Pipe radius at a distance behind the head — tail taper, head swell,
  // travelling pulse. Body-anchored, so the loop closes by construction.
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

  // ── Dragon SDF (one copy, evaluated in cell space) ────────────────────────
  // Same slot walk as v3: each uniform slot hosts at most one active arc
  // k ≡ i (mod K) because the body is shorter than the loop, so the arrays
  // are only ever indexed by the loop variable (WebGL1-safe).
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
        vec3(P.xy, Z.x),
        vec3(P.zw, Z.y)
      ) - uBoundPad;

      if (bound > best) { continue; }

      vec3 prev = arcPoint(k, u0, P, M, Z);
      float bPrev = uHead - (k + u0);

      for (int m = 1; m <= ${ ARC_SAMPLES }; m++) {
        float un = mix(u0, u1, float(m) / ${ ARC_SAMPLES.toFixed( 1 ) });
        vec3 cur = arcPoint(k, un, P, M, Z);
        float bCur = uHead - (k + un);

        best = min(best, braidCap(p, prev, cur, bPrev, bCur));
        prev = cur;
        bPrev = bCur;
      }
    }

    return best / uLip;
  }

  // ── Kaleidoscope fold ─────────────────────────────────────────────────────
  // Fold the sample point into the canonical cell and evaluate the single
  // dragon there; the two neighbouring copies (across each cell border) are
  // evaluated only when the exact distance-to-border gate says they could
  // beat the current best — the fold stays crack-free where twins touch, at
  // ~one evaluation almost everywhere.
  float mapScene(vec3 p) {
    float c = cos(uMandalaSpin);
    float s = sin(uMandalaSpin);
    vec2 xy = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
    float r = length(xy);

    // Conservative annulus bound — big cheap steps through empty space.
    float bound = max(max(r - uROuter, uRInner - r), abs(p.z) - uZPad);

    if (bound > 0.3) { return bound; }

    float ang = atan(xy.y, xy.x);
    float a0 = mod(ang, uSectorAngle);
    float am = uMirror > 0.5 ? min(a0, uSectorAngle - a0) : a0;
    float rep0 = uMirror > 0.5 ? -am : a0 + uSectorAngle;
    float rep1 = uMirror > 0.5 ? uSectorAngle - am : a0 - uSectorAngle;

    float d = mapDragonSingle(vec3(r * cos(am), r * sin(am), p.z));

    // Neighbour across the first border (angle 0): its distance is at least
    // the distance to that border plane, so skip it when it cannot win.
    float g0 = r * sin(am);

    if (g0 < d) {
      d = min(d, mapDragonSingle(vec3(r * cos(rep0), r * sin(rep0), p.z)));
    }

    float g1 = r * sin(uCellAngle - am);

    if (g1 < d) {
      d = min(d, mapDragonSingle(vec3(r * cos(rep1), r * sin(rep1), p.z)));
    }

    return d;
  }

  // Winning folded point at the hit, for the shading walk (body coordinate,
  // pipe id). Same gating as mapScene.
  vec3 foldWinner(vec3 p) {
    float c = cos(uMandalaSpin);
    float s = sin(uMandalaSpin);
    vec2 xy = vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
    float r = length(xy);
    float ang = atan(xy.y, xy.x);
    float a0 = mod(ang, uSectorAngle);
    float am = uMirror > 0.5 ? min(a0, uSectorAngle - a0) : a0;
    float rep0 = uMirror > 0.5 ? -am : a0 + uSectorAngle;
    float rep1 = uMirror > 0.5 ? uSectorAngle - am : a0 - uSectorAngle;

    vec3 q = vec3(r * cos(am), r * sin(am), p.z);
    float d = mapDragonSingle(q);

    vec3 q0 = vec3(r * cos(rep0), r * sin(rep0), p.z);
    float d0 = r * sin(am) < d ? mapDragonSingle(q0) : 1e9;

    if (d0 < d) {
      d = d0;
      q = q0;
    }

    vec3 q1 = vec3(r * cos(rep1), r * sin(rep1), p.z);
    float d1 = r * sin(uCellAngle - am) < d ? mapDragonSingle(q1) : 1e9;

    if (d1 < d) {
      q = q1;
    }

    return q;
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
        vec3(P.xy, Z.x),
        vec3(P.zw, Z.y)
      ) - uBoundPad;

      if (bound > best) { continue; }

      float uPrev = u0;
      vec3 prev = arcPoint(k, u0, P, M, Z);
      float bPrev = uHead - (k + u0);

      for (int m = 1; m <= ${ ARC_SAMPLES }; m++) {
        float un = mix(u0, u1, float(m) / ${ ARC_SAMPLES.toFixed( 1 ) });
        vec3 cur = arcPoint(k, un, P, M, Z);
        float bCur = uHead - (k + un);
        float d = braidCap(p, prev, cur, bPrev, bCur);

        if (d < best) {
          best = d;

          // Recover the owning pipe from the winning capsule's fold.
          vec3 pa = p - prev;
          vec3 ba = cur - prev;
          float bb = max(dot(ba, ba), 1e-8);
          float h = clamp(dot(pa, ba) / bb, 0.0, 1.0);
          vec3 qq = pa - ba * h;
          vec3 T = ba * inversesqrt(bb);
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
        bPrev = bCur;
      }
    }

    return vec2(sBest, pipeBest);
  }

  // 4-tap tetrahedron normal on the folded scene.
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

  // Iridescent wet-tube shading, v2 style: each pipe of the braid carries its
  // own hue band (fading into the merged head), evaluated in the winning
  // folded cell so every copy shows the same living bundle. Lighting stays in
  // world space, so each copy of the rosette catches the light from its own
  // angle.
  vec3 shadeDragon(vec3 pos, vec3 n, vec3 rd) {
    vec3 q = foldWinner(pos);
    vec2 info = dragonInfo(q);
    float behind = max(uHead - info.x, 0.0);
    float merge = smoothstep(0.0, max(uBraidMerge, 0.02), behind);

    // Optional per-sector hue: which copy of the rosette is this?
    float wAng = atan(pos.y, pos.x) - uMandalaSpin;
    float sectorId = floor(mod(wAng, TAU) / uSectorAngle);

    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);
    float phase = behind * uLengthHueShift + uHueSpeed
      + info.y * uPipeHueShift * merge
      + sectorId * uSectorHueShift;
    vec3 base = iridescent(phase + uShimmer * fres);

    float diff = max(dot(n, uLightDir), 0.0);
    vec3 hlf = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = calcAO(pos, n);

    vec3 col = base * (uAmbient + uDiffuse * diff * ao);

    col += base * fres * uRimStrength;
    col += vec3(spec) * ao;

    return col;
  }

  // Sphere-trace the folded rosette. The annulus bound inside mapScene does
  // the empty-space skipping, so no extra bounding volume is needed.
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
    vec3 col = shadeDragon(pos, n, rd);
    float fog = exp(-uFogDensity * t);

    return vec4(mix(uBgColor, col, fog), t);
  }

  // ── The rose window ───────────────────────────────────────────────────────
  // One analytic stained-glass disc behind the dragons: iridescent cells by
  // ring and folded angle, frost, lead lines on every seam, a bright hub, and
  // the dragons' own light pooling on the glass beneath them.
  vec4 windowLayer(vec3 ro, vec3 rd, float tHit) {
    if (uBackAlpha < 0.003) { return vec4(vec3(0.0), 1.0); }

    float rz = abs(rd.z) < 1e-5 ? (rd.z < 0.0 ? -1e-5 : 1e-5) : rd.z;
    float t = (-uBackDepth - ro.z) / rz;

    if (t <= 0.0 || t >= tHit) { return vec4(vec3(0.0), 1.0); }

    vec3 hp = ro + rd * t;
    float r = length(hp.xy);
    float disc = 1.0 - smoothstep(uBackRadius - 0.2, uBackRadius, r);

    if (disc <= 0.002) { return vec4(vec3(0.0), 1.0); }

    float c = cos(uMandalaSpin);
    float s = sin(uMandalaSpin);
    vec2 xy = vec2(c * hp.x + s * hp.y, -s * hp.x + c * hp.y);
    float ang = atan(xy.y, xy.x);
    float a0 = mod(ang, uSectorAngle);
    float am = uMirror > 0.5 ? min(a0, uSectorAngle - a0) : a0;

    // Stained-glass cells: hue steps ring by ring, drifts with the folded
    // angle, and breathes with the frost.
    float ring = r * uRings / max(uBackRadius, 0.3);
    float ringId = floor(ring);
    vec3 glass = iridescent(ringId * uBackHueShift + am * 0.4 + uBackHuePhase);

    float bright = uBackBrightness + uCenterGlow * exp(-r * r * 0.35);

    if (uGlassFrost > 0.001) {
      float frost = perlinNoise(vec3(xy * uFrostScale, 5.1));

      bright *= mix(1.0, clamp(0.45 + 1.2 * frost, 0.0, 1.3), uGlassFrost);
    }

    // Lead lines: ring seams + the two folded sector seams (constant width).
    float fr = fract(ring);
    float leadR = exp(-min(fr, 1.0 - fr) * 14.0);
    float leadA = exp(-min(am, uCellAngle - am) * r * 26.0);
    float lead = min(leadR + leadA, 1.0);

    vec3 col = glass * bright;

    col *= 1.0 - uLeadDark * lead;
    col += iridescent(ringId * uBackHueShift + 0.31 + uBackHuePhase)
      * lead * uLeadGlow * 0.6;

    // The dragons' light pooling on the glass beneath them (lateral proximity
    // in the folded cell, depth ignored so the glow tracks the dance).
    if (uDragonGlow > 0.001) {
      float dd = max(
        mapDragonSingle(vec3(r * cos(am), r * sin(am), 0.0)) * uLip,
        0.0
      );

      col += iridescent(uHueSpeed + ringId * 0.1)
        * uDragonGlow * exp(-dd / 0.45);
    }

    float fog = exp(-uFogDensity * t);

    col = mix(uBgColor, col, fog);

    float a = clamp(uBackAlpha * disc * fog, 0.0, 0.97);

    return vec4(a * col, 1.0 - a);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 ro = uCamPos;
    vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);

    vec4 opaque = traceScene(ro, rd);
    vec4 glass = windowLayer(ro, rd, opaque.a);

    vec3 col = glass.rgb + glass.a * opaque.rgb;

    // Alpha: dragons are solid; escaped rays with no glass in front stay
    // transparent so the p5 background shows through around the rosette.
    float opaqueSolid = opaque.a < MAX_DIST ? 1.0 : 0.0;
    float alpha = (1.0 - glass.a) + glass.a * opaqueSolid;

    gl_FragColor = vec4(col, alpha);
  }
`;

const scene = createNoiseFieldRenderer( FRAGMENT );

// ── CPU side ─────────────────────────────────────────────────────────────────

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

// Seeded waypoint chain inside the canonical cell: angles across the wedge,
// radii alternating inner/outer for a petalled rhythm (optional), and a
// little depth relief. Joined by a cyclic 3D Hermite (tangents × flow).
function buildArcs( {
  waypoints,
  seed,
  cellAngle,
  rMin,
  rMax,
  depthAmp,
  petalWeave,
  flow
} ) {
  const rng = makeRng( seed );
  const points = [];

  for ( let k = 0; k < waypoints; k++ ) {
    const theta = 0.04 + rng() * Math.max(
      cellAngle - 0.08,
      0.02
    );
    const span = rMax - rMin;

    let radius;

    if ( petalWeave ) {
      radius = k % 2 === 0
        ? rMin + rng() * span * 0.35
        : rMax - rng() * span * 0.35;
    } else {
      radius = rMin + rng() * span;
    }

    points.push( {
      x: radius * Math.cos( theta ),
      y: radius * Math.sin( theta ),
      z: ( rng() * 2 - 1 ) * depthAmp,
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
        a.y
      ],
      p1: [
        b.x,
        b.y
      ],
      m0: [
        0.5 * flow * ( b.x - prev.x ),
        0.5 * flow * ( b.y - prev.y )
      ],
      m1: [
        0.5 * flow * ( next.x - a.x ),
        0.5 * flow * ( next.y - a.y )
      ],
      z0: a.z,
      z1: b.z,
      mz0: 0.5 * flow * ( b.z - prev.z ),
      mz1: 0.5 * flow * ( next.z - a.z ),
      point: a
    } );
  }

  return arcs;
}

// Waypoint-crossing bookkeeping for the chime (wrap-aware, as in v3).
let lastCrossU = null;

// Index of the last fired hum grain (the v2/v3 seamless drone bed).
let lastGrainIndex = null;

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const mandala = o.mandala ?? {};
  const path = o.path ?? {};
  const dragon = o.dragon ?? {};
  const rose = o.window ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const sound = o.sound ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    5,
    6,
    14
  ] ) );

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;

  // ── Fold geometry ──────────────────────────────────────────────────────────
  const sectors = Math.min(
    12,
    Math.max(
      3,
      Math.round( mandala.sectors ?? 8 )
    )
  );
  const mirror = mandala.mirror ?? true;
  const sectorAngle = p.TAU / sectors;
  const cellAngle = mirror ? sectorAngle / 2 : sectorAngle;
  const spinTurnsMandala = Math.round( ( mandala.spin ?? 0 ) * timeScale );
  const mandalaSpin = t * spinTurnsMandala;

  // ── Loop-exact clock ───────────────────────────────────────────────────────
  const waypoints = Math.min(
    MAX_SEQ,
    Math.max(
      3,
      Math.round( path.waypointsPerLoop ?? 6 )
    )
  );
  const f = animation.progression * waypoints;

  // ── The dance ──────────────────────────────────────────────────────────────
  const flow = Math.min(
    Math.max(
      path.flow ?? 0.65,
      0
    ),
    1
  );
  const pose = Math.min(
    Math.max(
      path.pose ?? 0.5,
      0
    ),
    1
  );
  const rMin = Math.max(
    mandala.innerRadius ?? 0.9,
    0.3
  );
  const rMax = Math.max(
    mandala.outerRadius ?? 2.6,
    rMin + 0.4
  );
  const depthAmp = mandala.depthRelief ?? 0.35;
  const seed = Math.round( path.seed ?? 11 );

  const arcs = buildArcs( {
    waypoints,
    seed,
    cellAngle,
    rMin,
    rMax,
    depthAmp,
    petalWeave: path.petalWeave ?? true,
    flow
  } );

  // ── Body ───────────────────────────────────────────────────────────────────
  const bodyLen = Math.min(
    Math.max(
      dragon.bodyLength ?? 3,
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
    dragon.pipeRadius ?? 0.05,
    0.02
  );
  const braidRadius = Math.max(
    dragon.braidRadius ?? 0.12,
    0
  );
  const braidMerge = dragon.braidMerge ?? 0.5;
  const headBulge = dragon.headBulge ?? 0.35;
  const headLen = dragon.headLength ?? 0.6;
  const tailLen = Math.min(
    dragon.tailLength ?? 1.4,
    bodyLen
  );
  const radiusPulse = dragon.radiusPulse ?? 0.08;

  const pulseWavesInt = Math.max(
    1,
    Math.round( dragon.pulseWaves ?? 3 )
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
  const swimAmpX = path.swimX ?? 0.05;
  const swimAmpY = path.swimY ?? 0.05;
  const swimPhase = path.swimPhase ?? 1.6;

  const twist = ( p.TAU * ( dragon.twist ?? 1.5 ) ) / bodyLen;
  const spinTurns = Math.round( ( dragon.spin ?? -2 ) * timeScale );

  // ── March safety ───────────────────────────────────────────────────────────
  let maxTangent = 0;
  let minRk = Infinity;
  let maxRk = 0;
  let maxZk = 0;

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
    maxZk = Math.max(
      maxZk,
      Math.abs( arc.point.z )
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
  const boundPad = reach;

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

  // ── Camera (static by default) ─────────────────────────────────────────────
  // The renderer's ray convention spans ±0.5 vertically, so a plane at
  // distance D shows a half-height of D / (2·focal): the distance is derived
  // from that so distance = 1 frames the whole rosette whatever the fov.
  const view = camera.view ?? "facade";
  const backRadius = rose.radius ?? 3.3;
  const frameRadius = Math.max(
    maxRk + 0.6,
    backRadius
  );
  const fov = camera.fov ?? 45;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );
  const dist = ( camera.distance ?? 1 ) * 2.15 * focal * frameRadius;

  let elevation = 0;
  let azimuth = 0;

  if ( view === "oblique" || view === "drift" ) {
    elevation = Math.min(
      Math.max(
        camera.elevation ?? 0.55,
        -1.35
      ),
      1.35
    );
    azimuth = camera.azimuth ?? 0.45;
  }

  if ( view === "drift" ) {
    const driftTurnsInt = Math.round( camera.driftTurns ?? 1 );

    azimuth += p.TAU * driftTurnsInt * animation.progression;
  }

  const camPos = [
    Math.cos( elevation ) * Math.sin( azimuth ) * dist,
    Math.sin( elevation ) * dist,
    Math.cos( elevation ) * Math.cos( azimuth ) * dist
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
      -camPos[ 0 ],
      -camPos[ 1 ],
      -camPos[ 2 ]
    ],
    [
      0,
      0,
      -1
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

  // ── Chime on every waypoint pass ───────────────────────────────────────────
  // Each time the head settles on a waypoint (f crosses an integer), a soft
  // airy chime rings: pitch rises with the waypoint's radius (outer petals
  // ring higher), stereo pan follows the home copy's x. Wrap-aware, silent on
  // big scrubs.
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

    if ( ( sound.chimeEnabled ?? true )
      && crossed !== 0
      && Math.abs( crossed ) <= 2 ) {
      const c = delta > 0 ? Math.floor( f ) : Math.ceil( f );
      const ci = ( ( c % waypoints ) + waypoints ) % waypoints;
      const wp = arcs[ ci ].point;
      const rNorm = ( wp.radius - rMin ) / Math.max(
        rMax - rMin,
        0.01
      );

      audio.trigger(
        "whoosh",
        {
          duration: sound.chimeLength ?? 0.6,
          freq: 480 * ( sound.chimePitch ?? 1 ) * ( 0.75 + 0.5 * rNorm ),
          gain: 0.5 * ( sound.chimeVolume ?? 0.6 ),
          pan: Math.min(
            Math.max(
              ( wp.x / rMax ) * ( sound.chimePan ?? 0.7 ),
              -1
            ),
            1
          )
        }
      );
    }

    lastCrossU = f;
  }

  // ── Constant dragon hum (same seamless grain bed as v2/v3) ─────────────────
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
          freq: 165 * humPitch * wobble,
          gain: 0.4 * ( sound.humVolume ?? 0.45 ),
          sub: 0.4,
          pan: 0
        }
      );
    }
  } else {
    lastGrainIndex = null;
  }

  const az = light.azimuth ?? 2.6;
  const el = light.elevation ?? 0.6;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  // ── Seamless hues (v2/v3 bookkeeping) ──────────────────────────────────────
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
      uBoundPad: boundPad,
      uLip: lipschitz,
      uPipeCount: pipeCount,
      uBraidRadius: braidRadius,
      uBraidMerge: braidMerge,
      uTwist: twist,
      uSpin: t * spinTurns,
      uPipeHueShift: colors.pipeHueShift ?? 0.33,
      uSectorAngle: sectorAngle,
      uCellAngle: cellAngle,
      uMirror: mirror ? 1 : 0,
      uMandalaSpin: mandalaSpin,
      uSectorHueShift: mandala.sectorHueShift ?? 0,
      uRInner: Math.max(
        minRk - reach - 0.05,
        0
      ),
      uROuter: maxRk + reach + 0.05,
      uZPad: maxZk + reach + 0.05,
      uBackAlpha: rose.alpha ?? 0.8,
      uBackDepth: rose.depth ?? 1.5,
      uBackRadius: backRadius,
      uRings: Math.max(
        1,
        Math.round( rose.rings ?? 5 )
      ),
      uBackHueShift: rose.hueShift ?? 0.14,
      uBackHuePhase: rose.huePhase ?? 0.35,
      uBackBrightness: rose.brightness ?? 0.35,
      uCenterGlow: rose.centerGlow ?? 0.8,
      uLeadDark: rose.leadDarkness ?? 0.55,
      uLeadGlow: rose.leadGlow ?? 0.5,
      uGlassFrost: rose.frost ?? 0.5,
      uFrostScale: rose.frostScale ?? 3,
      uDragonGlow: rose.dragonGlow ?? 0.7,
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
      uAmbient: light.ambient ?? 0.32,
      uDiffuse: light.diffuse ?? 1,
      uSpecular: light.specular ?? 0.6,
      uSpecPower: light.specPower ?? 24,
      uFresnelPower: light.fresnelPower ?? 2.5,
      uRimStrength: light.rimStrength ?? 0.55,
      uFogDensity: o.fogDensity ?? 0.015,
      uBgColor: ( o.backgroundColor ?? [
        5,
        6,
        14
      ] ).map( ( v ) => v / 255 )
    }
  } );
} );
