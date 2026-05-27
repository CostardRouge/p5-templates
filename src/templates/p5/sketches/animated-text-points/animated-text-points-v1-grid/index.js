import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import cache from "@/p5/utils/cache.js";
import grid from "@/p5/utils/grid.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

sketch.draw( async() => {
  const p = getP5();

  p.background( ...( options.sketch?.backgroundColor ?? [
    0,
    0,
    0
  ] ) );

  const shape = options.sketch?.shape ?? {};
  const gridOpts = options.sketch?.grid ?? {};
  const dot = options.sketch?.dot ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "*text-points-on-grid-cells";
  const fontName = shape.font ?? "serif";
  const font = string.fonts?.[ fontName ] ?? string.fonts.serif;
  const size = ( shape.size ?? 0.92 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.1;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;
  const morphSpeed = shape.morphSpeed ?? 2;

  if ( word.length === 0 || !font?.font ) {
    return;
  }

  const phase = animation.angle * morphSpeed / p.TAU;
  const currentLetter = mappers.circularIndex(
    phase,
    word
  );

  const points = string.getTextPoints( {
    text: currentLetter,
    position: p.createVector(
      0,
      0
    ),
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 30;
  const rows = proportional ? Math.round( columns * p.height / p.width ) : gridOpts.rows ?? 50;
  const distanceThreshold = ( dot.distanceThreshold ?? 0.037 ) * p.width;

  const gridOptions = {
    topLeft: p.createVector(
      -p.width / 2,
      -p.height / 2
    ),
    topRight: p.createVector(
      p.width / 2,
      -p.height / 2
    ),
    bottomLeft: p.createVector(
      -p.width / 2,
      p.height / 2
    ),
    bottomRight: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    rows,
    columns
  };

  const dotSize = dot.size ?? 20;
  const palette = color.palette ?? "purpleSimple";
  const colorFunction = colors?.[ palette ] ?? colors.purpleSimple;

  const fontFamily = font.font?.names?.fontFamily?.en ?? "unknown";

  p.noStroke();

  await grid.draw(
    gridOptions,
    (
      cellVector, {
        x, y
      }
    ) => {
      const alphaKey = cache.key(
        x,
        y,
        columns,
        rows,
        fontFamily,
        currentLetter,
        sampleFactor,
        Math.round( distanceThreshold ),
        "alpha"
      );
      const alpha = cache.store(
        alphaKey,
        () => points.reduce(
          (
            result, point
          ) => {
            if ( result >= 255 ) {
              return result;
            }

            return Math.max(
              result,
              ~~p.map(
                point.dist( cellVector ),
                0,
                distanceThreshold,
                255,
                0,
                true
              )
            );
          },
          0
        )
      );

      if ( !alpha ) {
        return;
      }

      const tint = colorFunction( {
        hueOffset: animation.angle * ( color.hueOffsetSpeed ?? 0 ),
        hueIndex: mappers.fn(
          x / columns + y / rows,
          0,
          2,
          -p.PI,
          p.PI
        ) * ( color.hueMultiplier ?? 0 ),
        opacityFactor: color.opacityFactor ?? 1
      } );

      const {
        levels: [
          r,
          g,
          b
        ]
      } = tint;

      p.fill(
        r,
        g,
        b,
        alpha
      );
      p.circle(
        cellVector.x,
        cellVector.y,
        dotSize
      );
    }
  );

  renderTitle();
} );
