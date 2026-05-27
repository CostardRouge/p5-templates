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
  max: 0
};

sketch.setup( () => {
  sketchState.min = Math.PI;
  sketchState.max = 0;
} );

sketch.draw( async() => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 80;
  const columns = options.sketch.grid?.columns ?? 50;

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

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const cellSize = ( cellWidth + cellHeight ) / 2;

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const xOff = p.map(
    p.sin( t * ( options.sketch.offsets?.xSpeed ?? 1 ) ),
    -1,
    1,
    0,
    1
  ) / ( options.sketch.offsets?.xRangeDivisor ?? 2 );
  const yOff = p.map(
    p.cos( t * ( options.sketch.offsets?.ySpeed ?? 2 ) ),
    -1,
    1,
    0,
    1
  ) / ( options.sketch.offsets?.yRangeDivisor ?? 2 );
  const zOff = p.map(
    p.cos( t * ( options.sketch.offsets?.zSpeed ?? 0.5 ) ),
    -1,
    1,
    0,
    1
  ) / ( options.sketch.offsets?.zRangeDivisor ?? 2 );

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const weightEasingFn = easing?.[ options.sketch.stroke?.weightEasing ] ?? easing.easeInOutCubic;
  const weightMin = options.sketch.stroke?.weightMin ?? 1;
  const weightMaxScale = options.sketch.stroke?.weightMaxScale ?? 1;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;
  const translateXMult = options.sketch.translation?.xMultiplier ?? 1;
  const translateYMult = options.sketch.translation?.yMultiplier ?? 1;

  p.noFill();

  await grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      const angle = p.noise(
        x / columns + xOff,
        y / rows + yOff,
        zOff
      ) * ( p.TAU * angleCycles );

      sketchState.min = Math.min(
        sketchState.min,
        angle
      );
      sketchState.max = Math.max(
        sketchState.max,
        angle
      );

      const weight = mappers.fn(
        angle,
        sketchState.min,
        p.TAU,
        weightMin,
        cellSize * weightMaxScale,
        weightEasingFn
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
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );
      p.strokeWeight( weight );
      p.translate(
        cellSize * p.sin( angle ) * translateXMult,
        cellSize * p.cos( angle ) * translateYMult
      );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
