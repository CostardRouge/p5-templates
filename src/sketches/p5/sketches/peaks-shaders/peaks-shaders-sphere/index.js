import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";

import createPeaksFieldRenderer, {
  easingId
} from "@/p5/utils/peaksFieldGpu.js";

// ─────────────────────────────────────────────────────────────────────────────
// peaks-sphere — shaders.
//
// A GPU re-implementation of "peaks-sphere" (which stays untouched). The CPU
// original places meridians × parallels points on an ellipsoid and stacks up to
// `layers` p5.point()s outward along each spike — tens of thousands of draw
// calls per frame, with the Perlin noise and the rainbow p5.Color rebuilt per
// point every frame.
//
// Here the (col, row, layer) grid is uploaded once as a static instance buffer
// and the vertex shader rebuilds every point on the GPU: the same surface-noise
// spike length, the same LOD, the same outward displacement, the same per-layer
// stroke weight, and the same per-layer rainbow colour (mappers.fn + easing +
// colors.rainbow, ported to GLSL). The per-frame CPU work collapses to a few
// uniforms and reading p5's camera matrices, so the look is identical to the
// original but the cost is a single instanced draw call.
//
// Every option is the same as peaks-sphere, so a saved peaks-sphere preset drops
// straight in and renders the same image — just far cheaper.
// ─────────────────────────────────────────────────────────────────────────────

// GLSL: map one (col, row, layer) index to a point on the spiked ellipsoid.
// Faithful port of the peaks-sphere draw loop; the stdlib (perlinNoise, mapEase,
// applyEasing, paletteRainbow) is injected by the renderer.
const POINT_BODY = `
  uniform float uMeridians;
  uniform float uParallels;
  uniform float uMaxLayers;
  uniform vec3  uRadius;            // (radiusX, radiusY, radiusZ)

  uniform float uSpikeLenMin;
  uniform float uSpikeLenMax;
  uniform int   uDepthEaseId;

  uniform float uStrokeMin;
  uniform float uStrokeMax;
  uniform int   uStrokeEaseId;

  uniform float uSurfNoiseScale;
  uniform float uSurfOffset;
  uniform float uSurfTime;
  uniform float uSurfContrast;
  uniform int   uSurfContrastEaseId;

  uniform float uLodEnabled;
  uniform float uLodMinLayers;

  uniform float uNoiseXMult;
  uniform float uNoiseYMult;
  uniform float uNoiseLayerMult;
  uniform float uNoiseAnimMult;

  uniform float uRX;
  uniform float uRY;
  uniform float uRZ;

  uniform float uOpacityMax;
  uniform float uOpacityMin;
  uniform int   uOpacityEaseId;
  uniform float uProgMult;
  uniform float uLayerProgMult;

  uniform float uHueIndexMult;
  uniform float uHueSurfaceMix;
  uniform int   uHueIndexEaseId;
  uniform float uHueOffset;

  void computePoint(
    float col, float row, float layer,
    out vec3 worldPos, out float diameter, out vec3 color, out float visible
  ) {
    // Initialise every output so all early-return paths leave them defined.
    worldPos = vec3(0.0);
    diameter = 0.0;
    color    = vec3(0.0);
    visible  = 1.0;

    float meridians = uMeridians;
    float parallels = uParallels;

    float colNorm = col / meridians;
    float theta   = colNorm * TAU;

    float rowNorm = row / max(parallels - 1.0, 1.0);
    float phi     = rowNorm * PI;

    // At the poles every meridian converges; draw only col 0 (matches the
    // original's "isPole && col > 0 -> continue").
    bool isPole = (row < 0.5) || (row > parallels - 1.5);

    if (isPole && col > 0.5) {
      visible = 0.0;

      return;
    }

    float totalPoints = meridians * parallels;
    float progression = (col * parallels + row) / max(totalPoints - 1.0, 1.0);

    float sinPhi   = sin(phi);
    float cosPhi   = cos(phi);
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);

    float baseX = uRadius.x * sinPhi * cosTheta;
    float baseY = uRadius.y * cosPhi;
    float baseZ = uRadius.z * sinPhi * sinTheta;

    float surfaceNoise = perlinNoise(vec3(
      colNorm * uSurfNoiseScale + uSurfOffset,
      rowNorm * uSurfNoiseScale,
      uSurfTime
    ));
    float surfaceFactor = mapEase(surfaceNoise, 0.0, 1.0, 0.0, uSurfContrast, uSurfContrastEaseId);
    float spikeLength   = mapEase(surfaceFactor, 0.0, uSurfContrast, uSpikeLenMin, uSpikeLenMax, 0);

    float normalizedSurface = uSurfContrast > 0.0 ? surfaceFactor / uSurfContrast : 1.0;

    // LOD: fewer layers for shorter spikes (Math.round -> floor(x + 0.5)).
    float effectiveLayers = uLodEnabled > 0.5
      ? max(uLodMinLayers, floor(uMaxLayers * normalizedSurface + 0.5))
      : uMaxLayers;

    if (layer > effectiveLayers - 0.5) {
      visible = 0.0;

      return;
    }

    float layerProgression = effectiveLayers > 1.5 ? layer / (effectiveLayers - 1.0) : 1.0;

    // Layer 0 = tip (farthest), last = base (on the surface).
    float layerOffset = mapEase(layerProgression, 0.0, 1.0, spikeLength, 0.0, uDepthEaseId);

    float baseLenSq = uRadius.x * uRadius.x * sinPhi * sinPhi * cosTheta * cosTheta
      + uRadius.y * uRadius.y * cosPhi * cosPhi
      + uRadius.z * uRadius.z * sinPhi * sinPhi * sinTheta * sinTheta;
    float scale = 1.0 + layerOffset / sqrt(baseLenSq);

    worldPos = vec3(baseX, baseY, baseZ) * scale;

    diameter = mapEase(layerProgression, 0.0, 1.0, uStrokeMin, uStrokeMax, uStrokeEaseId);

    float colorNoise = perlinNoise(vec3(
      colNorm * uNoiseXMult + uRX,
      rowNorm * uNoiseYMult + uRY,
      layerProgression * uNoiseLayerMult + uSurfTime * uNoiseAnimMult + progression + uRZ
    ));
    float hueNoise  = mix(colorNoise, normalizedSurface, uHueSurfaceMix);
    float hueIndex  = mapEase(hueNoise, 0.0, 1.0, -PI, PI, uHueIndexEaseId) * uHueIndexMult;

    float opacityArg    = sin(colorNoise * TAU + progression * uProgMult + layerProgression * uLayerProgMult);
    float opacityFactor = mapEase(opacityArg, -1.0, 1.0, uOpacityMax, uOpacityMin, uOpacityEaseId);

    color = paletteRainbow(uHueOffset, hueIndex, opacityFactor);
  }
`;

const peaks = createPeaksFieldRenderer( {
  pointBody: POINT_BODY
} );

sketch.setup(
  () => {},
  {}
);

sketch.draw( () => {
  const p = getP5();
  const o = options.sketch ?? {};

  p.clear();
  p.background( ...( o.backgroundColor ?? [
    0
  ] ) );

  // ── Sphere shape ──────────────────────────────────────────────────────────
  const radiusX = o.sphere?.radiusX ?? 200;
  const radiusY = o.sphere?.radiusY ?? 200;
  const radiusZ = o.sphere?.radiusZ ?? 200;
  const meridians = o.sphere?.meridians ?? 28;
  const parallels = o.sphere?.parallels ?? 16;

  // ── Peaks / spikes ──────────────────────────────────────────────────────────
  const layers = o.peaks?.layers ?? 100;
  const spikeLengthMax = o.peaks?.spikeLengthMax ?? 200;
  const spikeLengthMin = o.peaks?.spikeLengthMin ?? 0;
  const strokeWeightMin = o.peaks?.point?.strokeWeightMin ?? 1;
  const strokeWeightMax = o.peaks?.point?.strokeWeightMax ?? 12;

  // ── Surface deformation ───────────────────────────────────────────────────
  const surfaceNoiseScale = o.surface?.noiseScale ?? 1.5;
  const surfaceNoiseSpeed = o.surface?.noiseSpeed ?? 0.15;
  const surfaceAnimated = o.surface?.animated ?? true;
  const surfaceContrast = o.surface?.contrast ?? 1;
  const surfaceOffset = o.surface?.noiseOffset ?? 0;
  const surfaceTime = surfaceAnimated ? animation.angle * surfaceNoiseSpeed : 0;

  // ── Rotation (same wobble as the CPU original) ──────────────────────────────
  const rotationEnabled = o.rotation?.enabled ?? true;
  const angleMax = o.rotation?.angleMax ?? ( p.PI / 16 );
  const xMultiplier = o.rotation?.xMultiplier ?? 1;
  const yMultiplier = o.rotation?.yMultiplier ?? 2;
  const zMultiplier = o.rotation?.zMultiplier ?? 0;

  const rX = rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * xMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;
  const rY = rotationEnabled
    ? mappers.fn(
      p.cos( animation.angle * yMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;
  const rZ = rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * zMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0;

  // ── Noise ─────────────────────────────────────────────────────────────────
  const seed = o.noise?.seed ?? 42;
  const detail = o.noise?.detail ?? 4;
  const falloff = o.noise?.falloff ?? 0.5;
  const noiseXMult = o.noise?.xMultiplier ?? 1;
  const noiseYMult = o.noise?.yMultiplier ?? 1;
  const noiseLayerMult = o.noise?.layerProgressionMultiplier ?? 0.4;
  const noiseAnimMult = o.noise?.animMultiplier ?? 0.3;

  // ── Colors ────────────────────────────────────────────────────────────────
  const opacityMax = o.colors?.opacityMax ?? 4;
  const opacityMin = o.colors?.opacityMin ?? 1;
  const progressionMultiplier = o.colors?.progressionMultiplier ?? 1;
  const layerProgressionMultiplier = o.colors?.layerProgressionMultiplier ?? 1;
  const hueIndexMultiplier = o.colors?.hueIndexMultiplier ?? 5;
  const hueSurfaceMixing = o.colors?.hueSurfaceMixing ?? 0.3;
  const hueOffset = o.colors?.hueOffset ?? 0;

  // ── LOD ───────────────────────────────────────────────────────────────────
  const lodEnabled = o.lod?.enabled ?? true;
  const lodMinLayers = o.lod?.minLayers ?? 3;

  peaks.render( {
    rotation: {
      x: rX,
      y: rY,
      z: rZ
    },
    grid: {
      meridians,
      parallels,
      layers
    },
    seed,
    octaves: detail,
    falloff,
    uniforms: {
      uMeridians: meridians,
      uParallels: parallels,
      uMaxLayers: layers,
      uRadius: [
        radiusX,
        radiusY,
        radiusZ
      ],

      uSpikeLenMin: spikeLengthMin,
      uSpikeLenMax: spikeLengthMax,
      uDepthEaseId: easingId( o.peaks?.depthEasing ?? "easeOutQuad" ),

      uStrokeMin: strokeWeightMin,
      uStrokeMax: strokeWeightMax,
      uStrokeEaseId: easingId( o.peaks?.point?.strokeWeightEasing ?? "easeOutCirc" ),

      uSurfNoiseScale: surfaceNoiseScale,
      uSurfOffset: surfaceOffset,
      uSurfTime: surfaceTime,
      uSurfContrast: surfaceContrast,
      uSurfContrastEaseId: easingId( o.surface?.contrastEasing ?? "easeInQuad" ),

      uLodEnabled: lodEnabled ? 1 : 0,
      uLodMinLayers: lodMinLayers,

      uNoiseXMult: noiseXMult,
      uNoiseYMult: noiseYMult,
      uNoiseLayerMult: noiseLayerMult,
      uNoiseAnimMult: noiseAnimMult,

      uRX: rX,
      uRY: rY,
      uRZ: rZ,

      uOpacityMax: opacityMax,
      uOpacityMin: opacityMin,
      uOpacityEaseId: easingId( o.colors?.opacityEasing ?? "easeInCirc" ),
      uProgMult: progressionMultiplier,
      uLayerProgMult: layerProgressionMultiplier,

      uHueIndexMult: hueIndexMultiplier,
      uHueSurfaceMix: hueSurfaceMixing,
      uHueIndexEaseId: easingId( o.colors?.hueIndexEasing ?? "easeOutSine" ),
      uHueOffset: hueOffset
    }
  } );
} );
