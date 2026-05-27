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
  p.strokeWeight( options.sketch?.strokeWeight ?? 2 );

  const shape = options.sketch?.shape ?? {};
  const gridOpts = options.sketch?.grid ?? {};
  const cellCfg = options.sketch?.cell ?? {};
  const warp = options.sketch?.warp ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? " sunday bloody sunday";
  const fontName = shape.font ?? "serif";
  const font = string.fonts?.[ fontName ] ?? string.fonts.serif;
  const size = ( shape.size ?? 0.83 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.5;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;

  if ( word.length === 0 || !font?.font ) {
    return;
  }

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 30;
  const rows = proportional ? Math.round( columns * p.height / p.width ) : gridOpts.rows ?? 50;
  const cellSize = p.width / columns;
  const fontFamily = font.font?.names?.fontFamily?.en ?? "unknown";

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

  const borderSize = options.sketch?.strokeWeight ?? 2;
  const boxWidth = cellCfg.boxSize ?? cellSize - borderSize * 2;
  const boxDepth = cellCfg.boxDepth ?? 150;

  const warpAmount = warp.amount ?? 1 / 6;
  const warpRowDivisor = warp.rowDivisor ?? 10;
  const warpColDivisor = warp.colDivisor ?? 10;
  const warpSpeed = warp.speed ?? 1;

  const palette = color.palette ?? "rainbow";
  const colorFunction = colors?.[ palette ] ?? colors.rainbow;
  const useNormalMaterial = color.useNormalMaterial ?? true;
  const hueIndexMultiplier = color.hueIndexMultiplier ?? 4;
  const hueOffset = color.hueOffset ?? 0;
  const opacityMax = color.opacityMax ?? 2.1;
  const opacityMin = color.opacityMin ?? 1;

  await grid.draw(
    gridOptions,
    (
      cellVector, {
        x, y
      }
    ) => {
      const xSign = p.sin( animation.angle );
      const ySign = p.cos( animation.angle );
      const switchingIndex = xSign * ( x / columns ) + ySign * ( y / rows ) + animation.angle;
      const currentLetter = mappers.circularIndex(
        switchingIndex,
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

      const alphaKey = cache.key(
        x,
        y,
        columns,
        rows,
        fontFamily,
        currentLetter,
        sampleFactor,
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
                cellSize,
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

      const hue = p.noise(
        x / columns,
        y / rows + animation.angle / 4
      );
      const tint = colorFunction( {
        hueOffset,
        hueIndex: p.map(
          hue,
          0,
          1,
          -p.PI,
          p.PI
        ) * hueIndexMultiplier,
        opacityFactor: p.map(
          hue,
          0,
          1,
          opacityMax,
          opacityMin
        )
      } );
      const {
        levels: [
          r,
          g,
          b
        ]
      } = tint;

      if ( useNormalMaterial ) {
        p.normalMaterial();
      }
      p.stroke(
        r,
        g,
        b,
        230
      );
      p.fill(
        r,
        g,
        b
      );

      p.push();
      p.rotateX( p.map(
        p.sin( animation.angle * warpSpeed - y / warpRowDivisor ),
        -1,
        1,
        -p.PI,
        p.PI
      ) * warpAmount );
      p.rotateY( p.map(
        p.cos( animation.angle * warpSpeed + x / warpColDivisor ),
        -1,
        1,
        -p.PI,
        p.PI
      ) * warpAmount );
      p.translate(
        cellVector.x,
        cellVector.y,
        -boxDepth / 2
      );
      p.box(
        boxWidth,
        boxWidth,
        -boxDepth
      );
      p.pop();
    }
  );

  renderTitle();
} );
