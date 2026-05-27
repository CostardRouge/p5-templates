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
    options.sketch.noise?.detailLod ?? 8,
    bass
  );

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.2;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.1;
  const weightEasingFn = easing?.[ options.sketch.stroke?.weightEasing ] ?? easing.easeInOutCubic;
  const weightMin = options.sketch.stroke?.weightMin ?? 1;
  const weightMax = options.sketch.stroke?.weightMax ?? 10;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 2;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;
  const opacityFactor = options.sketch.colors?.opacityFactor ?? 1.5;

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
        t * zTimeMult
      ) * ( p.TAU * angleCycles );

      const weight = mappers.fn(
        angle,
        sketchState.min,
        p.TAU,
        weightMin,
        weightMax,
        weightEasingFn
      );

      sketchState.min = Math.min(
        sketchState.min,
        angle
      );
      sketchState.max = Math.max(
        sketchState.max,
        angle
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
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
