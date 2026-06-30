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
// The iridescent oil-slick surface of "flowers-shaders v2 — pipes" (which stays
// untouched), made INTERACTIVE: ONE smooth pipe is grown along each finger
// MediaPipe detects — the way "splines v1 — interactive" fits one rounded spline
// per finger. Show your hand and every finger wears a single chromatic tube.
//
// ── What is kept from v2, and what changed ───────────────────────────────────
// Kept: the cosine iridescent spectrum and the whole shading model (Fresnel
// oil-slick hue slide, rim glow, spec, chromatic aberration). The pipe still has
// real 3D volume — it is sphere-traced and shaded from its surface normal.
//
// Changed (per the brief): there is NO braid here. v2 wound a *bundle* of pipes
// helically around a shared axis, so the surface rippled with a sinusoidal weave.
// v3 draws a SINGLE tube per finger with NO geometric undulation — its centreline
// is a smooth Chaikin spline through the finger's joints (control-point free, the
// same rounding the `splines` sketches use), and the tube is capped with round
// ends (a capsule per centreline segment, unioned) so a finger's pipe starts and
// ends in a dome instead of a flat cut. The only twist is OPTIONAL and purely
// chromatic: the iridescent bands can spiral around the tube along its length
// (the "twist" slider), the colour equivalent of v2's winding, with none of the
// shape distortion.
//
// ── Geometry (screen space, orthographic) ────────────────────────────────────
// Each finger is uploaded as a short list of centreline points (px) plus a tube
// radius. The SDF is the union of round capsules along that centreline, so the
// surface is an exact distance field (cheap, artefact-free marching) with round
// joints and round caps for free. A fixed orthographic camera looks straight into
// the screen (+z); the tube lies in the z = 0 plane and bulges ±radius in depth,
// which is what gives every finger's pipe its cylindrical, lit volume.
//
// With no hand in front of the camera an idle demo draws a gently waving fan of
// five pipes, so the sketch (and its preview) is always alive.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FINGERS = 10; // 2 hands × 5 fingers
const STRIDE = 14; // max centreline points uploaded per finger
const MAX_STEPS = 80; // sphere-trace iterations per ray
const SURF_EPS = 0.35; // hit threshold (pixels)

const FRAGMENT = `
  const float SURF_EPS = ${ SURF_EPS.toFixed( 2 ) }; // hit threshold (pixels)

  uniform float uT;

  // ── Finger pipes (screen pixels, p5 top-left origin) ──
  uniform int   uFingerCount;
  uniform vec2  uPoints[${ MAX_FINGERS * STRIDE }]; // centrelines, packed per finger
  uniform int   uPointCount[${ MAX_FINGERS }];      // valid points per finger
  uniform float uFingerRadius[${ MAX_FINGERS }];    // tube radius (px)
  uniform float uFingerHue[${ MAX_FINGERS }];       // stable per-finger hue id
  uniform float uMaxDepth;                          // half depth (px) of the ray span

  // ── Surface twist (chromatic only — no geometry) ──
  uniform float uTwist;           // hue-band spiral turns along the tube

  // ── Iridescent palette (shared with v1 / v2 / torsade-shaders) ──
  uniform float uHueSpeed;
  uniform float uHueSpread;
  uniform float uHuePhase;
  uniform float uLengthHueShift;  // hue drift ALONG the tube (bands)
  uniform float uAroundHueShift;  // hue drift AROUND the tube (+ spiral)
  uniform float uFingerHueShift;  // hue offset between fingers
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

  // Distance to the 3D segment a→b (a capsule axis: round caps + round joins),
  // which makes the union below a smooth tube with rounded ends.
  float segDist(vec3 p, vec3 a, vec3 b) {
    vec3 pa = p - a;
    vec3 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);

    return length(pa - ba * h);
  }

  // Union of every finger's tube (exact Euclidean SDF → safe full-length steps).
  float mapScene(vec3 p) {
    float best = 1e9;

    for (int f = 0; f < ${ MAX_FINGERS }; f++) {
      if (f >= uFingerCount) { break; }

      float r = uFingerRadius[f];
      int cnt = uPointCount[f];

      for (int j = 0; j < ${ STRIDE - 1 }; j++) {
        if (j >= cnt - 1) { break; }

        vec3 a = vec3(uPoints[f * ${ STRIDE } + j], 0.0);
        vec3 b = vec3(uPoints[f * ${ STRIDE } + j + 1], 0.0);

        best = min(best, segDist(p, a, b) - r);
      }
    }

    return best;
  }

  // Nearest tube at the hit: fraction along its length, its tangent, and its hue
  // id — for the iridescent banding. Called once per hit, so it can afford the
  // extra length pass.
  void sceneInfo(vec3 p, out float along, out vec3 tang, out float hueOut) {
    float best = 1e9;

    along = 0.0;
    tang = vec3(1.0, 0.0, 0.0);
    hueOut = 0.0;

    for (int f = 0; f < ${ MAX_FINGERS }; f++) {
      if (f >= uFingerCount) { break; }

      float r = uFingerRadius[f];
      int cnt = uPointCount[f];

      float total = 0.0;

      for (int j = 0; j < ${ STRIDE - 1 }; j++) {
        if (j >= cnt - 1) { break; }
        total += distance(uPoints[f * ${ STRIDE } + j], uPoints[f * ${ STRIDE } + j + 1]);
      }

      float run = 0.0;

      for (int j = 0; j < ${ STRIDE - 1 }; j++) {
        if (j >= cnt - 1) { break; }

        vec2 a2 = uPoints[f * ${ STRIDE } + j];
        vec2 b2 = uPoints[f * ${ STRIDE } + j + 1];
        vec3 ba = vec3(b2 - a2, 0.0);
        vec3 pa = p - vec3(a2, 0.0);
        float segLen = length(ba);
        float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-5), 0.0, 1.0);
        float d = length(pa - ba * h) - r;

        if (d < best) {
          best = d;
          along = total > 1.0 ? (run + h * segLen) / total : 0.0;
          tang = segLen > 1e-4 ? vec3(normalize(b2 - a2), 0.0) : vec3(1.0, 0.0, 0.0);
          hueOut = uFingerHue[f];
        }

        run += segLen;
      }
    }
  }

  // 4-tap tetrahedron normal (epsilon in pixels).
  vec3 calcNormal(vec3 p) {
    vec2 k = vec2(1.0, -1.0);
    float e = 0.7;

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

    float step = max(uMaxDepth * 0.25, 1.5);
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
    float along, hueId;
    vec3 tang;

    sceneInfo(pos, along, tang, hueId);

    // Local cross-section frame: u = in-screen perpendicular, depth axis = z. The
    // angle of the normal around that frame is the position AROUND the tube.
    vec3 u = normalize(vec3(-tang.y, tang.x, 0.0));
    float around = atan(n.z, dot(n, u)) / TAU;

    float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), uFresnelPower);

    // The optional twist: the colour bands spiral around the tube as they travel
    // along it — v2's winding expressed purely in hue, with no shape ripple.
    float spiral = around + uTwist * along;

    float phase = along * uLengthHueShift
      + spiral * uAroundHueShift
      + hueId * uFingerHueShift
      + uT * uHueSpeed
      + uShimmer * fres;

    vec3 base = iridescent(phase);

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

// Chaikin corner-cutting (open polyline) — the same control-point-free rounding
// the `splines` sketches use, so the pipe glides smoothly through the joints
// instead of kinking at each one. Endpoints are preserved (the pipe still starts
// at the base and ends at the fingertip).
function chaikin(
  points, iterations
) {
  let result = points.map( ( point ) => ( {
    x: point.x,
    y: point.y
  } ) );

  for ( let iter = 0; iter < iterations; iter++ ) {
    const next = [
      {
        x: result[ 0 ].x,
        y: result[ 0 ].y
      }
    ];

    for ( let i = 0; i < result.length - 1; i++ ) {
      const a = result[ i ];
      const b = result[ i + 1 ];

      next.push( {
        x: 0.75 * a.x + 0.25 * b.x,
        y: 0.75 * a.y + 0.25 * b.y
      } );
      next.push( {
        x: 0.25 * a.x + 0.75 * b.x,
        y: 0.25 * a.y + 0.75 * b.y
      } );
    }

    next.push( {
      x: result[ result.length - 1 ].x,
      y: result[ result.length - 1 ].y
    } );
    result = next;
  }

  return result;
}

function polylineLength( points ) {
  let total = 0;

  for ( let i = 1; i < points.length; i++ ) {
    total += Math.hypot(
      points[ i ].x - points[ i - 1 ].x,
      points[ i ].y - points[ i - 1 ].y
    );
  }

  return total;
}

// Resample a polyline to at most `target` points, evenly by arc length, keeping
// both endpoints. Lets a dense Chaikin curve fit the fixed per-finger uniform
// budget without losing its shape.
function resampleByArcLength(
  points, target
) {
  const n = points.length;

  if ( n <= target ) {
    return points;
  }

  const cumulative = [
    0
  ];
  let total = 0;

  for ( let i = 1; i < n; i++ ) {
    total += Math.hypot(
      points[ i ].x - points[ i - 1 ].x,
      points[ i ].y - points[ i - 1 ].y
    );
    cumulative.push( total );
  }

  if ( total === 0 ) {
    return [
      points[ 0 ],
      points[ n - 1 ]
    ];
  }

  const out = [];
  let segment = 1;

  for ( let k = 0; k < target; k++ ) {
    const target_d = ( total * k ) / ( target - 1 );

    while ( segment < n - 1 && cumulative[ segment ] < target_d ) {
      segment++;
    }

    const d0 = cumulative[ segment - 1 ];
    const d1 = cumulative[ segment ];
    const f = d1 > d0 ? ( target_d - d0 ) / ( d1 - d0 ) : 0;

    out.push( {
      x: points[ segment - 1 ].x + ( points[ segment ].x - points[ segment - 1 ].x ) * f,
      y: points[ segment - 1 ].y + ( points[ segment ].y - points[ segment - 1 ].y ) * f
    } );
  }

  return out;
}

// A waving fan of five finger-like pipes, used when no hand is detected so the
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
      points: [
        {
          x: baseX,
          y: cy
        },
        {
          x: baseX + dirX * fingerLength * 0.5 + perpX * bend * fingerLength * 0.45,
          y: cy + dirY * fingerLength * 0.5 + perpY * bend * fingerLength * 0.45
        },
        {
          x: baseX + dirX * fingerLength,
          y: cy + dirY * fingerLength
        }
      ],
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
  const tube = o.tube ?? {};
  const curve = o.curve ?? {};
  const finger = o.finger ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};
  const interaction = o.interaction ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle * ( o.timeScale ?? 1 );

  // ── One pipe per detected finger (base → tip joint chains). ──
  const groups = getPointerGroups( {
    ...interaction,
    smoothing: finger.smoothing ?? 0
  } );

  let fingerInputs = groups
    .filter( ( group ) => group.source === "fingers" && group.points.length >= 2 )
    .slice(
      0,
      MAX_FINGERS
    )
    .map( ( group ) => ( {
      points: group.points,
      hueId: fingerHueId( group.id )
    } ) );

  if ( fingerInputs.length === 0 && ( finger.idleDemo ?? true ) ) {
    fingerInputs = demoFingers(
      p,
      t
    );
  }

  // ── Build each pipe's smooth centreline and pack the uniform arrays. ──
  const iterations = curve.iterations ?? 3;
  const thickness = tube.thickness ?? 22;
  const thicknessByLength = tube.thicknessByLength ?? 0.04;

  const points = new Float32Array( MAX_FINGERS * STRIDE * 2 );
  const counts = new Int32Array( MAX_FINGERS );
  const radii = new Float32Array( MAX_FINGERS );
  const hues = new Float32Array( MAX_FINGERS );
  let maxRadiusPx = 1;

  fingerInputs.forEach( (
    input, i
  ) => {
    const centreline = resampleByArcLength(
      chaikin(
        input.points,
        iterations
      ),
      STRIDE
    );
    const count = Math.min(
      centreline.length,
      STRIDE
    );

    for ( let j = 0; j < count; j++ ) {
      points[ ( i * STRIDE + j ) * 2 ] = centreline[ j ].x;
      points[ ( i * STRIDE + j ) * 2 + 1 ] = centreline[ j ].y;
    }

    counts[ i ] = count;

    const radiusPx = thickness + thicknessByLength * polylineLength( centreline );

    radii[ i ] = radiusPx;
    hues[ i ] = input.hueId;
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
        int: fingerInputs.length
      },
      uPoints: {
        vec2v: points
      },
      uPointCount: {
        intv: counts
      },
      uFingerRadius: {
        floatv: radii
      },
      uFingerHue: {
        floatv: hues
      },
      uMaxDepth: maxRadiusPx + 4,
      uTwist: tube.twist ?? 1,
      uHueSpeed: colors.hueSpeed ?? 0.6,
      uHueSpread: colors.hueSpread ?? 1.6,
      uHuePhase: colors.huePhase ?? 0,
      uLengthHueShift: colors.lengthHueShift ?? 1.1,
      uAroundHueShift: colors.aroundHueShift ?? 0.7,
      uFingerHueShift: colors.fingerHueShift ?? 0.3,
      uShimmer: colors.shimmer ?? 1.2,
      uSaturation: colors.saturation ?? 0.9,
      uBrightness: colors.brightness ?? 1.3,
      uLightDir: lightDir,
      uAmbient: light.ambient ?? 0.3,
      uDiffuse: light.diffuse ?? 0.75,
      uSpecular: light.specular ?? 0.85,
      uSpecPower: light.specPower ?? 28,
      uFresnelPower: light.fresnelPower ?? 3,
      uRimStrength: light.rimStrength ?? 0.8,
      uOcclusion: light.occlusion ?? 0.5,
      uAberration: aberration.amount ?? 2,
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
