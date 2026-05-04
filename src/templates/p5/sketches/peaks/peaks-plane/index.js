import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";

import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

import addScreenPositionFunction from "@/utils/addScreenPositionFunction.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const sketchState = {
  threeDimensionGraphics: null,
  interactive: {
    position: null,
    image: null
  }
};

events.register(
  "engine-window-preload",
  () => {
    const p = getP5();

    sketchState.interactive.image = getP5().loadImage( "/assets/images/handpointing.png" );
  }
);

sketch.setup(
  async() => {
    const p = getP5();

    sketchState.threeDimensionGraphics = graphics.createAutoResizableGraphics(
      p.width,
      p.height,
      "webgl"
    );

    await addScreenPositionFunction( sketchState.threeDimensionGraphics );
  },
  {}
);

sketch.draw( (
  time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const W = p.width / 2;
  const H = p.height / 2;

  const g = sketchState.threeDimensionGraphics;

  // ── Peaks ─────────────────────────────────────────────────────────────────
  const layers = options.sketch.peaks?.layers ?? 80;
  const spikeLengthMax = options.sketch.peaks?.spikeLengthMax ?? 300;
  const baseHeightMax = options.sketch.peaks?.baseHeightMax ?? 80;
  const spikeLengthEasingFn = easing?.[ options.sketch.peaks?.spikeLengthEasing ] ?? easing.easeInQuad;
  const baseHeightEasingFn = easing?.[ options.sketch.peaks?.baseHeightEasing ] ?? easing.linear;
  const depthEasingFn = easing?.[ options.sketch.peaks?.depthEasing ] ?? easing.easeOutQuad;

  const strokeWeightMin = options.sketch.peaks?.point?.strokeWeightMin ?? 1;
  const strokeWeightMax = options.sketch.peaks?.point?.strokeWeightMax ?? 12;
  const strokeWeightEasingFn = easing?.[ options.sketch.peaks?.point?.strokeWeightEasing ] ?? easing.easeOutCirc;

  // ── LOD ───────────────────────────────────────────────────────────────────
  // Short/flat spikes are rendered with fewer layers proportional to their
  // p.height factor, down to lodMinLayers at minimum.
  const lodEnabled = options.sketch.lod?.enabled ?? true;
  const lodMinLayers = options.sketch.lod?.minLayers ?? 3;

  // ── Spatial field ─────────────────────────────────────────────────────────
  // Two independent Perlin fields (separated in noise-Z space) drive:
  //   heightField  → spike length per column
  //   terrainField → base elevation per column (creates valley undulation)
  const fieldXScale = options.sketch.field?.xScale ?? 1.5;
  const fieldYScale = options.sketch.field?.yScale ?? 1.5;
  const fieldHeightOffset = options.sketch.field?.heightOffset ?? 0;
  const fieldTerrainOffset = options.sketch.field?.terrainOffset ?? 50;
  const fieldAnimSpeed = options.sketch.field?.animSpeed ?? 0.1;
  const fieldAnimated = options.sketch.field?.animated ?? true;
  const fieldTime = fieldAnimated ? animation.angle * fieldAnimSpeed : 0;

  // ── Grid ──────────────────────────────────────────────────────────────────
  const proportional = options.sketch?.grid?.proportional ?? true;
  const columns = options.sketch?.grid?.columns ?? 14;
  const rows = proportional
    ? Math.round( columns * p.height / p.width )
    : ( options.sketch?.grid?.rows ?? 10 );

  // ── Rotation (with constant base tilt to see the plane from above) ────────
  const rotationEnabled = options.sketch.rotation?.enabled ?? true;
  const angleMax = options.sketch.rotation?.angleMax ?? ( p.PI / 32 );
  const xBase = options.sketch.rotation?.xBase ?? ( -p.PI / 4 );
  const yBase = options.sketch.rotation?.yBase ?? 0;
  const xMultiplier = options.sketch.rotation?.xMultiplier ?? 1;
  const yMultiplier = options.sketch.rotation?.yMultiplier ?? 0.5;
  const zMultiplier = options.sketch.rotation?.zMultiplier ?? 0;

  const rX = xBase + ( rotationEnabled
    ? mappers.fn(
      p.sin( animation.angle * xMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0 );
  const rY = yBase + ( rotationEnabled
    ? mappers.fn(
      p.cos( animation.angle * yMultiplier ),
      -1,
      1,
      -angleMax,
      angleMax
    )
    : 0 );
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

  const noiseXMult = options.sketch.noise?.xMultiplier ?? 2;
  const noiseYMult = options.sketch.noise?.yMultiplier ?? 2;
  const noiseLayerMult = options.sketch.noise?.layerProgressionMultiplier ?? 0.3;
  const noiseAnimMult = options.sketch.noise?.animMultiplier ?? 0.5;

  // ── Colors ────────────────────────────────────────────────────────────────
  const colorFunction = colors.rainbow;
  const opacityMax = options.sketch.colors?.opacityMax ?? 4;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const layerProgressionMult = options.sketch.colors?.layerProgressionMultiplier ?? 1;
  const heightProgressionMult = options.sketch.colors?.heightProgressionMultiplier ?? 1;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 5;
  const hueHeightMixing = options.sketch.colors?.hueHeightMixing ?? 0.4;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const hueIndexEasingFn = easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.easeOutSine;
  const opacityEasingFn = easing?.[ options.sketch.colors?.opacityEasing ] ?? easing.easeInCirc;

  // ── Draw ──────────────────────────────────────────────────────────────────
  for ( let col = 0; col < columns; col++ ) {
    const colNorm = col / ( columns > 1 ? columns - 1 : 1 );

    // Grid position on the XZ plane: X left↔right, Z front↔back
    const px = mappers.fn(
      colNorm,
      0,
      1,
      -W,
      W
    );

    for ( let row = 0; row < rows; row++ ) {
      const rowNorm = row / ( rows > 1 ? rows - 1 : 1 );
      const pz = mappers.fn(
        rowNorm,
        0,
        1,
        -H,
        H
      );

      // Normalised column index for per-point noise progression
      const columnProgression = ( col * rows + row ) / ( columns * rows - 1 );

      // Spatial inputs for the two field noises
      const nx = colNorm * fieldXScale;
      const ny = rowNorm * fieldYScale;

      // Height field → spike length
      const heightFactor = p.noise(
        nx,
        ny,
        fieldHeightOffset + fieldTime
      );
      // Terrain field → base elevation (offset in noise-Z to decorrelate)
      const terrainFactor = p.noise(
        nx + 100,
        ny + 50,
        fieldTerrainOffset + fieldTime
      );

      const spikeLength = mappers.fn(
        heightFactor,
        0,
        1,
        0,
        spikeLengthMax,
        spikeLengthEasingFn
      );
      const baseElevation = mappers.fn(
        terrainFactor,
        0,
        1,
        0,
        baseHeightMax,
        baseHeightEasingFn
      );

      // LOD: fewer layers for short spikes (proportional to heightFactor)
      const effectiveLayers = lodEnabled
        ? Math.max(
          lodMinLayers,
          Math.round( layers * heightFactor )
        )
        : layers;

      for ( let layer = 0; layer < effectiveLayers; layer++ ) {
        const layerProgression = effectiveLayers > 1 ? layer / ( effectiveLayers - 1 ) : 1;

        // Elevation: layer 0 = tip (highest), last layer = base (on terrain plane)
        const elevation = baseElevation + mappers.fn(
          layerProgression,
          0,
          1,
          spikeLength,
          0,
          depthEasingFn
        );

        // -Y because in p5 WebGL, negative Y is upward
        const py = -elevation;

        const strokeWeight = mappers.fn(
          layerProgression,
          0,
          1,
          strokeWeightMin,
          strokeWeightMax,
          strokeWeightEasingFn
        );

        // Per-point color noise
        const colorNoise = p.noise(
          colNorm * noiseXMult + rX,
          rowNorm * noiseYMult + rY,
          layerProgression * noiseLayerMult + fieldTime * noiseAnimMult + columnProgression + rZ
        );

        // Mix spatial p.height into hue so tall peaks have different colors
        const hueNoise = p.lerp(
          colorNoise,
          heightFactor,
          hueHeightMixing
        );

        const opacityFactor = mappers.fn(
          p.sin( colorNoise * p.TAU + heightFactor * heightProgressionMult + layerProgression * layerProgressionMult ),
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
          opacityFactor
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
