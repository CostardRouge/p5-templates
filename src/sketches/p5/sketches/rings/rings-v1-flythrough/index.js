import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";
import {
  BRAID_UNIFORMS_GLSL,
  IRIDESCENT_GLSL,
  braidShadingGlsl,
  lightDirFrom,
  focalFromFov
} from "@/p5/utils/braidShader.js";
import easing from "@/p5/utils/easing.js";

// ─────────────────────────────────────────────────────────────────────────────
// rings v1 — flythrough.
//
// The braid family's iridescent tori, set free: N rings float in space along a
// closed circuit and a first-person camera flies through them forever. Between
// two rings the camera EASES — it accelerates out of the ring it just crossed,
// glides, and settles into the next one — while its gaze eases onto the middle
// of the target ring, so every approach is aimed at the ring's centre and
// angle before threading it. Reuses the shared pipes vocabulary (iridescent
// palette + fresnel/rim shading + aberration) from braidShader.
//
// ── Geometry ─────────────────────────────────────────────────────────────────
// Ring k sits at parameter aₖ = TAU·k/N of a closed path: a circle of radius
// `spread` in the xz-plane, radius-modulated by a wobble and lifted by a
// vertical wave (both an integer number of cycles around the circle, so the
// circuit closes exactly). Each ring's plane faces the path tangent, tipped by
// a seeded per-ring jitter so the passages feel hand-placed rather than
// machined. Centres, normals and per-ring (breathing) tube radii are computed
// on the CPU once per frame and uploaded as uniform arrays — mapScene is then
// a pure union of exact torus SDFs with no trig, so the march is fast and
// needs no Lipschitz divisor.
//
// ── Camera (the actual subject) ──────────────────────────────────────────────
// The loop clock sweeps the camera through all N segments per loop. Within a
// segment, progress u is blended toward ease(u) by the `glide` amount — full
// glide gives a dwell at every ring, zero keeps constant speed. The look-at
// target is mix(next ring centre, following ring centre, eased u): at the
// start of a segment the camera looks dead at the middle of the ring it is
// approaching, and as it crosses, its gaze slides on to the one after —
// continuous at every boundary, so orientation eases exactly like position.
// A bank option rolls the camera into the upcoming horizontal turn (FPV
// style), interpolated with the same easing.
//
// ── Loop safety ──────────────────────────────────────────────────────────────
// Geometry is static apart from the tube "breathing" (whole cycles per loop)
// and the hue scroll (whole palette periods per loop); the camera completes
// exactly one circuit per loop, so uT = TAU lands on the uT = 0 frame.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RINGS = 24; // matches the "count" slider max
const MAX_STEPS = 96; // exact SDF union — converges fast

const FRAGMENT = `
  ${ BRAID_UNIFORMS_GLSL }

  // ── Ring field (CPU-computed layout, uploaded per frame) ──
  uniform float uRingCount;
  uniform float uRingR;                    // torus major radius
  uniform vec3  uRingPos[${ MAX_RINGS }];  // ring centres
  uniform vec3  uRingNrm[${ MAX_RINGS }];  // unit ring-plane normals
  uniform float uRingRad[${ MAX_RINGS }];  // per-ring tube radii (breathing baked in)

  // ── Fly-through camera basis (CPU look-at, eased) ──
  uniform vec3 uCamPos;
  uniform vec3 uCamFwd;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;

  ${ IRIDESCENT_GLSL }

  // Exact distance to torus k: split the offset into the ring plane and along
  // its normal, then it is a circle-of-radius-uRingR distance minus the tube.
  float ringDist(vec3 q, vec3 n, float rr) {
    float qn = dot(q, n);
    vec2 w = vec2(length(q - n * qn) - uRingR, qn);

    return length(w) - rr;
  }

  float mapScene(vec3 p) {
    float best = 1e9;

    for (int k = 0; k < ${ MAX_RINGS }; k++) {
      if (float(k) >= uRingCount) { break; }

      best = min(best, ringDist(p - uRingPos[k], uRingNrm[k], uRingRad[k]));
    }

    return best;
  }

  // Which ring owns the hit — drives the per-ring hue offset.
  float nearestPipe(vec3 p) {
    float best = 1e9;
    float bestK = 0.0;

    for (int k = 0; k < ${ MAX_RINGS }; k++) {
      if (float(k) >= uRingCount) { break; }

      float d = ringDist(p - uRingPos[k], uRingNrm[k], uRingRad[k]);

      if (d < best) { best = d; bestK = float(k); }
    }

    return bestK;
  }

  ${ braidShadingGlsl( {
    maxSteps: MAX_STEPS
  } ) }

  // First-person camera: the eased position + look-at basis comes in as
  // uniforms (unlike the family's orbit camera), aberration handled as in
  // BRAID_CAMERA_MAIN_GLSL.
  void main() {
    vec2 frag = vec2(vUv.x * uResolution.x, vUv.y * uResolution.y);
    vec2 uv = (frag - 0.5 * uResolution) / uResolution.y;

    vec3 ro = uCamPos;

    if (uAberration < 0.5) {
      vec3 rd = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);
      gl_FragColor = traceRay(ro, rd);
      return;
    }

    vec2 dir = uAberrationMode == 1
      ? vec2(1.0, 0.0)
      : normalize(uv + vec2(1e-4));
    vec2 off = dir * (uAberration / uResolution.y);

    vec3 rdR = normalize(uCamFwd * uFocal + uCamRight * (uv.x + off.x) + uCamUp * (uv.y + off.y));
    vec3 rdG = normalize(uCamFwd * uFocal + uCamRight * uv.x + uCamUp * uv.y);
    vec3 rdB = normalize(uCamFwd * uFocal + uCamRight * (uv.x - off.x) + uCamUp * (uv.y - off.y));

    vec4 cr4 = traceRay(ro, rdR);
    vec4 cg4 = traceRay(ro, rdG);
    vec4 cb4 = traceRay(ro, rdB);

    gl_FragColor = vec4(cr4.r, cg4.g, cb4.b, max(cr4.a, max(cg4.a, cb4.a)));
  }
`;

const ringsRenderer = createNoiseFieldRenderer( FRAGMENT );

// ── Small vector helpers (module-local, arrays as [x, y, z]) ─────────────────
function sub(
  a, b
) {
  return [
    a[ 0 ] - b[ 0 ],
    a[ 1 ] - b[ 1 ],
    a[ 2 ] - b[ 2 ]
  ];
}

function cross(
  a, b
) {
  return [
    a[ 1 ] * b[ 2 ] - a[ 2 ] * b[ 1 ],
    a[ 2 ] * b[ 0 ] - a[ 0 ] * b[ 2 ],
    a[ 0 ] * b[ 1 ] - a[ 1 ] * b[ 0 ]
  ];
}

function normalize( v ) {
  const l = Math.hypot(
    v[ 0 ],
    v[ 1 ],
    v[ 2 ]
  );

  return l > 1e-6
    ? [
      v[ 0 ] / l,
      v[ 1 ] / l,
      v[ 2 ] / l
    ]
    : [
      1,
      0,
      0
    ];
}

function lerp3(
  a, b, t
) {
  return [
    a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t,
    a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t,
    a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t
  ];
}

// Seeded hash in [-1, 1] — deterministic, so previews and recordings match.
function hash11( n ) {
  const s = Math.sin( n ) * 43758.5453123;

  return ( s - Math.floor( s ) ) * 2 - 1;
}

// Point of the closed circuit at angle a: a wobble-modulated circle in the
// xz-plane plus a vertical wave, both whole cycles so the loop closes exactly.
function pathPoint(
  a, path
) {
  const radius = path.spread
    * ( 1 + path.wobble * Math.sin( path.wobbleCycles * a + 0.9 ) );

  return [
    radius * Math.sin( a ),
    path.waveAmplitude * Math.sin( path.waveCycles * a + 2.1 ),
    -radius * Math.cos( a )
  ];
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};
  const rings = o.rings ?? {};
  const path = o.path ?? {};
  const camera = o.camera ?? {};
  const colors = o.colors ?? {};
  const light = o.light ?? {};
  const aberration = o.aberration ?? {};
  const rendering = o.rendering ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const timeScale = o.timeScale ?? 1;
  const t = animation.angle;

  // ── Layout parameters ────────────────────────────────────────────────────
  const count = Math.max(
    3,
    Math.min(
      Math.round( rings.count ?? 8 ),
      MAX_RINGS
    )
  );
  const pulse = Math.min(
    rings.pulse ?? 0.15,
    0.9
  );
  const ringR = Math.max(
    rings.radius ?? 1.15,
    0.2
  );

  // The camera threads every ring dead-centre, so the aperture must stay open:
  // cap the tube (at max breath) to a third of the major radius.
  const tubeR = Math.min(
    rings.tube ?? 0.16,
    ( ringR * 0.33 ) / ( 1 + pulse )
  );
  const tilt = rings.tilt ?? 0.35;
  const seed = rings.seed ?? 7;

  const pathConfig = {
    spread: path.spread ?? 5.5,
    wobble: path.wobble ?? 0.12,
    wobbleCycles: Math.round( path.wobbleCycles ?? 3 ),
    waveAmplitude: path.waveAmplitude ?? 1.1,
    waveCycles: Math.round( path.waveCycles ?? 2 )
  };

  // Breathing: whole cycles per loop (seam-safe), staggered around the circuit
  // so the swell travels from ring to ring.
  const pulseCycles = Math.round( ( rings.pulseSpeed ?? 1 ) * timeScale );
  const pulseStagger = rings.pulseStagger ?? 1;

  // ── Per-frame ring field (cheap: N ≤ 24) ─────────────────────────────────
  const centres = [];
  const normals = [];
  const radii = new Array( MAX_RINGS ).fill( 0 );

  for ( let k = 0; k < count; k++ ) {
    const a = ( p.TAU * k ) / count;
    const centre = pathPoint(
      a,
      pathConfig
    );
    const tangent = normalize( sub(
      pathPoint(
        a + 0.01,
        pathConfig
      ),
      pathPoint(
        a - 0.01,
        pathConfig
      )
    ) );

    // Seeded tip of the ring plane away from the pure tangent — the passages
    // read as placed, not machined. The hole stays centred on the path, so the
    // camera clears it at any jitter.
    const jitter = [
      hash11( k * 12.9898 + seed * 7.13 ),
      hash11( k * 78.233 + seed * 3.71 ),
      hash11( k * 37.719 + seed * 5.39 )
    ];

    centres.push( centre );
    normals.push( normalize( [
      tangent[ 0 ] + tilt * jitter[ 0 ],
      tangent[ 1 ] + tilt * 0.6 * jitter[ 1 ],
      tangent[ 2 ] + tilt * jitter[ 2 ]
    ] ) );

    radii[ k ] = tubeR * ( 1 + pulse * Math.sin( pulseCycles * t + ( p.TAU * k * pulseStagger ) / count ) );
  }

  // ── Camera: one full circuit per loop ────────────────────────────────────
  // Two motions share the same circuit (position and gaze stay continuous
  // across the loop seam in both):
  //   • "flow"  — constant-speed glide that never slows at a ring. The rings
  //               sit ON the circuit, so the smooth path threads each one
  //               dead-centre; the gaze aims at a point further along the SAME
  //               path, so orientation is C-infinity smooth with no per-ring
  //               deceleration.
  //   • "ease"  — accelerate out of the ring just crossed and settle into the
  //               next (the original per-segment easing + look-at blend).
  const motion = camera.motion ?? "flow";
  const bank = camera.bank ?? 0.5;

  const progress = ( ( t / p.TAU ) % 1 + 1 ) % 1;
  const s = progress * count;
  const angleOf = ( ss ) => ( p.TAU * ss ) / count;

  let camPos;
  let fwd;
  let roll = 0;

  if ( motion === "flow" ) {
    const ahead = Math.max(
      camera.lookAhead ?? 1.4,
      0.2
    );

    camPos = pathPoint(
      angleOf( s ),
      pathConfig
    );
    fwd = normalize( sub(
      pathPoint(
        angleOf( s + ahead ),
        pathConfig
      ),
      camPos
    ) );

    if ( bank !== 0 ) {
      // Smooth bank from the path's turn rate over a one-segment window.
      const before = normalize( sub(
        camPos,
        pathPoint(
          angleOf( s - 0.5 ),
          pathConfig
        )
      ) );
      const after = normalize( sub(
        pathPoint(
          angleOf( s + 0.5 ),
          pathConfig
        ),
        camPos
      ) );

      roll = bank * Math.atan2(
        before[ 0 ] * after[ 2 ] - before[ 2 ] * after[ 0 ],
        before[ 0 ] * after[ 0 ] + before[ 2 ] * after[ 2 ]
      );
    }
  } else {
    const glide = Math.max(
      0,
      Math.min(
        camera.glide ?? 0.85,
        1
      )
    );
    const easeKey = camera.easing ?? "easeInOutCubic";
    const easeFn = typeof easing[ easeKey ] === "function" ? easing[ easeKey ] : ( x ) => x;

    const seg = Math.min(
      Math.floor( s ),
      count - 1
    );
    const u = s - seg;
    const ue = u + ( easeFn( u ) - u ) * glide;

    camPos = pathPoint(
      angleOf( seg + ue ),
      pathConfig
    );

    // Gaze: from the middle of the target ring onto the one after, eased with
    // the same curve as the position — continuous at every ring crossing.
    const target = lerp3(
      centres[ ( seg + 1 ) % count ],
      centres[ ( seg + 2 ) % count ],
      ue
    );

    fwd = normalize( sub(
      target,
      camPos
    ) );

    if ( bank !== 0 ) {
      const turnAt = ( i ) => {
        const prev = centres[ ( i - 1 + count ) % count ];
        const here = centres[ i % count ];
        const next = centres[ ( i + 1 ) % count ];
        const v1 = normalize( sub(
          here,
          prev
        ) );
        const v2 = normalize( sub(
          next,
          here
        ) );

        return Math.atan2(
          v1[ 0 ] * v2[ 2 ] - v1[ 2 ] * v2[ 0 ],
          v1[ 0 ] * v2[ 0 ] + v1[ 2 ] * v2[ 2 ]
        );
      };

      roll = bank * ( turnAt( seg + 1 ) + ( turnAt( seg + 2 ) - turnAt( seg + 1 ) ) * ue );
    }
  }

  let right = normalize( cross(
    [
      0,
      1,
      0
    ],
    fwd
  ) );
  let up = cross(
    fwd,
    right
  );

  // ── Apply the FPV bank roll to the camera basis ──────────────────────────
  if ( roll !== 0 ) {
    const cr = Math.cos( roll );
    const sr = Math.sin( roll );
    const rolledRight = [
      right[ 0 ] * cr + up[ 0 ] * sr,
      right[ 1 ] * cr + up[ 1 ] * sr,
      right[ 2 ] * cr + up[ 2 ] * sr
    ];

    up = [
      up[ 0 ] * cr - right[ 0 ] * sr,
      up[ 1 ] * cr - right[ 1 ] * sr,
      up[ 2 ] * cr - right[ 2 ] * sr
    ];
    right = rolledRight;
  }

  // ── Palette / lighting ───────────────────────────────────────────────────
  const hueSpread = colors.hueSpread ?? 2;
  const hueCycles = Math.round( ( colors.hueSpeed ?? 1 ) * timeScale * p.TAU * hueSpread );

  const fov = camera.fov ?? 80;
  const maxRadius = pathConfig.spread * ( 1 + Math.abs( pathConfig.wobble ) );
  const maxDist = 2 * maxRadius + 2 * Math.abs( pathConfig.waveAmplitude ) + ringR + 2;

  const lightDir = lightDirFrom(
    light.azimuth ?? -1.1,
    light.elevation ?? 0.45
  );

  const uniforms = {
    uT: t,
    uRingCount: count,
    uRingR: ringR,
    uRingRad: {
      floatv: radii
    },
    uCamPos: camPos,
    uCamFwd: fwd,
    uCamRight: right,
    uCamUp: up,
    uFocal: focalFromFov( fov ),
    uHueSpeed: hueSpread ? hueCycles / ( p.TAU * hueSpread ) : 0,
    uHueSpread: hueSpread,
    uHuePhase: colors.huePhase ?? 2.6,
    uLengthHueShift: colors.lengthHueShift ?? -0.25,
    uPipeHueShift: colors.pipeHueShift ?? 0.6,
    uShimmer: colors.shimmer ?? 2.2,
    uSaturation: colors.saturation ?? 0.7,
    uBrightness: colors.brightness ?? 1.25,
    uLightDir: lightDir,
    uAmbient: light.ambient ?? 0.3,
    uDiffuse: light.diffuse ?? 0.75,
    uSpecular: light.specular ?? 1.1,
    uSpecPower: light.specPower ?? 42,
    uFresnelPower: light.fresnelPower ?? 2.6,
    uRimStrength: light.rimStrength ?? 0.8,
    uShadowSoft: light.shadowSoftness ?? 0,
    uMaxDist: maxDist,
    uAberration: aberration.amount ?? 0,
    uAberrationMode: {
      int: ( aberration.mode ?? "radial" ) === "horizontal" ? 1 : 0
    }
  };

  for ( let k = 0; k < count; k++ ) {
    uniforms[ `uRingPos[${ k }]` ] = centres[ k ];
    uniforms[ `uRingNrm[${ k }]` ] = normals[ k ];
  }

  ringsRenderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: rendering.resolutionScale ?? 0.75,
    uniforms
  } );
} );
