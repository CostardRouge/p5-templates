import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
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

sketch.draw( async() => {
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

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const zSpeed = options.sketch.noise?.zSpeed ?? 0.05;
  const z = t * zSpeed;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.125;
  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const scale = p.width / columns;
  const lengthScaleMin = options.sketch.stick?.lengthScaleMin ?? 1;
  const lengthScaleMax = options.sketch.stick?.lengthScaleMax ?? 2;
  const strokeWeight = options.sketch.stick?.strokeWeight ?? 10;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityMax = options.sketch.colors?.opacityMax ?? 3;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  p.noFill();

  await grid.draw(
    gridOptions,
    (
      position, {
        x, y
      }
    ) => {
      const angle = p.noise(
        x / columns,
        y / rows + t * yTimeMult,
        z
      ) * ( p.TAU * angleCycles );

      const cellScale = p.map(
        angle,
        sketchState.min,
        sketchState.max,
        scale * lengthScaleMin,
        scale * lengthScaleMax,
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

      p.push();
      p.translate(
        position.x + cellWidth / 2,
        position.y + cellHeight / 2
      );

      p.strokeWeight( strokeWeight );
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

      p.rotate( angle );
      p.line(
        0,
        0,
        cellScale,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
