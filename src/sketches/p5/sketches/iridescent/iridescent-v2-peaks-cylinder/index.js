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
// iridescent-v2-peaks-cylinder
//
// peaks-cylinder's brush — columns × rows of radial spikes on a cylinder, the
// same thickness and depth easings — as solid surfaces under the iridescent
// material. The body is a pill (a cylinder with rounded ends) so the spikes
// grow out of something; an optional Perlin field varies the spike lengths,
// which the original had no way to do (every spike was `spikeLength`).
// ─────────────────────────────────────────────────────────────────────────────

const SPIKE_BODY = `
  uniform float uColumns;
  uniform float uRows;
  uniform float uCylRadius;
  uniform float uCylHeight;
  uniform float uSpikeLength;

  uniform float uLengthNoise;     // 0 = every spike the same length
  uniform float uNoiseScale;
  uniform float uNoiseTime;

  uniform float uBodyScale;
  uniform float uBodyCap;         // rounded-end radius, × the body radius

  float lengthField(float colNorm, float rowNorm) {
    float n = perlinNoise(vec3(colNorm * uNoiseScale, rowNorm * uNoiseScale, uNoiseTime));

    return mix(1.0, n, uLengthNoise);
  }

  void computeSpike(
    float col, float row,
    out vec3 base, out vec3 dir, out float len, out float radiusMul, out float extra, out float visible
  ) {
    float colNorm = col / uColumns;
    float rowNorm = row / max(uRows - 1.0, 1.0);
    float theta   = colNorm * TAU;
    float y       = mix(-uCylHeight * 0.5, uCylHeight * 0.5, rowNorm);

    dir       = vec3(cos(theta), 0.0, sin(theta));
    base      = vec3(uCylRadius * dir.x, y, uCylRadius * dir.z);
    len       = uSpikeLength * lengthField(colNorm, rowNorm);
    radiusMul = 1.0;
    extra     = rowNorm;
    visible   = 1.0;
  }

  // A pill around y: flat end disc, quarter-torus fillet, straight side,
  // fillet, disc. t runs from one pole to the other; a goes around.
  vec4 bodyPoint(float t, float a) {
    float R    = uCylRadius * uBodyScale;
    float capR = R * uBodyCap;
    float flatR = R - capR;
    float H    = uCylHeight;
    float ang  = a * TAU;
    float r;
    float y;

    if (t < 0.15) {
      r = flatR * (t / 0.15);
      y = -H * 0.5 - capR;
    } else if (t < 0.3) {
      float th = (t - 0.15) / 0.15 * PI * 0.5;
      r = flatR + capR * sin(th);
      y = -H * 0.5 - capR * cos(th);
    } else if (t < 0.7) {
      r = R;
      y = mix(-H * 0.5, H * 0.5, (t - 0.3) / 0.4);
    } else if (t < 0.85) {
      float th = (t - 0.7) / 0.15 * PI * 0.5;
      r = flatR + capR * cos(th);
      y = H * 0.5 + capR * sin(th);
    } else {
      r = flatR * (1.0 - (t - 0.85) / 0.15);
      y = H * 0.5 + capR;
    }

    float rowNorm = clamp((y + H * 0.5) / max(H, 1.0), 0.0, 1.0);

    return vec4(r * cos(ang), y, r * sin(ang), rowNorm);
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

  const cylinder = o.cylinder ?? defaults.cylinder;
  const peaks = o.peaks ?? defaults.peaks;
  const noise = o.noise ?? defaults.noise;
  const body = o.body ?? defaults.body;

  const noiseTime = ( noise.animated ?? defaults.noise.animated )
    ? animation.angle * ( noise.speed ?? defaults.noise.speed )
    : 0;

  const rendering = renderingSettings( o.rendering );

  const material = materialRender(
    look.material,
    look.background,
    {
      scale: Math.max(
        cylinder.height ?? defaults.cylinder.height,
        2 * ( ( cylinder.radius ?? defaults.cylinder.radius ) + ( cylinder.spikeLength ?? defaults.cylinder.spikeLength ) )
      ),
      axis: "y",
      pixelScale: rendering.supersample
    }
  );

  renderer.render( {
    rotation: wobbleRotation(
      p,
      o.rotation,
      defaults.rotation
    ),
    grid: {
      cols: cylinder.columns ?? defaults.cylinder.columns,
      rows: cylinder.rows ?? defaults.cylinder.rows
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
      uColumns: cylinder.columns ?? defaults.cylinder.columns,
      uRows: cylinder.rows ?? defaults.cylinder.rows,
      uCylRadius: cylinder.radius ?? defaults.cylinder.radius,
      uCylHeight: cylinder.height ?? defaults.cylinder.height,
      uSpikeLength: cylinder.spikeLength ?? defaults.cylinder.spikeLength,
      uLengthNoise: noise.lengthAmount ?? defaults.noise.lengthAmount,
      uNoiseScale: noise.scale ?? defaults.noise.scale,
      uNoiseTime: noiseTime,
      uBodyScale: body.scale ?? defaults.body.scale,
      uBodyCap: body.capRound ?? defaults.body.capRound
    }
  } );
} );
