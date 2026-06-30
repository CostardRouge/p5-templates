import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  initInteraction,
  getPointerGroups
} from "@/p5/utils/interaction/index.js";
import {
  drawInteractionOverlay
} from "@/p5/utils/interaction/overlay.js";

// ─────────────────────────────────────────────────────────────────────────────
// flowers-shaders v3 — hand pipes.
//
// The iridescent oil-slick pipe-braid from "flowers-shaders v2 — pipes" (which
// stays untouched), made INTERACTIVE: instead of one infinite braid spun by an
// orbiting camera at the centre of the screen, a short braid is grown along
// every finger MediaPipe detects — exactly the way "splines v1 — interactive"
// fits one spline per detected finger. Show your hand and each finger becomes
// its own twisting bundle of chromatic tubes.
//
// ── How the v2 look is reused ────────────────────────────────────────────────
// The braid geometry, the "untwist" SDF trick, the cosine iridescent spectrum
// and the whole shading model (Fresnel oil-slick hue slide, rim glow, spec,
// chromatic aberration) are carried over verbatim from v2. What changes is the
// *frame* the braid lives in:
//
//   • v2 builds ONE braid around the world y-axis and looks at it with an
//     orbiting pinhole camera.
//   • v3 builds ONE braid PER finger, around that finger's own axis (a 2-segment
//     polyline base→knuckle→tip in screen pixels), and views the whole scene
//     with a fixed orthographic camera that looks straight into the screen (+z).
//     The braid winds in real 3D around the in-plane finger axis (one transverse
//     axis is the screen perpendicular, the other is depth z), so it still has
//     genuine volume, normals and self-occlusion — it is the same tube, just
//     laid flat along your finger instead of spun in front of a camera.
//
// Each finger is passed as three control points (P0 base, P1 mid, P2 tip) plus a
// per-finger world→pixel scale, so the braid sizes itself to the finger. The
// SDF unions two straight braid segments per finger; the helix phase carries the
// arc length across the joint so the weave stays continuous through the bend.
//
// With no hand in front of the camera an idle demo draws a gently waving fan of
// five braids, so the sketch (and its preview) is always alive.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PIPES = 12; // matches the "pipes" slider max (mirrors v2)
const MAX_FINGERS = 10; // 2 hands × 5 fingers
const MAX_STEPS = 96; // sphere-trace iterations per ray
const SURF_EPS = 0.4; // hit threshold (pixels, before the Lipschitz divisor)

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 2 ) }; // hit threshold (pixels)

  uniform float uT;

  // ── Finger geometry (screen pixels, p5 top-left origin) ──
  uniform int   uFingerCount;
  uniform vec2  uP0[${ MAX_FINGERS }];     // finger base
  uniform vec2  uP1[${ MAX_FINGERS }];     // finger middle joint
  uniform vec2  uP2[${ MAX_FINGERS }];     // fingertip
  uniform float uFingerScale[${ MAX_FINGERS }]; // world→pixel scale of the braid
  uniform float uFingerHue[${ MAX_FINGERS }];   // stable per-finger hue id
  uniform float uMaxDepth;                 // half depth (px) of the ortho ray span

  // ── Braid geometry (identical vocabulary to v2; world units) ──
  uniform float uPipeCount;
  uniform float uPipeRadius;
  uniform float uBraidRadius;
  uniform float uTwist;
  uniform float uSpin;
  uniform float uRadiusPulse;
  uniform float uPulseFreq;
  uniform float uPulseSpeed;
  uniform float uTwistLipschitz;

  // ── Iridescent palette (shared with v1 / v2 / torsade-shaders) ──
  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uLengthHueShift;  // hue drift along a pipe's length
  uniform float uPipeHueShift;    // hue offset between neighbouring pipes
  uniform float uFingerHueShift;  // hue offset between neighbouring fingers
  uniform float uShimmer;         // Fresnel-driven oil-slick hue shift
  uniform float uSaturation;
  uniform float uBrightness;

  // ── Lighting ──
  uniform vec3  uLightDir;        // normalised on the CPU
  uniform float uAmbient;
  uniform float uDiffuse;
  uniform float uSpecular;
  uniform float uSpecPower;
  uniform float uFresnelPower;
  uniform float uRimStrength;
  uniform float uOcclusion;       // ambient-occlusion strength (0 = off)

  // ── Chromatic aberration ──
  uniform float uAberration;      // channel separation in pixels (0 = off)
  uniform int   uAberrationMode;  // 0 = radial, 1 = horizontal

  // Oil-slick / thin-film iridescence — identical to flowers-shaders v1/v2.
  vec3 iridescent(float t) {
    vec3 spectrum = 0.5 + 0.5 * cos(
      TAU * (uHueSpread * t + vec3(0.0, 0.33, 0.67)) + uHuePhase
    );

    float luma = dot(spectrum, vec3(0.299, 0.587, 0.114));

    return clamp(mix(vec3(luma), spectrum, uSaturation) * uBrightness, 0.0, 1.0);
  }

  // braidRadius pulsing along the axis — the per-finger echo of v2's swell.
  float braidRadiusAt(float arc) {
    return uBraidRadius * (1.0 + uRadiusPulse * sin(arc * uPulseFreq + uT * uPulseSpeed));
  }

  // Signed distance (in pixels, after the conservative twist divisor) to one
  // straight braid segment A→B. arc0 is the braid arc length already travelled
  // before A (in pixels), so the helix phase stays continuous across the bend.
  float braidSeg(vec3 p, vec2 A, vec2 B, float arc0, float scalePx) {
    vec2 ab = B - A;
    float len = length(ab);

    if (len < 1.0) { return 1e9; }

    vec2 tang = ab / len;
    vec2 perp = vec2(-tang.y, tang.x);
    vec2 rel = p.xy - A;

    float alongRaw = dot(rel, tang);
    float along = clamp(alongRaw, 0.0, len);
    vec2 axisPt = A + tang * along;

    // Transverse plane: x = in-screen perpendicular, y = depth. Convert to world.
    vec2 w = vec2(dot(p.xy - axisPt, perp), p.z) / scalePx;
    float rad = length(w); // rotation-invariant, so no need to untwist for this

    float arc = (arc0 + along) / scalePx;
    float br = braidRadiusAt(arc);

    float dRad;

    if (rad > br + uPipeRadius + 0.4) {
      // Outside the orbit shell: the nearest pipe surface is at least this far,
      // so skip the untwist + per-pipe union entirely (cheap broad phase).
      dRad = rad - br - uPipeRadius;
    } else {
      // Inside the shell: untwist space, then union the N straight tubes.
      float phi = arc * uTwist + uT * uSpin;
      float c = cos(phi);
      float s = sin(phi);
      vec2  q = vec2(c * w.x - s * w.y, s * w.x + c * w.y);

      float best = 1e9;

      for (int k = 0; k < ${ MAX_PIPES }; k++) {
        if (float(k) >= uPipeCount) { break; }

        float a = TAU * float(k) / uPipeCount;
        vec2  centre = br * vec2(cos(a), sin(a));

        best = min(best, length(q - centre) - uPipeRadius);
      }

      dRad = best;
    }

    // Cap the braid at the segment ends: extrude the cross-section over [0,len].
    float dLong = max(-alongRaw, alongRaw - len) / scalePx;
    vec2  e = vec2(dRad, dLong);
    float dWorld = min(max(dRad, dLong), 0.0) + length(max(e, 0.0));

    return dWorld * scalePx / uTwistLipschitz;
  }

  // Union of every finger's two braid segments.
  float mapScene(vec3 p) {
    float best = uMaxDepth * 8.0;

    for (int f = 0; f < ${ MAX_FINGERS }; f++) {
      if (f >= uFingerCount) { break; }

      float scalePx = uFingerScale[f];
      vec2  A = uP0[f];
      vec2  M = uP1[f];
      vec2  B = uP2[f];
      float lenA = length(M - A);

      best = min(best, braidSeg(p, A, M, 0.0, scalePx));
      best = min(best, braidSeg(p, M, B, lenA, scalePx));
    }

    return best;
  }

  // Like braidSeg but also reports the nearest pipe index and the arc length at
  // the hit, for colour banding. Always does the full union (called once/hit).
  float braidSegInfo(
    vec3 p, vec2 A, vec2 B, float arc0, float scalePx,
    out float pipeK, out float arcOut
  ) {
    pipeK = 0.0;
    arcOut = 0.0;

    vec2 ab = B - A;
    float len = length(ab);

    if (len < 1.0) { return 1e9; }

    vec2 tang = ab / len;
    vec2 perp = vec2(-tang.y, tang.x);
    vec2 rel = p.xy - A;

    float alongRaw = dot(rel, tang);
    float along = clamp(alongRaw, 0.0, len);
    vec2 axisPt = A + tang * along;

    vec2 w = vec2(dot(p.xy - axisPt, perp), p.z) / scalePx;
    float arc = (arc0 + along) / scalePx;
    float br = braidRadiusAt(arc);

    float phi = arc * uTwist + uT * uSpin;
    float c = cos(phi);
    float s = sin(phi);
    vec2  q = vec2(c * w.x - s * w.y, s * w.x + c * w.y);

    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_PIPES }; k++) {
      if (float(k) >= uPipeCount) { break; }

      float a = TAU * float(k) / uPipeCount;
      vec2  centre = br * vec2(cos(a), sin(a));
      float d = length(q - centre) - uPipeRadius;

      if (d < best) { best = d; bestK = float(k); }
    }

    arcOut = arc;
    pipeK = bestK;

    float dLong = max(-alongRaw, alongRaw - len) / scalePx;
    vec2  e = vec2(best, dLong);
    float dWorld = min(max(best, dLong), 0.0) + length(max(e, 0.0));

    return dWorld * scalePx / uTwistLipschitz;
  }

  // Nearest pipe / arc / finger-hue at the hit point, for shading.
  void sceneInfo(vec3 p, out float kOut, out float arcOut, out float hueOut) {
    float best = 1e30;

    kOut = 0.0;
    arcOut = 0.0;
    hueOut = 0.0;

    for (int f = 0; f < ${ MAX_FINGERS }; f++) {
      if (f >= uFingerCount) { break; }

      float scalePx = uFingerScale[f];
      vec2  A = uP0[f];
      vec2  M = uP1[f];
      vec2  B = uP2[f];
      float lenA = length(M - A);

      float k1, a1;
      float d1 = braidSegInfo(p, A, M, 0.0, scalePx, k1, a1);

      if (d1 < best) { best = d1; kOut = k1; arcOut = a1; hueOut = uFingerHue[f]; }

      float k2, a2;
      float d2 = braidSegInfo(p, M, B, lenA, scalePx, k2, a2);

      if (d2 < best) { best = d2; kOut = k2; arcOut = a2; hueOut = uFingerHue[f]; }
    }
  }

  // 4-tap tetrahedron normal (epsilon in pixels).
  vec3 calcNormal(vec3 p) {
    vec2 k = vec2(1.0, -1.0);
    float e = 0.75;

    return normalize(
      k.xyy * mapScene(p + k.xyy * e) +
      k.yyx * mapScene(p + k.yyx * e) +
      k.yxy * mapScene(p + k.yxy * e) +
      k.xxx * mapScene(p + k.xxx * e)
    );
  }

  // Cheap ambient occlusion — a few short steps along the normal (pixel units).
  float calcAO(vec3 p, vec3 n) {
    if (uOcclusion <= 0.0) { return 1.0; }

    float step = max(uMaxDepth * 0.18, 1.5);
    float occ = 0.0;
    float sca = 1.0;

    for (int i = 0; i < 4; i++) {
      float h = step * (0.5 + float(i));
      float d = mapScene(p + n * h);

      occ += (h - d) * sca;
      sca *= 0.6;
    }

    return clamp(1.0 - uOcclusion * occ / step, 0.0, 1.0);
  }

  vec3 shade(vec3 pos, vec3 n, vec3 rd) {
    float k, arc, fingerHue;

    sceneInfo(pos, k, arc, fingerHue);

    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);

    float phase = arc * uLengthHueShift
      + uT * uHueSpeed
      + k * uPipeHueShift
      + fingerHue * uFingerHueShift;

    vec3 base = iridescent(phase + uShimmer * fres);

    float diff = max(dot(n, uLightDir), 0.0);
    vec3  hlf = normalize(uLightDir - rd);
    float spec = pow(max(dot(n, hlf), 0.0), uSpecPower) * uSpecular;
    float ao = calcAO(pos, n);

    vec3 col = base * (uAmbient + uDiffuse * diff * ao);
    col += base * fres * uRimStrength; // iridescent edge glow
    col += vec3(spec) * ao;            // white-ish highlight

    return col;
  }

  // Orthographic sphere-trace straight into the screen (+z).
  vec4 traceRay(vec3 ro, vec3 rd) {
    float t = 0.0;
    bool  hit = false;
    float far = 2.0 * uMaxDepth;

    for (int i = 0; i < ${ MAX_STEPS }; i++) {
      vec3  pos = ro + rd * t;
      float d = mapScene(pos);

      if (d < SURF_EPS) { hit = true; break; }

      t += d;

      if (t > far) { break; }
    }

    if (!hit) { return vec4(0.0); }

    vec3 pos = ro + rd * t;
    vec3 n = calcNormal(pos);
    vec3 col = shade(pos, n, rd);

    return vec4(col, 1.0);
  }

  void main() {
    // p5 top-left pixel coordinates, matching the finger landmarks.
    vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uResolution;

    vec3 ro = vec3(px, -uMaxDepth);
    vec3 rd = vec3(0.0, 0.0, 1.0);

    if (uAberration < 0.5) {
      gl_FragColor = traceRay(ro, rd);
      return;
    }

    // Split R/B along slightly offset (in-plane) rays for a lens-like fringe.
    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize((px - 0.5 * uResolution) + vec2(1e-4));
    vec3 off = vec3(dir * uAberration, 0.0);

    vec4 cr = traceRay(ro + off, rd);
    vec4 cg = traceRay(ro, rd);
    vec4 cb = traceRay(ro - off, rd);

    gl_FragColor = vec4(cr.r, cg.g, cb.b, max(cr.a, max(cg.a, cb.a)));
  }
`;

const pipes = createNoiseFieldRenderer( FRAGMENT );

// Map a finger group id ("hand-0-thumb") to a stable hue id so a finger keeps
// its colour even as MediaPipe re-orders detections between frames.
const FINGER_HUE_ID = {
  thumb: 0,
  index: 1,
  middle: 2,
  ring: 3,
  pinky: 4
};

function fingerHueId( id ) {
  const parts = String( id ).split( "-" );
  const hand = Number( parts[ 1 ] ) || 0;
  const name = parts[ 2 ];

  return hand * 5 + ( FINGER_HUE_ID[ name ] ?? 0 );
}

// Reduce a finger's joint chain (base → tip) to three control points: base,
// the joint nearest the arc-length midpoint (the dominant bend), and the tip.
function controlPoints( pointsList ) {
  const n = pointsList.length;
  const last = n - 1;

  const cumulative = [
    0
  ];
  let total = 0;

  for ( let i = 1; i < n; i++ ) {
    total += Math.hypot(
      pointsList[ i ].x - pointsList[ i - 1 ].x,
      pointsList[ i ].y - pointsList[ i - 1 ].y
    );
    cumulative.push( total );
  }

  let midIndex = 1;
  let bestDiff = Infinity;

  for ( let i = 0; i < n; i++ ) {
    const diff = Math.abs( cumulative[ i ] - total / 2 );

    if ( diff < bestDiff ) {
      bestDiff = diff;
      midIndex = i;
    }
  }

  // Keep the mid strictly between the ends when the chain is long enough.
  midIndex = Math.min(
    Math.max(
      midIndex,
      1
    ),
    Math.max(
      last - 1,
      1
    )
  );

  return {
    p0: pointsList[ 0 ],
    p1: pointsList[ midIndex ],
    p2: pointsList[ last ],
    length: total
  };
}

// A waving fan of five finger-like braids, used when no hand is detected so the
// effect (and the template preview) is never an empty frame.
function demoFingers(
  p, t
) {
  const cx = p.width * 0.5;
  const cy = p.height * 0.66;
  const fingerLength = Math.min(
    p.width,
    p.height
  ) * 0.27;
  const spread = [
    -0.55,
    -0.26,
    0,
    0.24,
    0.5
  ];
  const fingers = [];

  for ( let i = 0; i < 5; i++ ) {
    const wobble = Math.sin( t * 0.6 + i * 0.7 ) * 0.13;
    const angle = -Math.PI / 2 + spread[ i ] + wobble;
    const bend = 0.16 + 0.13 * Math.sin( t * 0.8 + i * 1.1 );
    const dirX = Math.cos( angle );
    const dirY = Math.sin( angle );
    const perpX = -dirY;
    const perpY = dirX;
    const baseX = cx + ( i - 2 ) * fingerLength * 0.2;

    fingers.push( {
      p0: {
        x: baseX,
        y: cy
      },
      p1: {
        x: baseX + dirX * fingerLength * 0.5 + perpX * bend * fingerLength * 0.45,
        y: cy + dirY * fingerLength * 0.5 + perpY * bend * fingerLength * 0.45
      },
      p2: {
        x: baseX + dirX * fingerLength,
        y: cy + dirY * fingerLength
      },
      length: fingerLength,
      hueId: i
    } );
  }

  return fingers;
}

sketch.setup( async() => {
  await initInteraction( options.sketch?.interaction ?? {} );
} );

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const braid = o.braid ?? {};
  const layout = o.layout ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};
  const interaction = o.interaction ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle * ( o.timeScale ?? 1 );

  // ── Collect one braid per detected finger (base → tip joint chains). ──
  const groups = getPointerGroups( {
    ...interaction,
    smoothing: layout.smoothing ?? 0
  } );

  let fingers = groups
    .filter( ( group ) => group.source === "fingers" && group.points.length >= 2 )
    .slice(
      0,
      MAX_FINGERS
    )
    .map( ( group ) => {
      const cp = controlPoints( group.points );

      return {
        ...cp,
        hueId: fingerHueId( group.id )
      };
    } );

  if ( fingers.length === 0 && ( layout.idleDemo ?? true ) ) {
    fingers = demoFingers(
      p,
      t
    );
  }

  // ── Braid sizing (world → pixels), shared by every finger. ──
  const pipeCount = Math.min(
    braid.pipeCount ?? 4,
    MAX_PIPES
  );
  const pipeRadius = braid.pipeRadius ?? 0.21;
  const braidRadius = braid.braidRadius ?? 0.56;
  const twist = braid.twist ?? 2.08;
  const radiusPulse = braid.radiusPulse ?? 0.47;
  const pulseFreq = braid.pulseFreq ?? 1.38;

  // The braid's largest world radius — maps to `thickness` pixels on screen.
  const maxR = braidRadius * ( 1 + radiusPulse ) + pipeRadius;
  const thickness = layout.thickness ?? 26;
  const thicknessByLength = layout.thicknessByLength ?? 0.06;

  // Conservative Lipschitz bound for the twisted field (identical to v2).
  const pulseSlope = braidRadius * radiusPulse * pulseFreq;
  const twistLipschitz = Math.sqrt( 1 + ( maxR * twist + pulseSlope ) ** 2 ) * 1.1;

  // Pack the per-finger uniform arrays (padded to MAX_FINGERS).
  const p0 = new Float32Array( MAX_FINGERS * 2 );
  const p1 = new Float32Array( MAX_FINGERS * 2 );
  const p2 = new Float32Array( MAX_FINGERS * 2 );
  const scales = new Float32Array( MAX_FINGERS );
  const hues = new Float32Array( MAX_FINGERS );
  let maxRadiusPx = 1;

  fingers.forEach( (
    finger, i
  ) => {
    p0[ i * 2 ] = finger.p0.x;
    p0[ i * 2 + 1 ] = finger.p0.y;
    p1[ i * 2 ] = finger.p1.x;
    p1[ i * 2 + 1 ] = finger.p1.y;
    p2[ i * 2 ] = finger.p2.x;
    p2[ i * 2 + 1 ] = finger.p2.y;

    const radiusPx = thickness + thicknessByLength * finger.length;

    scales[ i ] = Math.max(
      radiusPx / maxR,
      2
    );
    hues[ i ] = finger.hueId;
    maxRadiusPx = Math.max(
      maxRadiusPx,
      radiusPx
    );
  } );

  // Light direction from azimuth/elevation sliders (kept off the GLSL form).
  const az = light.azimuth ?? -1.29;
  const el = light.elevation ?? -0.6;
  const lightDir = [
    Math.cos( el ) * Math.sin( az ),
    Math.sin( el ),
    -Math.cos( el ) * Math.cos( az )
  ];

  pipes.render( {
    columns: 1,
    rows: 1,
    uniforms: {
      uT: t,
      uFingerCount: {
        int: fingers.length
      },
      uP0: {
        vec2v: p0
      },
      uP1: {
        vec2v: p1
      },
      uP2: {
        vec2v: p2
      },
      uFingerScale: {
        floatv: scales
      },
      uFingerHue: {
        floatv: hues
      },
      uMaxDepth: maxRadiusPx * 1.1 + 4,
      uPipeCount: pipeCount,
      uPipeRadius: pipeRadius,
      uBraidRadius: braidRadius,
      uTwist: twist,
      uSpin: braid.spin ?? -0.77,
      uRadiusPulse: radiusPulse,
      uPulseFreq: pulseFreq,
      uPulseSpeed: braid.pulseSpeed ?? 2.12,
      uTwistLipschitz: twistLipschitz,
      uHueSpeed: colors.hueSpeed ?? 1.15,
      uHueSpread: colors.hueSpread ?? 2.03,
      uHuePhase: colors.huePhase ?? 2.63,
      uLengthHueShift: colors.lengthHueShift ?? -0.36,
      uPipeHueShift: colors.pipeHueShift ?? -0.96,
      uFingerHueShift: colors.fingerHueShift ?? 0.4,
      uShimmer: colors.shimmer ?? 2.82,
      uSaturation: colors.saturation ?? 0.88,
      uBrightness: colors.brightness ?? 1.3,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.34,
      uDiffuse: light.diffuse ?? 0.66,
      uSpecular: light.specular ?? 0.99,
      uSpecPower: light.specPower ?? 24,
      uFresnelPower: light.fresnelPower ?? 3.3,
      uRimStrength: light.rimStrength ?? 0.87,
      uOcclusion: light.occlusion ?? 0.6,
      uAberration: aberration.amount ?? 3,
      uAberrationMode: {
        int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
      }
    }
  } );

  renderTitle();

  // Optional debug overlay (camera preview, finger chains, legend) — every piece
  // is gated by Interaction → Visualization / Vision so it only shows on demand.
  drawInteractionOverlay( interaction );
} );
