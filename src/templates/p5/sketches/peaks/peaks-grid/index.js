import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";

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
  async( ) => {
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

  const easingFunction =
    easing?.[ options.sketch.peaks.depthEasing ] ?? easing.easeInOutExpo;

  const proportional = options.sketch?.grid?.proportional ?? true;
  const columns = options.sketch?.grid?.columns ?? 10;
  const rows = proportional ? ( ( columns * p.height ) / p.width ) : options.sketch?.grid?.rows ?? 13;

  const cellSize = p.width / columns;
  const halfCellSize = cellSize / 2;

  const gridOptions = {
    topLeft: p.createVector(
      -W,
      -H
    ),
    topRight: p.createVector(
      W,
      -H
    ),
    bottomLeft: p.createVector(
      -W,
      H
    ),
    bottomRight: p.createVector(
      W,
      H
    ),
    rows,
    columns,
    // center: true,
    diamond: false
  };

  const rotationEnabled = options.sketch.rotation?.enabled ?? true;
  const angleMax = options.sketch.rotation?.angleMax ?? ( p.PI / 16 );
  const xMultiplier = options.sketch.rotation?.xMultiplier ?? 2;
  const yMultiplier = options.sketch.rotation?.yMultiplier ?? 3;
  const zMultiplier = options.sketch.rotation?.zMultiplier ?? 1;

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

  sketchState.threeDimensionGraphics.rotateX( rX );
  sketchState.threeDimensionGraphics.rotateY( rY );
  sketchState.threeDimensionGraphics.rotateZ( rZ );

  p.noiseSeed( options.sketch.noise?.seed ?? 488 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const layers = options.sketch.peaks.depthLayersCount ?? 150;
  const depthLength = Math.min(
    p.width,
    p.height
  ) * (
    options.sketch.peaks.depthLengthMultiplier ?? 1
  );

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

    const pointZ = mappers.fn(
      layerProgression,
      0,
      1,
      depthLength * -1,
      0,
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

    grid.draw(
      gridOptions,
      (
        position, coordinates, progression
      ) => {
        const {
          x, y
        } = coordinates;

        sketchState.threeDimensionGraphics.strokeWeight( layerStrokeWeight );

        const rotationNoise = p.noise(
          -( x / p.width ) * noiseXMultiplier + rX,
          -( y / p.height ) * noiseYMultiplier + rY,
          layerProgression * noiseLayerProgressionMultiplier + progression * noiseProgressionMultiplier + rZ
        );

        const opacityFactor = mappers.fn(
          p.sin( rotationNoise * p.TAU
            + progression * progressionMultiplier
            + layerProgression * layerProgressionMultiplier ),
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
            -p.PI,
            p.PI,
            easing?.[ options.sketch.colors?.hueIndexEasing ] ?? easing.linear
          ) * hueIndexMultiplier,
          opacityFactor
        } ) );

        sketchState.threeDimensionGraphics.point(
          position.x + halfCellSize,
          position.y + halfCellSize,
          pointZ
        );
      }
    );
  }

  p.image(
    sketchState.threeDimensionGraphics,
    0,
    0
  );
  sketchState.threeDimensionGraphics.clear();
  sketchState.threeDimensionGraphics.reset();

  renderTitle();
} );
