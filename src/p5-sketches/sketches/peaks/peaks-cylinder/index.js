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
    sketchState.interactive.image = loadImage( "/assets/images/handpointing.png" );
  }
);

sketch.setup(
  ( ) => {
    sketchState.threeDimensionGraphics = graphics.createAutoResizableGraphics(
      width,
      height,
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
  background( 0 );

  const easingFunction =
    easing?.[ options.sketch.peaks.depthEasing ] ?? easing.easeInOutExpo;

  const cylinderRadius = options.sketch.cylinder?.radius      ?? 200;
  const cylinderHeight = options.sketch.cylinder?.height      ?? 400;
  const spikeLength    = options.sketch.cylinder?.spikeLength ?? 150;
  const columns        = options.sketch.cylinder?.columns     ?? 24;
  const rows           = options.sketch.cylinder?.rows        ?? 12;

  const rotationEnabled = options.sketch.rotation?.enabled ?? true;
  const angleMax = options.sketch.rotation?.angleMax ?? ( PI / 16 );
  const xMultiplier = options.sketch.rotation?.xMultiplier ?? 2;
  const yMultiplier = options.sketch.rotation?.yMultiplier ?? 3;
  const zMultiplier = options.sketch.rotation?.zMultiplier ?? 1;

  const rX = rotationEnabled
    ? mappers.fn(
      sin( animation.angle * xMultiplier ), -1, 1, -angleMax, angleMax
    )
    : 0;
  const rY = rotationEnabled
    ? mappers.fn(
      cos( animation.angle * yMultiplier ), -1, 1, -angleMax, angleMax
    )
    : 0;
  const rZ = rotationEnabled
    ? mappers.fn(
      sin( animation.angle * zMultiplier ), -1, 1, -angleMax, angleMax
    )
    : 0;

  sketchState.threeDimensionGraphics.rotateX( rX );
  sketchState.threeDimensionGraphics.rotateY( rY );
  sketchState.threeDimensionGraphics.rotateZ( rZ );

  noiseSeed( options.sketch.noise?.seed ?? 488 );
  noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const layers = options.sketch.peaks.depthLayersCount ?? 150;
  const totalPoints = columns * rows;

  const noiseXMultiplier = options.sketch.noise?.xMultiplier ?? 1;
  const noiseYMultiplier = options.sketch.noise?.yMultiplier ?? 1;
  const noiseProgressionMultiplier = options.sketch.noise?.progressionMultiplier ?? 1;
  const noiseLayerProgressionMultiplier = options.sketch.noise?.layerProgressionMultiplier ?? 1;

  const colorFunction = colors.rainbow;

  const opacityMax = options.sketch.colors?.opacityMax ?? 4;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const progressionMultiplier = options.sketch.colors?.progressionMultiplier ?? 1;
  const layerProgressionMultiplier = options.sketch.colors?.layerProgressionMultiplier ?? 1;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 4;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;

  for ( let layer = 0; layer < layers; layer++ ) {
    const layerProgression = ( layer / ( layers - 1 ) );

    const layerRadius = mappers.fn(
      layerProgression,
      0,
      1,
      cylinderRadius + spikeLength,
      cylinderRadius,
      easingFunction
    );

    const layerStrokeWeight = mappers.fn(
      layerProgression,
      0,
      1,
      options.sketch.peaks.point.strokeWeightMin ?? 3,
      options.sketch.peaks.point.strokeWeightMax ?? 20,
      easing?.[ options.sketch.peaks.point.strokeWeightEasing ] ?? easing.easeOutCirc
    );

    sketchState.threeDimensionGraphics.strokeWeight( layerStrokeWeight );

    for ( let col = 0; col < columns; col++ ) {
      const colProgression = col / columns;
      const theta = colProgression * TWO_PI;

      for ( let row = 0; row < rows; row++ ) {
        const rowProgression = row / ( rows - 1 );
        const progression = ( col * rows + row ) / ( totalPoints - 1 );

        const px = layerRadius * cos( theta );
        const py = mappers.fn( rowProgression, 0, 1, -cylinderHeight / 2, cylinderHeight / 2 );
        const pz = layerRadius * sin( theta );

        const rotationNoise = noise(
          colProgression * noiseXMultiplier + rX,
          rowProgression * noiseYMultiplier + rY,
          layerProgression * noiseLayerProgressionMultiplier + progression * noiseProgressionMultiplier + rZ
        );

        const opacityFactor = mappers.fn(
          sin(
            rotationNoise * TAU
            + progression * progressionMultiplier
            + layerProgression * layerProgressionMultiplier
          ),
          -1,
          1,
          opacityMax,
          opacityMin,
          easing?.[ options.sketch.colors?.opacityEasing ] ?? easing.easeInCirc
        );

        sketchState.threeDimensionGraphics.stroke( colorFunction( {
          hueOffset,
          hueIndex: mappers.fn(
            rotationNoise,
            0,
            1,
            -PI,
            PI,
            easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.linear
          ) * hueIndexMultiplier,
          opacityFactor,
        } ) );

        sketchState.threeDimensionGraphics.point( px, py, pz );
      }
    }
  }

  image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();

  renderTitle();
} );
