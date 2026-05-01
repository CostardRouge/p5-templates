import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";

import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import addScreenPositionFunction from "@/public/assets/libraries/addScreenPositionFunction.js";
import { getP5 } from "@/p5/utils/sketch.js";

const sketchState = {
  threeDimensionGraphics: null,
  interactive: {
    position: null,
    image: null,
  },
};

events.register(
  "engine-window-preload",
  () => {
  const p = getP5();
    sketchState.interactive.image = getP5().loadImage( "/assets/images/handpointing.png" );
  }
);

sketch.setup(
  ( ) => {
  const p = getP5();
    sketchState.threeDimensionGraphics = graphics.createAutoResizableGraphics(
      p.width,
      p.height,
      "webgl"
    );

    addScreenPositionFunction( sketchState.threeDimensionGraphics );
  },
  {
  }
);

sketch.draw( (
  time, center
) => {
  const p = getP5();
  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const g = sketchState.threeDimensionGraphics;

  // ── Sphere shape ──────────────────────────────────────────────────────────
  const radiusX = options.sketch.sphere?.radiusX ?? 200;
  const radiusY = options.sketch.sphere?.radiusY ?? 200;
  const radiusZ = options.sketch.sphere?.radiusZ ?? 200;
  const meridians = options.sketch.sphere?.meridians ?? 28;
  const parallels = options.sketch.sphere?.parallels ?? 16;

  // ── Peaks / spikes ────────────────────────────────────────────────────────
  const layers = options.sketch.peaks?.layers ?? 100;
  const spikeLengthMax = options.sketch.peaks?.spikeLengthMax ?? 200;
  const spikeLengthMin = options.sketch.peaks?.spikeLengthMin ?? 0;
  const depthEasingFn = easing?.[ options.sketch.peaks?.depthEasing ] ?? easing.easeOutQuad;
  const strokeWeightMin = options.sketch.peaks?.point?.strokeWeightMin ?? 1;
  const strokeWeightMax = options.sketch.peaks?.point?.strokeWeightMax ?? 12;
  const strokeWeightEasingFn = easing?.[ options.sketch.peaks?.point?.strokeWeightEasing ] ?? easing.easeOutCirc;

  // ── Surface deformation ───────────────────────────────────────────────────
  // A Perlin noise field modulates the spike length per point (0→1 factor).
  // This creates mountain/valley topology on the sphere surface.
  const surfaceNoiseScale = options.sketch.surface?.noiseScale ?? 1.5;
  const surfaceNoiseSpeed = options.sketch.surface?.noiseSpeed ?? 0.15;
  const surfaceAnimated = options.sketch.surface?.animated ?? true;
  const surfaceContrast = options.sketch.surface?.contrast ?? 1;
  const surfaceContrastEasingFn = easing?.[ options.sketch.surface?.contrastEasing ] ?? easing.easeInQuad;
  const surfaceOffset = options.sketch.surface?.noiseOffset ?? 0;
  const surfaceTime = surfaceAnimated ? animation.angle * surfaceNoiseSpeed : 0;

  // ── Rotation ──────────────────────────────────────────────────────────────
  const rotationEnabled = options.sketch.rotation?.enabled ?? true;
  const angleMax = options.sketch.rotation?.angleMax ?? ( p.PI / 16 );
  const xMultiplier = options.sketch.rotation?.xMultiplier ?? 1;
  const yMultiplier = options.sketch.rotation?.yMultiplier ?? 2;
  const zMultiplier = options.sketch.rotation?.zMultiplier ?? 0;

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

  g.rotateX( rX );
  g.rotateY( rY );
  g.rotateZ( rZ );

  // ── Noise setup ───────────────────────────────────────────────────────────
  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const noiseXMult = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 1;
  const noiseLayerMult = options.sketch.noise?.layerProgressionMultiplier ?? 0.4;
  const noiseAnimMult = options.sketch.noise?.animMultiplier ?? 0.3;

  // ── Colors ────────────────────────────────────────────────────────────────
  const colorFunction = colors.rainbow;
  const opacityMax = options.sketch.colors?.opacityMax ?? 4;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const progressionMultiplier = options.sketch.colors?.progressionMultiplier ?? 1;
  const layerProgressionMultiplier = options.sketch.colors?.layerProgressionMultiplier ?? 1;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 5;
  const hueSurfaceMixing = options.sketch.colors?.hueSurfaceMixing ?? 0.3;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const hueIndexEasingFn = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeOutSine;
  const opacityEasingFn = easing?.[ options.sketch.colors?.opacityEasing ] ?? easing.easeInCirc;

  // ── LOD ───────────────────────────────────────────────────────────────────
  const lodEnabled = options.sketch.lod?.enabled ?? true;
  const lodMinLayers = options.sketch.lod?.minLayers ?? 3;

  // ── Precompute total points for progression ───────────────────────────────
  const totalPoints = meridians * parallels;

  // ── Draw ──────────────────────────────────────────────────────────────────
  for ( let col = 0; col < meridians; col++ ) {
    const colNorm = col / meridians;
    // Longitude angle: 0 → 2π (full circle around Y axis)
    const theta = colNorm * p.TWO_PI;

    for ( let row = 0; row < parallels; row++ ) {
      const rowNorm = row / ( parallels - 1 );
      // Latitude angle: 0 → π (top pole → bottom pole)
      const phi = rowNorm * p.PI;

      // At the poles (row 0 = north, last row = south), all meridians
      // converge to the same point. Only draw once (col 0) to avoid
      // stacked duplicate spikes.
      const isPole = row === 0 || row === parallels - 1;

      if ( isPole && col > 0 ) {
        continue;
      }

      const progression = ( col * parallels + row ) / ( totalPoints - 1 );

      // ── Unit direction on the ellipsoid ──────────────────────────────
      const sinPhi = p.sin( phi );
      const cosPhi = p.cos( phi );
      const sinTheta = p.sin( theta );
      const cosTheta = p.cos( theta );

      // Base position on ellipsoid surface
      const baseX = radiusX * sinPhi * cosTheta;
      const baseY = radiusY * cosPhi;
      const baseZ = radiusZ * sinPhi * sinTheta;

      // ── Surface deformation factor (noise-driven spike length) ───────
      const surfaceNoise = p.noise(
        colNorm * surfaceNoiseScale + surfaceOffset,
        rowNorm * surfaceNoiseScale,
        surfaceTime
      );
      const surfaceFactor = mappers.fn(
        surfaceNoise,
        0,
        1,
        0,
        surfaceContrast,
        surfaceContrastEasingFn
      );

      const spikeLength = mappers.fn(
        surfaceFactor,
        0,
        surfaceContrast,
        spikeLengthMin,
        spikeLengthMax
      );

      // LOD: fewer layers for shorter spikes
      const normalizedSurface = surfaceContrast > 0
        ? surfaceFactor / surfaceContrast
        : 1;
      const effectiveLayers = lodEnabled
        ? Math.max(
          lodMinLayers,
          Math.round( layers * normalizedSurface )
        )
        : layers;

      for ( let layer = 0; layer < effectiveLayers; layer++ ) {
        const layerProgression = effectiveLayers > 1
          ? layer / ( effectiveLayers - 1 )
          : 1;

        // Layer 0 = tip (farthest from surface), last = base (on surface)
        const layerOffset = mappers.fn(
          layerProgression,
          0,
          1,
          spikeLength,
          0,
          depthEasingFn
        );

        // Scale direction outward from the ellipsoid centre
        const baseLenSq = radiusX * radiusX * sinPhi * sinPhi * cosTheta * cosTheta
          + radiusY * radiusY * cosPhi * cosPhi
          + radiusZ * radiusZ * sinPhi * sinPhi * sinTheta * sinTheta;
        const scale = 1 + layerOffset / Math.sqrt( baseLenSq );

        const px = baseX * scale;
        const py = baseY * scale;
        const pz = baseZ * scale;

        // Stroke weight
        const strokeWeight = mappers.fn(
          layerProgression,
          0,
          1,
          strokeWeightMin,
          strokeWeightMax,
          strokeWeightEasingFn
        );

        // Color noise
        const colorNoise = p.noise(
          colNorm * noiseXMult + rX,
          rowNorm * noiseYMult + rY,
          layerProgression * noiseLayerMult + surfaceTime * noiseAnimMult + progression + rZ
        );

        // Mix surface p.height into hue
        const hueNoise = p.lerp(
          colorNoise,
          normalizedSurface,
          hueSurfaceMixing
        );

        const opacityFactor = mappers.fn(
          p.sin( colorNoise * p.TAU + progression * progressionMultiplier + layerProgression * layerProgressionMultiplier ),
          -1,
          1,
          opacityMax,
          opacityMin,
          opacityEasingFn
        );

        g.strokeWeight( strokeWeight );
        g.stroke( colorFunction( {
          hueOffset,
          hueIndex: mappers.fn(
            hueNoise,
            0,
            1,
            -p.PI,
            p.PI,
            hueIndexEasingFn
          ) * hueIndexMultiplier,
          opacityFactor,
        } ) );

        g.point(
          px,
          py,
          pz
        );
      }
    }
  }

  p.image(
    g,
    0,
    0
  );
  g.clear();
  g.reset();

  renderTitle();
} );
