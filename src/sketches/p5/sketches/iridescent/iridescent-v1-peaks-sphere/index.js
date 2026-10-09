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
  materialRender,
  renderingSettings,
  drawBackground,
  wobbleRotation
} from "../_iridescence.js";

import {
  formValues as defaults
} from "./options";

// ─────────────────────────────────────────────────────────────────────────────
// iridescent-v1-peaks-sphere
//
// peaks-sphere's spiked ellipsoid — the same meridians × parallels placement,
// the same Perlin terrain deciding each spike's length, the same stroke-weight
// and depth-easing silhouette — drawn as SOLID surfaces under the iridescent
// material instead of stacks of rainbow discs. Each spike is one instanced
// surface of revolution (spikeMeshGpu.js), the ellipsoid body fills the gaps
// between them, and the colour of every pixel is the ramp read by its angle
// to the camera, drifting a whole cycle per loop.
//
// Options keep peaks-sphere's names where the meaning survives (sphere, peaks,
// surface, rotation, noise); the disc-stack knobs (layers, LOD, the rainbow)
// have no meaning on a surface and are gone.
// ─────────────────────────────────────────────────────────────────────────────

const SPIKE_BODY = `
  uniform float uMeridians;
  uniform float uParallels;
  uniform vec3  uRadius;
  uniform float uBodyScale;

  uniform float uSpikeLenMin;
  uniform float uSpikeLenMax;

  uniform float uSurfNoiseScale;
  uniform float uSurfOffset;
  uniform float uSurfTime;
  uniform float uSurfContrast;
  uniform int   uSurfContrastEaseId;

  // The terrain, 0..1, at a (longitude, latitude) fraction — peaks-sphere's
  // surfaceFactor / contrast. Spikes and body read the same field, so the
  // body's bands follow the spikes' heights.
  float terrain(float colNorm, float rowNorm) {
    float surfaceNoise = perlinNoise(vec3(
      colNorm * uSurfNoiseScale + uSurfOffset,
      rowNorm * uSurfNoiseScale,
      uSurfTime
    ));
    float surfaceFactor = mapEase(surfaceNoise, 0.0, 1.0, 0.0, uSurfContrast, uSurfContrastEaseId);

    return uSurfContrast > 0.0 ? surfaceFactor / uSurfContrast : 1.0;
  }

  vec3 ellipsoid(float theta, float phi) {
    return uRadius * vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta));
  }

  void computeSpike(
    float col, float row,
    out vec3 base, out vec3 dir, out float len, out float radiusMul, out float extra, out float visible
  ) {
    float colNorm = col / uMeridians;
    float rowNorm = row / max(uParallels - 1.0, 1.0);
    float theta   = colNorm * TAU;
    float phi     = rowNorm * PI;

    // Every meridian meets at the poles: one spike there (col 0), as the original.
    bool isPole = (row < 0.5) || (row > uParallels - 1.5);

    visible   = (isPole && col > 0.5) ? 0.0 : 1.0;
    base      = ellipsoid(theta, phi);
    dir       = normalize(base);
    extra     = terrain(colNorm, rowNorm);
    len       = mix(uSpikeLenMin, uSpikeLenMax, extra);
    radiusMul = 1.0;
  }

  vec4 bodyPoint(float t, float a) {
    return vec4(ellipsoid(a * TAU, t * PI) * uBodyScale, terrain(a, t));
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
  drawBackground(
    p,
    o.background
  );

  const sphere = o.sphere ?? defaults.sphere;
  const peaks = o.peaks ?? defaults.peaks;
  const surface = o.surface ?? defaults.surface;
  const noise = o.noise ?? defaults.noise;
  const body = o.body ?? defaults.body;

  const surfaceTime = ( surface.animated ?? defaults.surface.animated )
    ? animation.angle * ( surface.noiseSpeed ?? defaults.surface.noiseSpeed )
    : 0;

  const material = materialRender(
    o.material,
    o.background,
    {
      scale: Math.max(
        sphere.radiusX ?? defaults.sphere.radiusX,
        sphere.radiusY ?? defaults.sphere.radiusY,
        sphere.radiusZ ?? defaults.sphere.radiusZ
      ) + ( peaks.spikeLengthMax ?? defaults.peaks.spikeLengthMax ),
      axis: "y"
    }
  );
  const rendering = renderingSettings( o.rendering );

  renderer.render( {
    rotation: wobbleRotation(
      p,
      o.rotation,
      defaults.rotation
    ),
    grid: {
      cols: sphere.meridians ?? defaults.sphere.meridians,
      rows: sphere.parallels ?? defaults.sphere.parallels
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
      uMeridians: sphere.meridians ?? defaults.sphere.meridians,
      uParallels: sphere.parallels ?? defaults.sphere.parallels,
      uRadius: [
        sphere.radiusX ?? defaults.sphere.radiusX,
        sphere.radiusY ?? defaults.sphere.radiusY,
        sphere.radiusZ ?? defaults.sphere.radiusZ
      ],
      uBodyScale: body.scale ?? defaults.body.scale,
      uSpikeLenMin: peaks.spikeLengthMin ?? defaults.peaks.spikeLengthMin,
      uSpikeLenMax: peaks.spikeLengthMax ?? defaults.peaks.spikeLengthMax,
      uSurfNoiseScale: surface.noiseScale ?? defaults.surface.noiseScale,
      uSurfOffset: surface.noiseOffset ?? defaults.surface.noiseOffset,
      uSurfTime: surfaceTime,
      uSurfContrast: surface.contrast ?? defaults.surface.contrast,
      uSurfContrastEaseId: easingId( surface.contrastEasing ?? defaults.surface.contrastEasing )
    }
  } );
} );
