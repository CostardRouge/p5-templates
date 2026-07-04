import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";
import grid from "@/p5/utils/grid.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";

const sketchState = {
  min: Math.PI,
  max: 0,
  xOff: 0,
  yOff: 0
};

sketch.setup( () => {
  sketchState.min = Math.PI;
  sketchState.max = 0;
  sketchState.xOff = 0;
  sketchState.yOff = 0;
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

  const detailValues = options.sketch.detail?.values ?? [
    0.2,
    0.3,
    0.4,
    0.5
  ];
  const detail = animation.sequence(
    "noise-grid-v9-detail",
    t,
    detailValues,
    options.sketch.detail?.lerp ?? 0.07
  );

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detailLod ?? 88,
    detail
  );

  const xSpeedValues = options.sketch.drift?.xSpeedValues ?? [
    -0.01,
    0.01
  ];
  const ySpeedValues = options.sketch.drift?.ySpeedValues ?? [
    -0.01,
    0.01
  ];
  const driftLerp = options.sketch.drift?.lerp ?? 0.07;

  sketchState.xOff += animation.sequence(
    "noise-grid-v9-x-speed",
    t / 2,
    xSpeedValues,
    driftLerp
  );
  sketchState.yOff += animation.sequence(
    "noise-grid-v9-y-speed",
    t / 4,
    ySpeedValues,
    driftLerp
  );

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const cellSize = ( cellWidth + cellHeight ) / 2;

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const weightEasingFn = easing?.[ options.sketch.stroke?.weightEasing ] ?? easing.easeInOutCubic;
  const weightMin = options.sketch.stroke?.weightMin ?? 1;
  const weightMaxScale = options.sketch.stroke?.weightMaxScale ?? 1;
  const hueMax = options.sketch.colors?.hueMax ?? p.PI;
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
        x / columns + sketchState.xOff,
        y / rows + sketchState.yOff
      ) * ( p.TAU * angleCycles );

      const weight = mappers.fn(
        angle,
        sketchState.min,
        p.TAU,
        weightMin,
        cellSize * weightMaxScale,
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
          -hueMax,
          hueMax
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
} );
