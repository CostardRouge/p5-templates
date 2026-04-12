import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";

import mappers from "@/p5/utils/mappers.js";
import graphics from "@/p5/utils/graphics.js";
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

  const W = width / 2;
  const H = height / 2;

  const easingFunction =
    easing?.[ options.sketch.peaks.easing ] ?? easing.easeInOutExpo;

  const proportional = options.sketch?.grid?.proportional ?? true;
  const columns = options.sketch?.grid?.columns ?? 10;
  const rows = proportional ? ( ( columns * height ) / width ) : options.sketch?.grid?.rows ?? 13;

  const cellSize = width / columns;
  const halfCellSize = cellSize / 2;

  const gridOptions = {
    topLeft: createVector(
      -W,
      -H
    ),
    topRight: createVector(
      W,
      -H
    ),
    bottomLeft: createVector(
      -W,
      H
    ),
    bottomRight: createVector(
      W,
      H
    ),
    rows,
    columns,
    // center: true,
    diamond: false,
  };

  const depth = options.sketch.peaks.depthLayersCount ?? 200 / 4;

  for ( let z = 0; z < depth; z++ ) {
    const depthProgression = -( z / depth );

    grid.draw(
      gridOptions,
      (
        position, coordinates, progression
      ) => {
        const {
          x, y
        } = coordinates;

        const depthLength = ( options.sketch.peaks.depthLength ?? 0.2 );

        sketchState.threeDimensionGraphics.push();
        sketchState.threeDimensionGraphics.translate(
          position.x + halfCellSize,
          position.y + halfCellSize,
          map(
            z,
            0,
            depth,
            0,
            depthLength * ( width + height )
          )
        );

        sketchState.threeDimensionGraphics.strokeWeight( mappers.fn(
          z,
          0,
          depth,
          options.sketch.peaks.point.strokeWeightMax ?? 20,
          options.sketch.peaks.point.strokeWeightMin ?? 3,
          easing?.[ options.sketch.peaks.point.strokeWeightEasing ] ??
            easing.easeOutCirc
        ) );

        const colorFunction = colors.rainbow;
        const opacityFactor =
            mappers.fn(
              sin(
                depthProgression * 20 + progression * 50,
                easing.easeInOutExpo
              ),
              -1,
              1,
              5,
              1
            ) * Math.pow(
              1.05,
              z
            );

        if ( opacityFactor > 8 ) {
        }

        sketchState.threeDimensionGraphics.stroke( colorFunction( {
          hueOffset:
          // +depthProgression*10
          // +mappers.fn(depthProgression, 0, 1, 0, PI/2, easing.easeInOutExpo)
          +time,
          // hueIndex: mappers.circularPolar(progression, 0, 1, -PI, PI)*2,
          hueIndex:
              mappers.fn(
                noise(
                  x / width,
                  y / height,
                  progression / 2 + depthProgression / 2 + time / 16
                ),
                0,
                1,
                -PI,
                PI
              ) * 8,
          // hueIndex:mappers.fn(noise(x/width, y/height, progression/2+depthProgression/2), 0, 1, -PI, PI)*10,
          opacityFactor,
          // opacityFactor: map(depthProgression, 0, 1, 3, 1) * Math.pow(1.05, z)
        } ) );

        sketchState.threeDimensionGraphics.point(
          0,
          0
        );

        sketchState.threeDimensionGraphics.pop();
      }
    );
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
