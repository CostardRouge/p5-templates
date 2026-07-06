import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// dragon-corridor v1 — a legless, wingless dragon (a flying snake) racing down an
// endless square corridor, weaving around foggy-glass obstacles.
//
// The whole scene is one full-screen raymarch (sphere-trace for the solids, an
// analytic pass for the translucent glass) driven off the shared GPU renderer:
//
//   • Corridor — an infinite square tube (walls at |x| = |y| = H). On-axis rays
//     never hit a wall, so the four walls converge to a vanishing point, giving
//     the "looking down a shrinking corridor" perspective for free. The walls are
//     geometrically static; the sense of flight comes entirely from their SHADING,
//     which is a function of s = z − scroll (see below) so the surface texture and
//     the obstacle markers stream toward the camera.
//
//   • The dragon — the flowers-shaders-v2 pipe braid, re-aimed down the z axis.
//     A bundle of straight tubes is wound helically around a moving centreline and
//     the "untwist" trick straightens them for a cheap SDF (rotate the sampled
//     point by −(z·twist), every pipe becomes a fixed vertical cylinder). The
//     centreline weaves left/right/up/down to sit in the OPEN half of whichever
//     obstacle it is passing, so the body reads as a snake dodging the walls. A
//     travelling radius pulse along the body is the "floating morphing" that seems
//     to advance up the dragon toward the head.
//
//   • Obstacles — thin foggy-glass panes, each covering exactly half the corridor
//     cross-section (top / bottom / left / right, picked per segment). They are
//     integrated analytically: each pane is a z-plane, intersected with the ray,
//     masked to its half and softened at the boundary, then blended front-to-back
//     over the opaque scene as a translucent, lightly iridescent frost.
//
// ── Looping ──────────────────────────────────────────────────────────────────
// Everything spatial is a function of s = z − scroll and is periodic in s with
// period L = SEG · PERIOD (the obstacle direction pattern repeats every PERIOD
// segments; the weave, wall stripes and pane placement all inherit that period).
// scroll advances by exactly L over one loop, so the last frame reproduces the
// first. The only time-driven rates (braid spin, pulse breathing) are snapped to
// whole cycles per loop, exactly as flowers-shaders-v2 does, so the seam is
// invisible.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 8; // matches the "pipes" slider max (braid bundle size)
const MAX_STEPS = 130; // sphere-trace iterations per ray
const SURF_EPS = 0.001; // hit threshold (world units)
const SEG = 3.2; // spacing between obstacle planes (world units, in s)
const HALF = 1.0; // corridor half-size (walls at |x| = |y| = HALF)
const MAX_DIST = 34.0; // ray cutoff / far plane
const N_PANES = 13; // glass panes scanned per ray (≈ MAX_DIST / SEG + margin)

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 4 ) };
  const float SEG      = ${ SEG.toFixed( 4 ) };
  const float HALF     = ${ HALF.toFixed( 4 ) };
  const float MAX_DIST = ${ MAX_DIST.toFixed( 4 ) };

  uniform float uScroll;      // how far the corridor content has streamed toward us
  uniform float uPeriod;      // obstacle segments per loop (pattern period)

  // ── Dragon braid ──
  uniform float uPipeCount;
  uniform float uPipeRadius;
  uniform float uBraidRadius;
  uniform float uTwist;           // helix winding rate along z
  uniform float uSpin;            // braid rotation over time (whole turns/loop)
  uniform float uRadiusPulse;     // travelling swell of the braid radius
  uniform float uPulseWaves;      // whole swell cycles packed along one loop length
  uniform float uWeave;           // how far the centreline leans into the open half
  uniform float uHeadZ;           // world z of the head plane (in front of the camera)
  uniform float uHeadRound;       // fillet radius where the body meets the head cap
  uniform float uHeadMerge;       // length over which the braid unwinds into the head
  uniform float uDragonLipschitz; // CPU-computed safety divisor for the march

  // ── Camera ──
  uniform vec3  uCamPos;
  uniform float uFocal;
  uniform float uPitch;
  uniform float uYaw;

  // ── Iridescent palette (shared vocabulary with flowers-shaders v2) ──
  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uLengthHueShift;
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
  uniform vec3  uGlassColor;
  uniform float uGlassAlpha;      // per-pane opacity (0 = obstacles invisible)
  uniform float uGlassTint;       // how much each pane borrows the iridescent hue
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

  // Fixed pseudo-random in [0,1) — used only on integer segment indices, so the
  // obstacle pattern is deterministic and (via mod uPeriod) loops.
  float hash1(float n) {
    return fract(sin(n * 12.9898) * 43758.5453);
  }

  // Which half a segment's glass blocks: 0 top, 1 right, 2 bottom, 3 left.
  // Periodic with uPeriod so the whole obstacle course repeats every loop.
  float dirOf(float seg) {
    float m = mod(seg, uPeriod);

    return floor(hash1(m + 3.7) * 4.0);
  }

  // Centre of the OPEN half for a segment — where the dragon wants to be.
  vec2 openCentre(float seg) {
    float d = dirOf(seg);
    float k = uWeave;

    if (d < 0.5) { return vec2(0.0, -k); }  // top blocked  → dive
    if (d < 1.5) { return vec2(-k, 0.0); }  // right blocked → bank left
    if (d < 2.5) { return vec2(0.0,  k); }  // bottom blocked → climb
    return vec2(k, 0.0);                     // left blocked  → bank right
  }

  // Dragon centreline offset at scroll-coord s: smoothly ride from one segment's
  // open half to the next so the body weaves instead of snapping.
  vec2 weavePath(float s) {
    float f = s / SEG;
    float n0 = floor(f);
    float fr = smoothstep(0.0, 1.0, f - n0);

    return mix(openCentre(n0), openCentre(n0 + 1.0), fr);
  }

  // Smooth intersection (iq): fillets the corner where the tube meets its cap.
  float smoothMax(float a, float b, float k) {
    float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);

    return mix(b, a, h) + k * h * (1.0 - h);
  }

  // ── Dragon SDF: untwist space, then union N straight tubes about the weave. ──
  // The infinite braid is capped at uHeadZ with a rounded intersection so the
  // dragon terminates in a blunt head pointing at the camera; the body recedes
  // (thinning by perspective, not by geometry) down the corridor to a foggy tail.
  float mapDragon(vec3 p) {
    float s = p.z - uScroll;
    vec2  centre = weavePath(s);
    vec2  rel = p.xy - centre;

    float phi = p.z * uTwist + uSpin;
    float c = cos(phi);
    float sn = sin(phi);
    vec2  q = vec2(c * rel.x - sn * rel.y, sn * rel.x + c * rel.y);

    // Near the head the braid unwinds: the pipes converge to the centreline
    // (braid radius → 0) so the N tubes merge into one rounded snake head instead
    // of showing N separate capped ends.
    float merge = smoothstep(uHeadZ, uHeadZ - uHeadMerge, p.z);
    float br = uBraidRadius * merge * (1.0 + uRadiusPulse * sin(s * uPulseWaves));
    float best = 1e9;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  pc = br * vec2(cos(a), sin(a));
      float d = length(q - pc) - uPipeRadius;

      best = min(best, d);
    }

    // Cap: keep only the body behind the head plane (z < uHeadZ), rounded.
    float capped = smoothMax(best, p.z - uHeadZ, uHeadRound);

    return capped / uDragonLipschitz;
  }

  // Which pipe owns a point — recomputed at the hit for colour banding.
  float nearestPipe(vec3 p) {
    float s = p.z - uScroll;
    vec2  rel = p.xy - weavePath(s);

    float phi = p.z * uTwist + uSpin;
    float c = cos(phi);
    float sn = sin(phi);
    vec2  q = vec2(c * rel.x - sn * rel.y, sn * rel.x + c * rel.y);

    float br = uBraidRadius * (1.0 + uRadiusPulse * sin(s * uPulseWaves));
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

  // Iridescent wet-tube shading for the dragon body.
  vec3 shadeDragon(vec3 pos, vec3 n, vec3 rd) {
    float k = nearestPipe(pos);
    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);

    float phase = (pos.z - uScroll) * uLengthHueShift
      + uHueSpeed
      + k * uPipeHueShift;

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

  // Corridor wall shading — streams with s so the tunnel reads as rushing past,
  // and lights up with a coloured band at every obstacle plane.
  vec3 shadeWall(vec3 pos, vec3 n, vec3 rd) {
    float s = pos.z - uScroll;

    // Longitudinal ribs every SEG/2 (fine texture) that flow toward the camera.
    float rib = 0.5 + 0.5 * cos(s * (TAU * 2.0 / SEG));
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
    vec3 marker = iridescent(dirOf(seg) * 0.27 + 0.1);

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

  // Analytic translucent glass: scan the panes from front to back, blend each one
  // that the ray actually pierces (right half, inside the corridor, in front of
  // the opaque hit) with front-to-back alpha compositing.
  vec4 glassLayer(vec3 ro, vec3 rd, float tHit) {
    vec3 acc = vec3(0.0);
    float trans = 1.0;

    // First pane index in front of the camera, then walk deeper each step.
    float nStart = 1.0 - floor(uScroll / SEG);

    for (int i = 0; i < ${ N_PANES }; i++) {
      float seg = nStart - float(i);
      float zPlane = seg * SEG + uScroll;
      float t = (zPlane - ro.z) / rd.z;

      if (t <= 0.0 || t >= tHit) { continue; }

      vec3 hp = ro + rd * t;

      // Inside the corridor cross-section?
      float inside = (1.0 - smoothstep(HALF * 0.9, HALF, abs(hp.x)))
        * (1.0 - smoothstep(HALF * 0.9, HALF, abs(hp.y)));

      if (inside <= 0.001) { continue; }

      // Coverage of the blocked half (soft boundary → frosted edge).
      float d = dirOf(seg);
      float edge = HALF * 0.14;
      float cover;

      if (d < 0.5)      { cover = smoothstep(-edge, edge,  hp.y); } // top
      else if (d < 1.5) { cover = smoothstep(-edge, edge,  hp.x); } // right
      else if (d < 2.5) { cover = smoothstep(-edge, edge, -hp.y); } // bottom
      else              { cover = smoothstep(-edge, edge, -hp.x); } // left

      float a = uGlassAlpha * cover * inside;

      if (a <= 0.001) { continue; }

      // Grazing view thickens the frost; a bright seam marks the pane edge.
      float grazing = 1.0 - abs(rd.z);
      float seam = exp(-abs(cover - 0.5) * 9.0) * 0.6;

      vec3 tint = mix(uGlassColor, iridescent(seg * 0.19), uGlassTint);
      vec3 paneCol = tint * (0.7 + 0.6 * grazing) + tint * seam;

      float fog = exp(-uFogDensity * t);

      paneCol = mix(uBgColor, paneCol, fog);
      a = clamp(a * (0.85 + 0.5 * grazing), 0.0, 0.95);

      acc += trans * a * paneCol;
      trans *= (1.0 - a);
    }

    return vec4(acc, trans);
  }

  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    // Forward-looking corridor camera (yaw/pitch nudge it off the axis).
    float cp = cos(uPitch);
    float sp = sin(uPitch);
    float cy = cos(uYaw);
    float sy = sin(uYaw);

    vec3 ro = uCamPos;
    vec3 fwd = normalize(vec3(cp * sy, sp, -cp * cy));
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);

    vec3 rd = normalize(fwd * uFocal + right * uv.x + up * uv.y);

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

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const corridor = o.corridor ?? {};
  const dragon = o.dragon ?? {};
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
  // One loop scrolls the corridor by exactly PERIOD segments, and the pattern of
  // obstacle directions repeats with that period, so the seam is invisible. Time
  // rates are snapped to whole cycles per loop, as in flowers-shaders-v2.
  const period = Math.max(
    1,
    Math.round( obstacles.segmentsPerLoop ?? 5 )
  );
  const loopLength = SEG * period;
  const scroll = animation.progression * loopLength;

  const spinTurns = Math.round( ( dragon.spin ?? 0 ) * timeScale );
  const pulseWavesInt = Math.max(
    1,
    Math.round( dragon.pulseWaves ?? 3 )
  );

  // Spatial pulse frequency chosen so the travelling swell packs a whole number
  // of cycles into one loop length — keeps sin( s · freq ) seamless across the seam.
  const pulseFreq = ( p.TAU * pulseWavesInt ) / loopLength;

  const pipeCount = Math.min(
    dragon.pipeCount ?? 3,
    MAX_PIPES
  );
  const pipeRadius = dragon.pipeRadius ?? 0.12;
  const braidRadius = dragon.braidRadius ?? 0.17;
  const twist = dragon.twist ?? 1.6;
  const radiusPulse = dragon.radiusPulse ?? 0.35;
  const weave = ( obstacles.weave ?? 0.45 ) * HALF;

  // Conservative Lipschitz divisor for the marched field: the radial gradient is
  // amplified by the helix winding (maxR·twist), the travelling pulse slope and
  // the weave's lateral slope (how fast the centreline slides between halves).
  const maxR = braidRadius * ( 1 + radiusPulse ) + pipeRadius;
  const pulseSlope = braidRadius * radiusPulse * pulseFreq;
  const weaveSlope = ( 1.5 * ( 2 * weave ) ) / SEG;
  const dragonLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope + weaveSlope ) ** 2 ) * 1.2;

  const fov = camera.fov ?? 62;
  const focal = 1 / Math.tan( ( fov * Math.PI ) / 180 / 2 );

  // The head sits a fixed gap in front of the camera, weaving with the body; the
  // braid tapers to a nose over headTaper world units behind that point.
  const camZ = camera.z ?? 2.5;
  const headZ = camZ - ( dragon.headGap ?? 1.9 );
  const headRound = dragon.headRound ?? 0.1;
  const headMerge = dragon.headMerge ?? 1;

  const az = light.azimuth ?? -0.6;
  const el = light.elevation ?? 0.7;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  // Hue scroll — whole palette periods per loop (matches flowers-shaders v2).
  const hueSpread = colors.hueSpread ?? 1.6;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale );
  const hueSpeedPhase = t * hueCycles;

  scene.render( {
    columns: 1,
    rows: 1,
    resolutionScale: camera.quality ?? 0.85,
    uniforms: {
      uScroll: scroll,
      uPeriod: period,
      uPipeCount: pipeCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uTwist: twist,
      uSpin: t * spinTurns,
      uRadiusPulse: radiusPulse,
      uPulseWaves: pulseFreq,
      uWeave: weave,
      uHeadZ: headZ,
      uHeadRound: headRound,
      uHeadMerge: headMerge,
      uDragonLipschitz: dragonLipschitz,
      uCamPos: [
        camera.x ?? 0,
        camera.y ?? 0,
        camZ
      ],
      uFocal: focal,
      uPitch: camera.pitch ?? 0,
      uYaw: camera.yaw ?? 0,
      uHueSpeed: hueSpeedPhase,
      uHueSpread: hueSpread,
      uHuePhase: colors.huePhase ?? 0,
      uLengthHueShift: colors.lengthHueShift ?? 0.22,
      uPipeHueShift: colors.pipeHueShift ?? 0.33,
      uShimmer: colors.shimmer ?? 0.9,
      uSaturation: colors.saturation ?? 0.9,
      uBrightness: colors.brightness ?? 1.35,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.22,
      uDiffuse: light.diffuse ?? 0.85,
      uSpecular: light.specular ?? 0.7,
      uSpecPower: light.specPower ?? 32,
      uFresnelPower: light.fresnelPower ?? 2.8,
      uRimStrength: light.rimStrength ?? 0.8,
      uWallColor: corridor.wallColor
        ? corridor.wallColor.map( ( v ) => v / 255 )
        : [
          0.09,
          0.10,
          0.16
        ],
      uWallGlow: corridor.wallGlow ?? 0.7,
      uGlassColor: obstacles.glassColor
        ? obstacles.glassColor.map( ( v ) => v / 255 )
        : [
          0.55,
          0.78,
          0.95
        ],
      uGlassAlpha: obstacles.glassAlpha ?? 0.42,
      uGlassTint: obstacles.glassTint ?? 0.45,
      uFogDensity: corridor.fogDensity ?? 0.11,
      uBgColor: ( o.backgroundColor ?? [
        4,
        4,
        10
      ] ).map( ( v ) => v / 255 )
    }
  } );
} );
