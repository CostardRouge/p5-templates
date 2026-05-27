import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const sketchState = {
  min: Math.PI,
  max: Math.PI
};

sketch.setup( () => {
  sketchState.min = Math.PI;
  sketchState.max = Math.PI;
} );

sketch.draw( async(
  _time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 40;
  const columns = options.sketch.grid?.columns ?? 40;

  const gridOptions = {
    topLeft: p.createVector(
      0,
      0
    ),
    topRight: p.createVector(
      p.width,
      0
    ),
    bottomLeft: p.createVector(
      0,
      p.height
    ),
    bottomRight: p.createVector(
      p.width,
      p.height
    ),
    rows,
    columns
  };

  // Pulse drives noise detail and stand-in for bass in the original.
  const bass = mappers.fn(
    p.sin( t * ( options.sketch.pulse?.speed ?? 2 ) ),
    -1,
    1,
    0,
    1,
    easing.easeInOutSine
  );

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detailLod ?? 6,
    p.map(
      bass,
      0,
      1,
      options.sketch.noise?.falloffMin ?? 0.2,
      options.sketch.noise?.falloffMax ?? 0.8
    )
  );

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const cellSize = cellWidth;

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const xTimeMult = options.sketch.noise?.xTimeMultiplier ?? 0.16;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.33;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.1;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const pulseWeightBoost = options.sketch.pulse?.weightBoost ?? 0.5;

  await grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      const cellCenter = p.createVector(
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );

      const angle = p.noise(
        x / columns + t * xTimeMult,
        y / rows + t * yTimeMult,
        t * zTimeMult
      ) * ( p.TAU * angleCycles );

      const weight = p.map(
        angle,
        sketchState.min,
        sketchState.max,
        0,
        cellSize * ( 1 + bass * pulseWeightBoost ),
        true
      );

      sketchState.min = Math.min(
        sketchState.min,
        angle
      );
      sketchState.max = Math.max(
        sketchState.max,
        angle
      );

      const opacityFactor = p.map(
        angle,
        sketchState.min,
        sketchState.max,
        opacityMax,
        opacityMin
      );

      p.stroke( colors.rainbow( {
        hueOffset,
        hueIndex: p.map(
          angle,
          sketchState.min,
          p.TAU,
          -hueRange,
          hueRange
        ),
        opacityFactor
      } ) );

      p.push();
      p.translate(
        cellCenter.x,
        cellCenter.y
      );
      p.strokeWeight( weight );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
