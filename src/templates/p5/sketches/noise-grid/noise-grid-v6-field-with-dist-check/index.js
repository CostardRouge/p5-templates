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

  p.noiseSeed( options.sketch.noise?.seed ?? 42 );
  p.noiseDetail(
    options.sketch.noise?.detail ?? 4,
    options.sketch.noise?.falloff ?? 0.5
  );

  const scale = p.width / columns;
  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const xTimeMult = options.sketch.noise?.xTimeMultiplier ?? 0.25;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.125;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.16;

  const distanceFalloffEasing = easing?.[ options.sketch.distance?.falloffEasing ] ?? easing.easeInQuad;
  const distanceWaveEasing = easing?.[ options.sketch.distance?.waveEasing ] ?? easing.easeOutQuad;
  const distanceWaveMin = options.sketch.distance?.waveMin ?? 0.5;
  const distanceWaveMax = options.sketch.distance?.waveMax ?? 1;
  const distanceWaveSpeed = options.sketch.distance?.waveSpeed ?? 1;
  const opacityMax = options.sketch.colors?.opacityMax ?? 100;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;
  const hueRange = options.sketch.colors?.hueRange ?? p.PI / 4;
  const hueOffset = options.sketch.colors?.hueOffset ?? 0;

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
        center.dist( cellCenter ),
        0,
        p.width,
        0,
        scale,
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

      const distance = cellCenter.dist( center );
      const w = mappers.fn(
        p.sin( t * distanceWaveSpeed + angle ),
        -1,
        1,
        p.width * distanceWaveMin,
        p.width * distanceWaveMax,
        distanceWaveEasing
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
        opacityFactor: mappers.fn(
          distance,
          0,
          w,
          opacityMax,
          opacityMin,
          distanceFalloffEasing
        )
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
