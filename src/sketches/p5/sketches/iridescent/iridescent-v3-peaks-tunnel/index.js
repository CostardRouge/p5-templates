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
// iridescent-v3-peaks-tunnel
//
// peaks-tunnel seen from inside, solid: rings of spikes growing inward from a
// tube that narrows with depth, the camera looking down the axis. Every spike
// points at the lens from a different angle, which is where a material read
// by the viewing angle does the most — the bands wrap each spike and the
// wall, and fog takes the far end into the background. The ring's depth
// feeds the material's extra channel (the original's hueDepthMixing).
// ─────────────────────────────────────────────────────────────────────────────

const SPIKE_BODY = `
  uniform float uRings;
  uniform float uSegments;
  uniform float uDepthStart;
  uniform float uDepthEnd;
  uniform int   uDepthEaseId;
  uniform float uRadiusStart;
  uniform float uRadiusEnd;
  uniform int   uTunnelRadiusEaseId;

  uniform float uSpikeLenMax;
  uniform float uSpikeLenMin;
  uniform int   uSpikeDepthEaseId;
  uniform float uNoiseAmount;
  uniform float uNoiseScale;
  uniform float uNoiseXMult;
  uniform float uNoiseYMult;
  uniform float uPeaksTime;

  uniform float uWallScale;

  float ringDepth(float ringNorm) {
    return mapEase(ringNorm, 0.0, 1.0, uDepthStart, uDepthEnd, uDepthEaseId);
  }

  float ringRadius(float ringNorm) {
    return mapEase(ringNorm, 0.0, 1.0, uRadiusStart, uRadiusEnd, uTunnelRadiusEaseId);
  }

  void computeSpike(
    float col, float row,
    out vec3 base, out vec3 dir, out float len, out float radiusMul, out float extra, out float visible
  ) {
    float segNorm  = col / uSegments;
    float ringNorm = row / max(uRings - 1.0, 1.0);
    float theta    = segNorm * TAU;
    float radius   = ringRadius(ringNorm);

    vec2 around = vec2(cos(theta), sin(theta));

    base = vec3(around * radius, ringDepth(ringNorm));
    dir  = vec3(-around, 0.0);

    float spikeLength = mapEase(ringNorm, 0.0, 1.0, uSpikeLenMax, uSpikeLenMin, uSpikeDepthEaseId);
    float spikeNoise  = perlinNoise(vec3(
      segNorm * uNoiseScale * uNoiseXMult,
      ringNorm * uNoiseScale * uNoiseYMult,
      uPeaksTime
    ));

    // Never past the axis, as the original clamps.
    len       = min(spikeLength * mix(1.0, spikeNoise, uNoiseAmount), radius);
    radiusMul = 1.0;
    extra     = ringNorm;
    visible   = 1.0;
  }

  // The wall: the ring profile swept around the axis.
  vec4 bodyPoint(float t, float a) {
    float ang    = a * TAU;
    float radius = ringRadius(t) * uWallScale;

    return vec4(cos(ang) * radius, sin(ang) * radius, ringDepth(t), t);
  }
`;

// The material's fragment GLSL arrives per frame (`shade`), specialised on
// the form's selects and curves; the renderer recompiles when they change.
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
  // A named palette replaces the stops, the hardness and the background.
  const look = resolveLook(
    o.material,
    o.background
  );

  drawBackground(
    p,
    look.background
  );

  const tunnel = o.tunnel ?? defaults.tunnel;
  const peaks = o.peaks ?? defaults.peaks;
  const noise = o.noise ?? defaults.noise;
  const body = o.body ?? defaults.body;

  const depthStart = tunnel.depthStart ?? defaults.tunnel.depthStart;
  const depthEnd = tunnel.depthEnd ?? defaults.tunnel.depthEnd;
  const peaksTime = ( peaks.animated ?? defaults.peaks.animated )
    ? animation.angle * ( peaks.animSpeed ?? defaults.peaks.animSpeed )
    : 0;

  const rendering = renderingSettings(
    o.rendering,
    {
      spikeRings: 32,
      spikeSegments: 16,
      bodyRings: 64,
      bodySegments: 64
    }
  );

  // Position axes are read after the centring translate, so the tunnel's
  // length is the scene: z runs −0.5 → 0.5 across it.
  const material = materialRender(
    look.material,
    look.background,
    {
      scale: Math.max(
        Math.abs( depthEnd - depthStart ),
        1
      ),
      axis: "z",
      pixelScale: rendering.supersample
    }
  );

  renderer.render( {
    rotation: wobbleRotation(
      p,
      o.rotation,
      defaults.rotation
    ),
    // Centre the tunnel on the origin so the wobble turns about its middle.
    translate: [
      0,
      0,
      -( depthStart + depthEnd ) / 2
    ],
    grid: {
      cols: tunnel.segments ?? defaults.tunnel.segments,
      rows: tunnel.rings ?? defaults.tunnel.rings
    },
    ...rendering,
    body: body.enabled ?? defaults.body.enabled,
    seed: noise.seed ?? defaults.noise.seed,
    octaves: noise.detail ?? defaults.noise.detail,
    falloff: noise.falloff ?? defaults.noise.falloff,
    profile: {
      lengthEasing: easingId( peaks.depthEasing ?? defaults.peaks.depthEasing ),
      radiusMin: peaks.point?.strokeWeightMin ?? defaults.peaks.point.strokeWeightMin,
      radiusMax: peaks.point?.strokeWeightMax ?? defaults.peaks.point.strokeWeightMax,
      radiusEasing: easingId( peaks.point?.strokeWeightEasing ?? defaults.peaks.point.strokeWeightEasing )
    },
    ramp: material.ramp,
    shade: material.shade,
    uniforms: {
      ...material.uniforms,
      uRings: tunnel.rings ?? defaults.tunnel.rings,
      uSegments: tunnel.segments ?? defaults.tunnel.segments,
      uDepthStart: depthStart,
      uDepthEnd: depthEnd,
      uDepthEaseId: easingId( tunnel.depthEasing ?? defaults.tunnel.depthEasing ),
      uRadiusStart: tunnel.radiusStart ?? defaults.tunnel.radiusStart,
      uRadiusEnd: tunnel.radiusEnd ?? defaults.tunnel.radiusEnd,
      uTunnelRadiusEaseId: easingId( tunnel.radiusEasing ?? defaults.tunnel.radiusEasing ),
      uSpikeLenMax: peaks.spikeLengthMax ?? defaults.peaks.spikeLengthMax,
      uSpikeLenMin: peaks.spikeLengthMin ?? defaults.peaks.spikeLengthMin,
      uSpikeDepthEaseId: easingId( peaks.depthEasing ?? defaults.peaks.depthEasing ),
      uNoiseAmount: noise.lengthAmount ?? defaults.noise.lengthAmount,
      uNoiseScale: noise.scale ?? defaults.noise.scale,
      uNoiseXMult: noise.xMultiplier ?? defaults.noise.xMultiplier,
      uNoiseYMult: noise.yMultiplier ?? defaults.noise.yMultiplier,
      uPeaksTime: peaksTime,
      uWallScale: body.scale ?? defaults.body.scale
    }
  } );
} );
