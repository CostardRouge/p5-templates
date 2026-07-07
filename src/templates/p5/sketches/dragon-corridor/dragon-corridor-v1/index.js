import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// dragon-corridor v1 — a legless, wingless dragon (a flying snake) racing down an
// endless square corridor, weaving around smoked-glass obstacles.
//
// The whole scene is one full-screen raymarch (sphere-trace for the solids, an
// analytic pass for the translucent glass) driven off the shared GPU renderer:
//
//   • Corridor — an infinite square tube (walls at |x| = |y| = H). On-axis rays
//     never hit a wall, so the four walls converge to a vanishing point, giving
//     the "looking down a shrinking corridor" perspective for free. The walls are
//     geometrically static; the sense of flight comes entirely from their SHADING,
//     which is a function of s = z − scroll (see below) so the surface texture and
//     the obstacle markers stream through the tunnel (direction selectable).
//
//   • The dragon — the flowers-shaders-v2 pipe braid, re-aimed down the z axis.
//     A bundle of straight tubes is wound helically around a moving centreline and
//     the "untwist" trick straightens them for a cheap SDF (rotate the sampled
//     point by −(z·twist), every pipe becomes a fixed vertical cylinder). The
//     centreline weaves left/right/up/down to sit in the OPEN half of whichever
//     obstacle it is passing — with a configurable HESITATION (hold, then commit
//     fast) and a body BUNCH that accumulates mass around the corner it takes —
//     plus a perpetual serpentine "swim" sway so the head and tail always move,
//     obstacles or not. Near the head the braid unwinds (braid radius → 0) so the
//     tubes merge into one rounded snake head; the infinite tube is capped there
//     with a rounded CSG intersection. A travelling radius pulse along the body is
//     the "floating morphing" that crawls along the dragon.
//
//   • Obstacles — smoked / milky glass SLABS (thickness is an option), each
//     covering exactly half the corridor cross-section (top / bottom / left /
//     right, one per segment). They are integrated analytically: each slab is a
//     pair of z-planes, the ray's path length through the slab drives a
//     Beer–Lambert opacity (so grazing rays fog up naturally and thickness reads
//     physically), a Perlin frost mottles the surface, and a "milk" control pulls
//     the tint toward white scatter. Blended front-to-back over the opaque scene.
//
//   The obstacle direction pattern is computed on the CPU from a seed and
//   uploaded as a uniform array — the shader and the FPV camera (below) read the
//   very same values, so they can never disagree (a GPU float sin()-hash could
//   diverge from the CPU's float64 at quarter boundaries).
//
//   • FPV camera — optional follow of the dragon's weave path (softened by a box
//     filter so it trails rather than tracks), an aim control that points the
//     lens at the head, and a banking roll driven by the path's lateral slope.
//
// ── Looping ──────────────────────────────────────────────────────────────────
// Everything spatial is a function of s = z − scroll and is periodic in s with
// period L = SEG · PERIOD (the obstacle pattern repeats every PERIOD segments;
// the weave, swim, wall ribs and slab placement all inherit that period). scroll
// advances by exactly ±L over one loop, so the last frame reproduces the first.
// Every time-driven rate (braid spin, pulse travel, swim, hue scroll) is snapped
// to whole cycles per loop, and the hue-along-the-body shift is quantised to
// whole palette periods per L, so the colours are seamless across the loop seam.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 8; // matches the "pipes" slider max (braid bundle size)
const MAX_STEPS = 130; // sphere-trace iterations per ray
const SURF_EPS = 0.001; // hit threshold (world units)
const SEG = 3.2; // spacing between obstacle slabs (world units, in s)
const HALF = 1.0; // corridor half-size (walls at |x| = |y| = HALF)
const MAX_DIST = 34.0; // ray cutoff / far plane
const N_PANES = 14; // glass slabs scanned per ray (≈ MAX_DIST / SEG + margin)
const MAX_PERIOD = 16; // max obstacle segments per loop (uDirs array size)
const TAIL_LEN = 18.0; // world units over which the tail-thinning acts

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) };
  const float SEG      = ${ SEG.toFixed( 4 ) };
  const float HALF     = ${ HALF.toFixed( 4 ) };
  const float MAX_DIST = ${ MAX_DIST.toFixed( 4 ) };

  uniform float uScroll;      // how far the corridor content has streamed (signed)
  uniform float uPeriod;      // obstacle segments per loop (pattern period)
  uniform float uDirs[${ MAX_PERIOD }]; // blocked half per segment (0 top, 1 right, 2 bottom, 3 left)

  // ── Dragon braid ──
  uniform float uPipeCount;
  uniform float uPipeRadius;
  uniform float uBraidRadius;
  uniform float uTwist;           // helix winding rate along z
  uniform float uSpin;            // braid rotation over time (whole turns/loop)
  uniform float uRadiusPulse;     // travelling swell of the braid radius
  uniform float uPulseFreq;       // spatial frequency of the swell (whole waves/loop)
  uniform float uPulseT;          // swell travel phase (whole cycles/loop)
  uniform float uWeave;           // how far the centreline leans into the open half
  uniform float uHeadZ;           // world z of the head plane (in front of the camera)
  uniform float uHeadRound;       // fillet radius where the body meets the head cap
  uniform float uHeadMerge;       // length over which the braid unwinds into the head
  uniform float uTailThin;        // how much the body thins toward the far tail
  uniform float uDragonLipschitz; // CPU-computed safety divisor for the march

  // ── Swim (perpetual serpentine sway, always on top of the dodge weave) ──
  uniform vec2  uSwimAmp;         // lateral sway amplitude (x, y)
  uniform float uSwimFreq;        // spatial frequency (whole waves per loop)
  uniform float uSwimT;           // travel phase (whole cycles per loop)
  uniform float uSwimAxisPhase;   // y-axis phase offset (0 = in phase, π/2 = circling)

  // ── Dodge behaviour ──
  uniform float uDodgeHold;       // fraction of a segment to hold before dodging
  uniform float uDodgeSharp;      // commit curve exponent (higher = later, snappier)
  uniform float uBunch;           // body accumulation around the corner it takes

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
  uniform float uWallGlow;        // brightness of the obstacle markers on the walls
  uniform float uRibFreq;         // wall rib spatial frequency (0 = plain walls)
  uniform vec3  uGlassColor;
  uniform float uGlassAlpha;      // straight-through opacity of one slab
  uniform float uGlassThickness;  // slab thickness (world units)
  uniform float uGlassEdge;       // half-width of the pane boundary (small = sharp)
  uniform float uGlassFrost;      // Perlin frost mottling amount
  uniform float uFrostScale;      // frost noise scale
  uniform float uGlassMilk;       // pulls the tint toward white scatter
  uniform float uGlassTint;       // how much each pane borrows the iridescent hue
  uniform float uEdgeGlow;        // bright seam along the pane boundary
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

  // Blocked half for a segment, read from the CPU-computed pattern. Uniform
  // arrays need constant indices in WebGL1 fragment shaders, hence the loop.
  float dirAt(float seg) {
    int mi = int(mod(seg, uPeriod) + 0.5);
    float d = 0.0;

    for (int i = 0; i < ${ MAX_PERIOD }; i++) {
      if (i == mi) { d = uDirs[i]; }
    }

    return d;
  }

  // Centre of the OPEN half for a blocked direction — where the dragon wants to be.
  vec2 openCentre(float d) {
    if (d < 0.5) { return vec2(0.0, -uWeave); }  // top blocked  → dive
    if (d < 1.5) { return vec2(-uWeave, 0.0); }  // right blocked → bank left
    if (d < 2.5) { return vec2(0.0,  uWeave); }  // bottom blocked → climb
    return vec2(uWeave, 0.0);                    // left blocked  → bank right
  }

  // Hesitating commit curve: hold position for uDodgeHold of the segment, then
  // ease over with a uDodgeSharp-powered smoothstep — the "aiming before the
  // strike" body language.
  float transitionShape(float u) {
    float w = clamp((u - uDodgeHold) / max(1.0 - uDodgeHold, 0.001), 0.0, 1.0);

    w = pow(w, uDodgeSharp);

    return w * w * (3.0 - 2.0 * w);
  }

  // Dragon centreline at scroll-coord s: dodge weave (with hesitation) plus the
  // perpetual swim sway. activity peaks mid-dodge and drives the body bunching.
  void weaveInfo(float s, out vec2 centre, out float activity) {
    float f = s / SEG;
    float n0 = floor(f);
    float fr = transitionShape(f - n0);

    int i0 = int(mod(n0, uPeriod) + 0.5);
    int i1 = int(mod(n0 + 1.0, uPeriod) + 0.5);
    float d0 = 0.0;
    float d1 = 0.0;

    for (int i = 0; i < ${ MAX_PERIOD }; i++) {
      if (i == i0) { d0 = uDirs[i]; }
      if (i == i1) { d1 = uDirs[i]; }
    }

    centre = mix(openCentre(d0), openCentre(d1), fr);
    centre += vec2(
      uSwimAmp.x * sin(s * uSwimFreq + uSwimT),
      uSwimAmp.y * sin(s * uSwimFreq + uSwimT + uSwimAxisPhase)
    );

    activity = 4.0 * fr * (1.0 - fr);
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
  // down the corridor, thinning toward the tail, and bunches up mid-dodge.
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

    // Bunching fattens the PIPES (mass gathering at the corner); the braid orbit
    // grows only slightly, so the tubes swell together instead of splaying apart.
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

  // Distance to the inside of the square corridor (0 at a wall, grows inward).
  float mapCorridor(vec3 p) {
    return HALF - max(abs(p.x), abs(p.y));
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
  // lights up with a coloured band at every obstacle plane.
  vec3 shadeWall(vec3 pos, vec3 n, vec3 rd) {
    float s = pos.z - uScroll;

    // Longitudinal ribs that flow through the tunnel (0 frequency = plain wall).
    float rib = 0.5 + 0.5 * cos(s * uRibFreq);
    float ribShade = mix(0.55, 1.0, pow(rib, 3.0));

    // Cross-section lines on the wall corners give the eye something to track.
    float across = max(abs(pos.x), abs(pos.y));
    float corner = smoothstep(HALF * 0.82, HALF * 0.995, across);

    vec3 base = uWallColor * ribShade;
    base += uWallColor * corner * 0.6;

    // A glowing marker at each obstacle plane, tinted by which half it blocks so
    // the wall telegraphs the upcoming turn.
    float seg = floor(s / SEG + 0.5);
    float planeS = seg * SEG;
    float band = exp(-abs(s - planeS) * 6.0);
    vec3 marker = iridescent(dirAt(seg) * 0.27 + 0.1);

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

  // Analytic smoked-glass slabs: walk the panes front-to-back, clip the ray's
  // span inside each slab, and turn the traversed path length into a
  // Beer–Lambert opacity so thickness and grazing angles read physically.
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
      float zc = seg * SEG + uScroll;

      float tA = (zc + halfTh - ro.z) / rd.z;
      float tB = (zc - halfTh - ro.z) / rd.z;
      float t0 = max(min(tA, tB), 0.0);
      float t1 = min(max(tA, tB), tHit);

      if (t1 <= t0) { continue; }

      vec3 hp = ro + rd * (0.5 * (t0 + t1));

      // Inside the corridor cross-section?
      float inside = (1.0 - smoothstep(HALF * 0.9, HALF, abs(hp.x)))
        * (1.0 - smoothstep(HALF * 0.9, HALF, abs(hp.y)));

      if (inside <= 0.001) { continue; }

      // Coverage of the blocked half. uGlassEdge sets the boundary softness:
      // small = razor-sharp pane edge, large = feathered.
      float d = dirAt(seg);
      float edge = max(uGlassEdge, 0.002);
      float cover;

      if (d < 0.5)      { cover = smoothstep(-edge, edge,  hp.y); } // top
      else if (d < 1.5) { cover = smoothstep(-edge, edge,  hp.x); } // right
      else if (d < 2.5) { cover = smoothstep(-edge, edge, -hp.y); } // bottom
      else              { cover = smoothstep(-edge, edge, -hp.x); } // left

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
      vec3 tint = mix(uGlassColor, iridescent(m * 0.23 + d * 0.11), uGlassTint);
      tint = mix(tint, vec3(1.0), uGlassMilk);

      // Grazing view brightens the frost; a bright seam marks the pane edge.
      float grazing = 1.0 - abs(rd.z);
      float seam = exp(-abs(cover - 0.5) * 9.0) * uEdgeGlow;

      vec3 paneCol = tint * (0.7 + 0.6 * grazing) + tint * seam;

      // Fog attenuates the pane's colour AND its opacity — far slabs melt into
      // the depth instead of stacking up into a white column that would hide the
      // vanishing point.
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
// The FPV camera needs the exact weave the shader renders, so the obstacle
// pattern is generated here (from a seed) and shared with the GPU as a uniform
// array, and the path maths below mirrors weaveInfo() above.

function buildDirs(
  period, seed
) {
  const dirs = [];

  for ( let i = 0; i < MAX_PERIOD; i++ ) {
    const n = ( i % period ) * 1.61803 + seed * 0.7317 + 3.7;
    const h = Math.sin( n * 12.9898 ) * 43758.5453;

    dirs.push( Math.floor( ( h - Math.floor( h ) ) * 4 ) );
  }

  return dirs;
}

function openCentre(
  dir, weave
) {
  if ( dir === 0 ) {
    return [
      0,
      -weave
    ];
  }

  if ( dir === 1 ) {
    return [
      -weave,
      0
    ];
  }

  if ( dir === 2 ) {
    return [
      0,
      weave
    ];
  }

  return [
    weave,
    0
  ];
}

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
  // direction option) and the obstacle pattern repeats with that period, so the
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

  const dirs = buildDirs(
    period,
    Math.round( obstacles.seed ?? 7 )
  );

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

  const pipeCount = Math.min(
    dragon.pipeCount ?? 3,
    MAX_PIPES
  );
  const pipeRadius = dragon.pipeRadius ?? 0.09;
  const braidRadius = dragon.braidRadius ?? 0.13;
  const twist = dragon.twist ?? 0.8;
  const radiusPulse = dragon.radiusPulse ?? 0.35;
  const tailThin = dragon.tailThin ?? 0.3;
  const weave = ( obstacles.weave ?? 0.36 ) * HALF;

  const dodgeHold = Math.min(
    dodge.hesitation ?? 0.25,
    0.9
  );
  const dodgeSharp = dodge.sharpness ?? 1.6;
  const bunch = dodge.bunch ?? 0.5;

  // Conservative Lipschitz divisor for the marched field. The radial gradient is
  // amplified by the helix winding (maxR·twist), the travelling pulse slope, the
  // weave's lateral slope (steepened by the hesitation squeezing the dodge into
  // (1 − hold) of a segment), the swim sway and the bunching swell.
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
  const weaveSlope = ( 1.5 * ( 2 * weave ) * transRate ) / SEG
    + ( swimAmpX + swimAmpY ) * swimFreq;
  const bunchSlope = ( ( 0.25 * braidRadius * ( 1 + radiusPulse ) + pipeRadius )
    * bunch * 4 * transRate ) / SEG;
  const dragonLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope + weaveSlope + bunchSlope ) ** 2 ) * 1.25;

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

  const weaveAt = ( s ) => {
    const f = s / SEG;
    const n0 = Math.floor( f );
    const fr = transitionShape( f - n0 );
    const i0 = ( ( n0 % period ) + period ) % period;
    const i1 = ( ( ( n0 + 1 ) % period ) + period ) % period;
    const a = openCentre(
      dirs[ i0 ],
      weave
    );
    const b = openCentre(
      dirs[ i1 ],
      weave
    );

    return [
      a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * fr + swimAmpX * Math.sin( s * swimFreq + swimT ),
      a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * fr
        + swimAmpY * Math.sin( s * swimFreq + swimT + swimAxisPhase )
    ];
  };

  // FPV: follow the (box-filtered) path, aim at the head, bank into turns.
  const fpvFollow = camera.fpvFollow ?? 0;
  const fpvAim = camera.fpvAim ?? 0;
  const fpvBank = camera.fpvBank ?? 0;
  const fpvSmooth = ( camera.fpvSmooth ?? 0.5 ) * SEG * 0.6;

  const camS = camZ - scroll;
  const w0 = weaveAt( camS - fpvSmooth );
  const w1 = weaveAt( camS );
  const w2 = weaveAt( camS + fpvSmooth );
  const followX = ( w0[ 0 ] + w1[ 0 ] + w2[ 0 ] ) / 3;
  const followY = ( w0[ 1 ] + w1[ 1 ] + w2[ 1 ] ) / 3;

  const clampCam = ( v ) => Math.min(
    Math.max(
      v,
      -( HALF - 0.22 )
    ),
    HALF - 0.22
  );
  const camX = clampCam( ( camera.x ?? 0 ) + fpvFollow * followX );
  const camY = clampCam( ( camera.y ?? 0.12 ) + fpvFollow * followY );

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
      uDirs: {
        floatv: dirs
      },
      uPipeCount: pipeCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uTwist: twist,
      uSpin: t * spinTurns,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseT: t * pulseTravelInt,
      uWeave: weave,
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
      uDodgeHold: dodgeHold,
      uDodgeSharp: dodgeSharp,
      uBunch: bunch,
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
