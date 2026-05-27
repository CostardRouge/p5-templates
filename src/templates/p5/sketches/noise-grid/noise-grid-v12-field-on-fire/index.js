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

sketch.setup( () => {} );

sketch.draw( async(
  _time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch.backgroundColor ?? [
    0
  ] ) );

  const t = animation.angle;

  const rows = options.sketch.grid?.rows ?? 75;
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
    options.sketch.noise?.detailLod ?? 6,
    options.sketch.noise?.detailFalloff ?? 0.6
  );

  const cellWidth = p.width / columns;
  const cellHeight = p.height / rows;
  const scale = cellWidth;
  const zMax = scale * ( options.sketch.displacement?.zScale ?? 10 );

  const angleCycles = options.sketch.angle?.cycles ?? 4;
  const xTimeMult = options.sketch.noise?.xTimeMultiplier ?? 0.25;
  const yTimeMult = options.sketch.noise?.yTimeMultiplier ?? 0.125;
  const zTimeMult = options.sketch.noise?.zTimeMultiplier ?? 0.05;
  const distanceFalloffEasing = easing?.[ options.sketch.distance?.falloffEasing ] ?? easing.easeOutQuad;
  const waveEasing = easing?.[ options.sketch.distance?.waveEasing ] ?? easing.easeOutQuad;
  const waveSpeed = options.sketch.distance?.waveSpeed ?? 1;
  const hueOffsetSpeed = options.sketch.colors?.hueOffsetSpeed ?? 1;
  const hueIndexMultiplier = options.sketch.colors?.hueIndexMultiplier ?? 2;
  const opacityMax = options.sketch.colors?.opacityMax ?? 10;
  const opacityMin = options.sketch.colors?.opacityMin ?? 1;

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

      const distance = cellCenter.dist( center );
      const z = zMax * p.cos( angle );
      const w = mappers.fn(
        p.sin( t * waveSpeed + angle ),
        -1,
        1,
        -p.width / 2,
        p.width / 2,
        waveEasing
      );

      p.stroke( colors.rainbow( {
        hueOffset: t * hueOffsetSpeed,
        hueIndex: p.map(
          z,
          -zMax,
          zMax,
          -p.PI,
          p.PI
        ) * hueIndexMultiplier,
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
      p.strokeWeight( scale );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  renderTitle();
} );
