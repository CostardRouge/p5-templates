import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import createSpikeMeshRenderer from "@/p5/utils/spikeMeshGpu.js";
import {
  easingId
} from "@/p5/utils/easingGlsl.js";

import {
  resolveLook,
  materialRender,
  renderingSettings,
  drawBackground,
  wobbleRotation
} from "../_iridescence.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// iridescent-v7-peaks-knot
//
// The peaks family on a shape it never had: a torus knot. The curve winds p
// times around the axis and q times through the hole (2, 3 is the trefoil; q
// = 0 is a plain ring), a thin tube follows it, and the needles stand on the
// tube — columns along the curve, rows around it — their length read off a
// Perlin terrain sampled at each needle's own foot, so the field has no seam
// where the curve closes.
//
// The frame around the curve is the torus's own: the curve lies ON a torus,
// whose surface normal is always perpendicular to it, so (normal, tangent ×
// normal) turns smoothly all the way round and closes on itself — no twist
// to correct, unlike a Frenet frame.
//
// What moves counts whole cycles of the loop: the needles travel whole trips
// along the curve through the still terrain, the rows roll around the tube,
// a wave of length runs along the knot, and the terrain drifts on a circle.
// ─────────────────────────────────────────────────────────────────────────────

const SPIKE_BODY = `
  uniform float uColumns;
  uniform float uRows;
  uniform float uKnotP;
  uniform float uKnotQ;
  uniform float uMajor;
  uniform float uMinor;
  uniform float uTube;
  uniform float uBodyScale;

  uniform float uFlow;          // trips along the curve so far
  uniform float uTwist;         // turns of the rows around the tube per trip
  uniform float uRoll;          // the rows' turn around the tube, radians
  uniform float uStagger;       // 1 = every other column half a row round

  uniform float uSpikeLenMin;
  uniform float uSpikeLenMax;
  uniform float uWave;
  uniform float uWaveCount;
  uniform float uWavePhase;

  uniform float uSurfNoiseScale;
  uniform vec3  uSurfOffset;
  uniform float uSurfContrast;
  uniform int   uSurfContrastEaseId;
  uniform float uSize;          // the knot's reach, to normalise the noise

  vec3 knot(float u) {
    float a = TAU * uKnotP * u;
    float b = TAU * uKnotQ * u;
    float r = uMajor + uMinor * cos(b);

    return vec3(r * cos(a), r * sin(a), uMinor * sin(b));
  }

  // The point of the curve at u (in trips) and the two axes across it.
  void knotFrame(float u, out vec3 centre, out vec3 n1, out vec3 n2) {
    float a = TAU * uKnotP * u;
    float b = TAU * uKnotQ * u;

    centre = knot(u);

    vec3 tangent = normalize(knot(u + 0.0005) - knot(u - 0.0005));
    vec3 normal = vec3(cos(a) * cos(b), sin(a) * cos(b), sin(b));

    n1 = normalize(normal - tangent * dot(normal, tangent));
    n2 = cross(tangent, n1);
  }

  // The terrain, 0..1, at a point of space: needles and tube read one field.
  float terrain(vec3 point) {
    float n = perlinNoise(point / max(uSize, 1.0) * uSurfNoiseScale + uSurfOffset);
    float shaped = mapEase(n, 0.0, 1.0, 0.0, uSurfContrast, uSurfContrastEaseId);

    return uSurfContrast > 0.0 ? shaped / uSurfContrast : 1.0;
  }

  void computeSpike(
    float col, float row,
    out vec3 base, out vec3 dir, out float len, out float radiusMul, out float extra, out float visible
  ) {
    float colNorm = col / uColumns;
    float u = fract(colNorm + uFlow);
    float around = row / uRows
      + uTwist * colNorm
      + uStagger * 0.5 * mod(col, 2.0) / uRows;
    float phi = TAU * around + uRoll;

    vec3 centre;
    vec3 n1;
    vec3 n2;

    knotFrame(u, centre, n1, n2);

    dir       = n1 * cos(phi) + n2 * sin(phi);
    base      = centre + dir * uTube;
    extra     = terrain(base);
    len       = mix(uSpikeLenMin, uSpikeLenMax, extra)
      * (1.0 + uWave * sin(TAU * (uWaveCount * u - uWavePhase)));
    radiusMul = 1.0;
    visible   = 1.0;
  }

  // The tube: t runs along the curve, a around it.
  vec4 bodyPoint(float t, float a) {
    vec3 centre;
    vec3 n1;
    vec3 n2;

    knotFrame(t, centre, n1, n2);

    float phi = a * TAU;
    vec3 point = centre + (n1 * cos(phi) + n2 * sin(phi)) * uTube * uBodyScale;

    return vec4(point, terrain(point));
  }
`;

const renderer = createSpikeMeshRenderer( {
  spikeBody: SPIKE_BODY
} );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();

  const look = resolveLook(
    o.material,
    o.background
  );

  drawBackground(
    p,
    look.background
  );

  const knot = {
    ...defaults.knot,
    ...o.knot
  };
  const peaks = {
    ...defaults.peaks,
    ...o.peaks,
    point: {
      ...defaults.peaks.point,
      ...o.peaks?.point
    }
  };
  const surface = {
    ...defaults.surface,
    ...o.surface
  };
  const motion = {
    ...defaults.motion,
    ...o.motion
  };
  const body = {
    ...defaults.body,
    ...o.body
  };
  const noise = {
    ...defaults.noise,
    ...o.noise
  };

  const phase = animation.progression;
  const angle = animation.angle;

  const columns = Math.max(
    1,
    Math.round( knot.columns )
  );
  const rows = Math.max(
    1,
    Math.round( knot.rows )
  );
  const size = knot.majorRadius + knot.minorRadius + knot.tubeRadius;

  // The tube is long and thin: many rings along it, few segments around.
  const rendering = renderingSettings(
    o.rendering,
    {
      spikeRings: 32,
      spikeSegments: 16,
      bodyRings: 220,
      bodySegments: 20
    }
  );

  const material = materialRender(
    look.material,
    look.background,
    {
      scale: size + peaks.spikeLengthMax,
      axis: "z",
      pixelScale: rendering.supersample
    }
  );

  // The terrain drifts on a circle, so it is back where it started.
  const drift = surface.animated ? surface.drift : 0;

  renderer.render( {
    rotation: wobbleRotation(
      p,
      o.rotation,
      defaults.rotation
    ),
    grid: {
      cols: columns,
      rows
    },
    ...rendering,
    body: body.enabled,
    seed: noise.seed,
    octaves: noise.detail,
    falloff: noise.falloff,
    profile: {
      lengthEasing: easingId( peaks.depthEasing ),
      radiusMin: peaks.point.strokeWeightMin,
      radiusMax: peaks.point.strokeWeightMax,
      radiusEasing: easingId( peaks.point.strokeWeightEasing )
    },
    ramp: material.ramp,
    shade: material.shade,
    uniforms: {
      ...material.uniforms,
      uColumns: columns,
      uRows: rows,
      uKnotP: Math.max(
        1,
        Math.round( knot.p )
      ),
      uKnotQ: Math.round( knot.q ),
      uMajor: knot.majorRadius,
      uMinor: knot.minorRadius,
      uTube: knot.tubeRadius,
      uBodyScale: body.scale,
      uFlow: Math.round( motion.flowTrips ) * phase,
      uTwist: Math.round( knot.twist ),
      uRoll: Math.round( motion.rollTurns ) * angle,
      uStagger: knot.stagger ? 1 : 0,
      uSpikeLenMin: peaks.spikeLengthMin,
      uSpikeLenMax: peaks.spikeLengthMax,
      uWave: motion.wave,
      uWaveCount: Math.round( motion.waveCount ),
      uWavePhase: Math.round( motion.waveSpeed ) * phase,
      uSurfNoiseScale: surface.noiseScale,
      // p5's Perlin mirrors negative inputs: keep the samples positive.
      uSurfOffset: [
        surface.noiseOffset + 20 + drift * Math.cos( angle ),
        20 + drift * Math.sin( angle ),
        20
      ],
      uSurfContrast: surface.contrast,
      uSurfContrastEaseId: easingId( surface.contrastEasing ),
      uSize: size
    }
  } );
} );
