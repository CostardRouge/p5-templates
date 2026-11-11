import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createNoiseFieldRenderer from "@/p5/utils/noiseFieldGpu.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// materials-v5-ice
//
// A block of clear ice turning slowly in studio light.
//
// The block is a convex polyhedron — the space inside a set of planes — and
// that is what makes real refraction affordable: where a ray enters and
// where it leaves are both the answer to a handful of ray-plane divisions,
// with no marching and facets as sharp as the arithmetic. A ray bends in
// through one facet, crosses the ice, and at each facet it reaches it either
// bends out towards the light or, past the critical angle, is thrown back
// inside to try the next one. Following it for a few of those bounces is
// what gives a block of ice (or of glass, or a diamond: the index is a
// slider) its depth and its flashes.
//
// What makes it ICE rather than glass is what is wrong with it: a milky
// heart of trapped air, fracture planes that catch the light like mirrors,
// a surface gone slightly wavy, edges gone white, and a blue that deepens
// with the distance travelled inside. Red and blue leave at slightly
// different angles, which draws thin spectra along the lights' reflections.
//
// The planes, the light and the camera are still; the block turns a whole
// number of times per loop.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PLANES = 28;
const MAX_CRACKS = 4;
const MAX_BOUNCES = 6;

const FRAGMENT = `
  // ── The block (already turned: world space, centred on the block) ──
  uniform vec4  uPlanes[${ MAX_PLANES }];     // xyz = outward normal, w = distance
  uniform float uPlaneCount;
  uniform vec4  uCracks[${ MAX_CRACKS }];
  uniform float uCrackCount;
  uniform vec3  uCentre;
  uniform vec3  uAxisX;                        // the block's own axes, in world space
  uniform vec3  uAxisY;
  uniform vec3  uAxisZ;
  uniform vec3  uExtent;                       // its half-sizes along them

  // ── The material ──
  uniform float uIor;
  uniform float uDispersion;
  uniform float uBounces;
  uniform vec3  uTint;
  uniform float uAbsorption;
  uniform float uWaviness;
  uniform float uWaveScale;
  uniform float uEdges;
  uniform float uEdgeWidth;
  uniform float uCloud;
  uniform float uCloudSize;
  uniform float uCloudScale;
  uniform float uCrackLight;
  uniform float uCrackScale;

  // ── The light ──
  uniform vec3  uBackTop;
  uniform vec3  uBackBottom;
  uniform float uBackGlow;
  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform float uKeyPower;
  uniform float uKeySize;
  uniform vec3  uRimDir;
  uniform vec3  uRimColor;
  uniform float uRimPower;
  uniform float uBand;                         // a bright line around the horizon
  uniform float uExposure;

  // ── The camera ──
  uniform float uCamDist;
  uniform float uFocal;
  uniform float uSamples;

  float hash31(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);

    return fract((p3.x + p3.y) * p3.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = p - i;
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash31(i), hash31(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), u.x),
        u.y
      ),
      mix(
        mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), u.x),
        u.y
      ),
      u.z
    );
  }

  // A point of the world in the block's own frame: what its flaws are
  // anchored to, so they turn with it.
  vec3 toBlock(vec3 p) {
    return vec3(dot(uAxisX, p), dot(uAxisY, p), dot(uAxisZ, p));
  }

  // The studio the block stands in, by direction: a soft gradient, a key
  // light, a rim light and a thin bright band around the horizon. Everything
  // the ice shows is this, bent.
  vec3 studio(vec3 d) {
    vec3 col = mix(uBackBottom, uBackTop, smoothstep(-0.7, 0.7, d.y));

    col += uKeyColor * uKeyPower * smoothstep(cos(uKeySize), cos(uKeySize * 0.55), dot(d, uKeyDir));
    col += uRimColor * uRimPower * smoothstep(cos(uKeySize * 0.7), cos(uKeySize * 0.35), dot(d, uRimDir));
    col += uKeyColor * uBand * exp(-pow(d.y / 0.035, 2.0));

    return col;
  }

  // Where a ray from outside meets the block, and through which facet.
  bool enter(vec3 ro, vec3 rd, out float tNear, out vec3 facet) {
    float tFar = 1e9;

    tNear = -1e9;
    facet = vec3(0.0, 1.0, 0.0);

    for (int i = 0; i < ${ MAX_PLANES }; i++) {
      if (float(i) >= uPlaneCount) { break; }

      vec4 plane = uPlanes[i];
      float denom = dot(plane.xyz, rd);
      float dist = plane.w - dot(plane.xyz, ro);

      if (denom < -1e-6) {
        float t = dist / denom;

        if (t > tNear) { tNear = t; facet = plane.xyz; }
      } else if (denom > 1e-6) {
        tFar = min(tFar, dist / denom);
      } else if (dist < 0.0) {
        return false;
      }
    }

    return tNear < tFar && tNear > 0.0;
  }

  // Where a ray already inside reaches the surface again.
  void leave(vec3 pos, vec3 dir, out float tFar, out vec3 facet) {
    tFar = 1e9;
    facet = vec3(0.0, 1.0, 0.0);

    for (int i = 0; i < ${ MAX_PLANES }; i++) {
      if (float(i) >= uPlaneCount) { break; }

      vec4 plane = uPlanes[i];
      float denom = dot(plane.xyz, dir);

      if (denom > 1e-6) {
        float t = (plane.w - dot(plane.xyz, pos)) / denom;

        if (t < tFar) { tFar = t; facet = plane.xyz; }
      }
    }

    tFar = max(tFar, 0.0);
  }

  // How close a point of one facet is to the next facet: 0 on an edge.
  float toEdge(vec3 p, vec3 facet) {
    float slack = 1e9;

    for (int i = 0; i < ${ MAX_PLANES }; i++) {
      if (float(i) >= uPlaneCount) { break; }

      vec4 plane = uPlanes[i];

      if (dot(plane.xyz, facet) < 0.9999) {
        slack = min(slack, plane.w - dot(plane.xyz, p));
      }
    }

    return slack;
  }

  // The trapped air: thick at the heart, clear towards the faces.
  float cloudAt(vec3 q) {
    float r = length(q / uExtent) / max(uCloudSize, 1e-3);
    float body = 1.0 - smoothstep(0.25, 1.0, r);
    float n = noise3(q * uCloudScale + 4.0);

    return uCloud * body * (0.25 + 0.75 * n * n);
  }

  vec3 iceColor(vec3 ro, vec3 rd, float tNear, vec3 facet) {
    vec3 p = ro + rd * tNear;
    vec3 q = toBlock(p);

    // A surface that has melted and refrozen is no longer quite flat.
    vec3 ripple = vec3(
      noise3(q * uWaveScale),
      noise3(q * uWaveScale + 17.0),
      noise3(q * uWaveScale + 31.0)
    ) - 0.5;
    vec3 n = normalize(facet + uWaviness * ripple);

    float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float cosIn = max(dot(-rd, n), 0.0);
    float mirror = f0 + (1.0 - f0) * pow(1.0 - cosIn, 5.0);

    vec3 col = mirror * studio(reflect(rd, n));

    vec3 dir = refract(rd, n, 1.0 / uIor);
    vec3 pos = p - facet * 1e-4;
    float carried = 1.0 - mirror;
    vec3 filtered = vec3(1.0);

    for (int b = 0; b < ${ MAX_BOUNCES }; b++) {
      if (float(b) >= uBounces) { break; }

      float span;
      vec3 wall;

      leave(pos, dir, span, wall);

      // The milky heart: three looks along the way.
      float depth = 0.0;

      for (int s = 0; s < 3; s++) {
        depth += cloudAt(toBlock(pos + dir * span * (float(s) + 0.5) / 3.0));
      }

      float milk = 1.0 - exp(-depth * span / 3.0);

      // Lit by the key light more than by the room: trapped air is white.
      col += carried * filtered * milk * (0.3 * uBackTop + 0.75 * uKeyColor);
      filtered *= 1.0 - milk;

      // Fracture planes: seen edge-on they mirror the studio.
      for (int k = 0; k < ${ MAX_CRACKS }; k++) {
        if (float(k) >= uCrackCount) { break; }

        vec4 crack = uCracks[k];
        float denom = dot(crack.xyz, dir);

        if (abs(denom) > 1e-4) {
          float tc = (crack.w - dot(crack.xyz, pos)) / denom;

          if (tc > 0.0 && tc < span) {
            vec3 c = toBlock(pos + dir * tc);
            float patch = smoothstep(0.52, 0.7, noise3(c * uCrackScale + float(k) * 7.3));
            float sheen = pow(1.0 - abs(denom), 3.0);

            col += carried * filtered * uCrackLight * patch * (0.12 + 0.88 * sheen)
              * studio(reflect(dir, crack.xyz * sign(denom)));
          }
        }
      }

      // Ice takes the red out of light a little more with every length.
      filtered *= exp(-uAbsorption * span * (1.0 - uTint));
      pos += dir * span;

      vec3 inward = -wall;
      vec3 leaving = refract(dir, inward, uIor);

      if (dot(leaving, leaving) < 1e-6) {
        // Past the critical angle: the whole of it stays inside.
        dir = reflect(dir, inward);
        pos += inward * 1e-4;

        continue;
      }

      float cosOut = max(dot(leaving, wall), 0.0);
      float kept = f0 + (1.0 - f0) * pow(1.0 - cosOut, 5.0);

      // Red bends a little less than green, blue a little more.
      vec3 outRed = refract(dir, inward, uIor * (1.0 - uDispersion));
      vec3 outBlue = refract(dir, inward, uIor * (1.0 + uDispersion));

      if (dot(outRed, outRed) < 1e-6) { outRed = leaving; }
      if (dot(outBlue, outBlue) < 1e-6) { outBlue = leaving; }

      vec3 seen = vec3(studio(outRed).r, studio(leaving).g, studio(outBlue).b);

      col += carried * (1.0 - kept) * filtered * seen;
      carried *= kept;
      dir = reflect(dir, inward);
      pos += inward * 1e-4;

      if (carried < 0.01) { break; }
    }

    // What is still bouncing when we stop counting is not lost light.
    col += carried * filtered * studio(dir) * 0.5;

    // Edges go white first.
    float edge = exp(-toEdge(p, facet) / max(uEdgeWidth, 1e-4));

    col = mix(col, (0.5 * uBackTop + 0.6 * uKeyColor) * (0.7 + 0.3 * facet.y), clamp(edge * uEdges, 0.0, 1.0));

    return col;
  }

  vec3 backdrop(vec2 uv) {
    vec3 col = mix(uBackBottom, uBackTop, smoothstep(-0.55, 0.55, uv.y));

    return col + uBackTop * uBackGlow * exp(-dot(uv, uv) * 5.0);
  }

  vec3 develop(vec3 light) {
    vec3 x = light * uExposure;
    vec3 mapped = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);

    return pow(mapped, vec3(1.0 / 2.2));
  }

  void main() {
    vec3 sum = vec3(0.0);
    float count = 0.0;

    // Facets are drawn by arithmetic, so their edges need their own
    // smoothing: a few rays per pixel on a rotated grid.
    for (int s = 0; s < 4; s++) {
      if (float(s) >= uSamples) { break; }

      vec2 jitter = uSamples > 1.5
        ? vec2(
          (s == 0 || s == 3) ? 0.125 : -0.125,
          (s < 2) ? 0.375 : -0.375
        ) * ((s == 1 || s == 3) ? vec2(3.0, -0.3333) : vec2(1.0))
        : vec2(0.0);
      vec2 uv = ((vUv - 0.5) * uResolution + jitter) / uResolution.y;

      vec3 ro = vec3(0.0, 0.0, uCamDist) - uCentre;
      vec3 rd = normalize(vec3(uv, -uFocal));

      float tNear;
      vec3 facet;

      sum += enter(ro, rd, tNear, facet)
        ? iceColor(ro, rd, tNear, facet)
        : backdrop(uv);
      count += 1.0;
    }

    gl_FragColor = vec4(develop(sum / count), 1.0);
  }
`;

const renderer = createNoiseFieldRenderer( FRAGMENT );

const radians = ( degrees ) => degrees * Math.PI / 180;

// A screen colour as light.
const linear = ( color ) => [
  0,
  1,
  2
].map( ( channel ) => Math.pow(
  ( color?.[ channel ] ?? 0 ) / 255,
  2.2
) );

// A small seeded generator: the same seed is the same block, every frame.
function seeded( seed ) {
  let state = ( Math.round( seed ) + 1 ) * 2654435761 >>> 0;

  return () => {
    state = state + 0x6D2B79F5 >>> 0;

    let t = Math.imul(
      state ^ state >>> 15,
      1 | state
    );

    t = t + Math.imul(
      t ^ t >>> 7,
      61 | t
    ) ^ t;

    return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296;
  };
}

const normalise = ( v ) => {
  const length = Math.hypot( ...v ) || 1;

  return v.map( ( c ) => c / length );
};

// The block in its own frame: planes tangent to an ellipsoid, their
// directions spread by the golden angle and nudged, their distances pulled
// in unevenly — a chunk, not a gem. Fracture planes pass near the heart.
function carve(
  shape, inside
) {
  const random = seeded( shape.seed );
  const count = Math.max(
    4,
    Math.min(
      MAX_PLANES,
      Math.round( shape.facets )
    )
  );
  const extent = [
    shape.size,
    shape.size * shape.elongation,
    shape.size * shape.depth
  ];
  const planes = [];

  for ( let i = 0; i < count; i++ ) {
    const y = 1 - 2 * ( i + 0.5 ) / count;
    const ring = Math.sqrt( Math.max(
      0,
      1 - y * y
    ) );
    const turn = i * 2.399963;
    const jitter = shape.irregularity * 0.9;
    const normal = normalise( [
      ring * Math.cos( turn ) + jitter * ( random() - 0.5 ),
      y + jitter * ( random() - 0.5 ),
      ring * Math.sin( turn ) + jitter * ( random() - 0.5 )
    ] );
    // The ellipsoid's support along that direction, then cut closer.
    const support = Math.hypot(
      normal[ 0 ] * extent[ 0 ],
      normal[ 1 ] * extent[ 1 ],
      normal[ 2 ] * extent[ 2 ]
    );

    planes.push( {
      normal,
      distance: support * ( 1 - shape.irregularity * 0.4 * random() )
    } );
  }

  const cracks = [];
  const crackCount = Math.max(
    0,
    Math.min(
      MAX_CRACKS,
      Math.round( inside.crackCount )
    )
  );

  for ( let k = 0; k < crackCount; k++ ) {
    cracks.push( {
      normal: normalise( [
        random() - 0.5,
        ( random() - 0.5 ) * 0.6,
        random() - 0.5
      ] ),
      distance: ( random() - 0.5 ) * 0.5 * shape.size
    } );
  }

  return {
    planes,
    cracks,
    extent
  };
}

let carved = {
  key: null,
  block: null
};

function blockFor(
  shape, inside
) {
  const key = JSON.stringify( [
    shape.seed,
    shape.facets,
    shape.size,
    shape.elongation,
    shape.depth,
    shape.irregularity,
    inside.crackCount
  ] );

  if ( carved.key !== key ) {
    carved = {
      key,
      block: carve(
        shape,
        inside
      )
    };
  }

  return carved.block;
}

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();

  const shape = {
    ...defaults.shape,
    ...o.shape
  };
  const motion = {
    ...defaults.motion,
    ...o.motion
  };
  const material = {
    ...defaults.material,
    ...o.material
  };
  const inside = {
    ...defaults.inside,
    ...o.inside
  };
  const light = {
    ...defaults.light,
    ...o.light
  };
  const backdrop = {
    ...defaults.backdrop,
    ...o.backdrop
  };
  const camera = {
    ...defaults.camera,
    ...o.camera
  };

  const angle = animation.angle;
  const block = blockFor(
    shape,
    inside
  );

  // The block's turn: a spin about its own long axis, the axis tilted and
  // nodding. Whole turns and whole nods per loop.
  const spin = Math.round( motion.spinTurns ) * angle + radians( motion.turn );
  const nods = Math.round( motion.nodCycles );
  const tilt = radians( motion.tilt ) + radians( motion.nod ) * Math.sin( angle * nods );
  const lean = radians( motion.lean ) + radians( motion.nod ) * 0.6 * Math.cos( angle * nods );

  const cs = Math.cos( spin );
  const ss = Math.sin( spin );
  const ct = Math.cos( tilt );
  const st = Math.sin( tilt );
  const cl = Math.cos( lean );
  const sl = Math.sin( lean );

  // block → world: Rz( lean ) · Rx( tilt ) · Ry( spin ).
  const toWorld = ( [
    x,
    y,
    z
  ] ) => {
    const x1 = cs * x + ss * z;
    const z1 = -ss * x + cs * z;
    const y2 = ct * y - st * z1;
    const z2 = st * y + ct * z1;

    return [
      cl * x1 - sl * y2,
      sl * x1 + cl * y2,
      z2
    ];
  };

  const planes = new Float32Array( MAX_PLANES * 4 );

  block.planes.forEach( (
    plane, i
  ) => {
    planes.set(
      [
        ...toWorld( plane.normal ),
        plane.distance
      ],
      i * 4
    );
  } );

  const cracks = new Float32Array( MAX_CRACKS * 4 );

  block.cracks.forEach( (
    crack, k
  ) => {
    cracks.set(
      [
        ...toWorld( crack.normal ),
        crack.distance
      ],
      k * 4
    );
  } );

  const direction = (
    azimuth, elevation
  ) => {
    const a = radians( azimuth );
    const e = radians( elevation );

    return [
      Math.sin( a ) * Math.cos( e ),
      Math.sin( e ),
      Math.cos( a ) * Math.cos( e )
    ];
  };

  renderer.render( {
    columns: 1,
    rows: 1,
    resolutionScale: camera.renderScale,
    uniforms: {
      uPlanes: {
        vec4v: planes
      },
      uPlaneCount: block.planes.length,
      uCracks: {
        vec4v: cracks
      },
      uCrackCount: block.cracks.length,
      uCentre: [
        0,
        motion.bob * Math.sin( angle * Math.max(
          1,
          nods
        ) + 0.7 ),
        0
      ],
      uAxisX: toWorld( [
        1,
        0,
        0
      ] ),
      uAxisY: toWorld( [
        0,
        1,
        0
      ] ),
      uAxisZ: toWorld( [
        0,
        0,
        1
      ] ),
      uExtent: block.extent,
      uIor: Math.max(
        material.index,
        1.001
      ),
      uDispersion: material.dispersion,
      uBounces: Math.max(
        1,
        Math.min(
          MAX_BOUNCES,
          Math.round( material.bounces )
        )
      ),
      uTint: linear( material.tint ),
      uAbsorption: material.absorption,
      uWaviness: material.waviness,
      uWaveScale: material.waveScale,
      uEdges: material.edges,
      uEdgeWidth: material.edgeWidth,
      uCloud: inside.cloud,
      uCloudSize: inside.cloudSize,
      uCloudScale: inside.cloudScale,
      uCrackLight: inside.cracks,
      uCrackScale: inside.crackScale,
      uBackTop: linear( backdrop.top ),
      uBackBottom: linear( backdrop.bottom ),
      uBackGlow: backdrop.glow,
      uKeyDir: direction(
        light.keyAzimuth,
        light.keyElevation
      ),
      uKeyColor: linear( light.keyColor ),
      uKeyPower: light.keyPower,
      uKeySize: radians( Math.max(
        light.keySize,
        1
      ) ),
      uRimDir: direction(
        light.rimAzimuth,
        light.rimElevation
      ),
      uRimColor: linear( light.rimColor ),
      uRimPower: light.rimPower,
      uBand: light.band,
      uExposure: light.exposure,
      uCamDist: camera.distance,
      uFocal: 0.5 / Math.tan( radians( camera.fieldOfView ) / 2 ),
      uSamples: Math.max(
        1,
        Math.min(
          4,
          Math.round( camera.antialiasing )
        )
      )
    }
  } );
} );
