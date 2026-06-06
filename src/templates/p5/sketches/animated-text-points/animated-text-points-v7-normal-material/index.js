import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import gridMask from "@/p5/utils/gridMask.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

const drawCross = (
  p, position, size
) => {
  p.line(
    position.x - size / 2,
    position.y - size / 2,
    position.x + size / 2,
    position.y + size / 2
  );
  p.line(
    position.x + size / 2,
    position.y - size / 2,
    position.x - size / 2,
    position.y + size / 2
  );
};

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
  const sceneRot = options.sketch?.sceneRotation ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "abcdefgh";
  const fontName = shape.font ?? "sans";
  const font = string.fonts?.[ fontName ] ?? string.fonts.sans;
  const size = ( shape.size ?? 0.74 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.5;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;

  if ( word.length === 0 || !font?.font ) {
    return;
  }

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 30;
  const rows = proportional ? Math.round( columns * p.height / p.width ) : gridOpts.rows ?? 50;
  const cellSize = p.width / columns;

  if ( sceneRot.enabled ?? true ) {
    p.rotateY( mappers.fn(
      p.sin( animation.angle * ( sceneRot.speed ?? 1.5 ) ),
      -1,
      1,
      -( sceneRot.amount ?? p.PI / 6 ),
      sceneRot.amount ?? p.PI / 6,
      easing.easeInOutCubic
    ) );

    p.rotateX( p.map(
      p.sin( animation.angle * ( sceneRot.microSpeedX ?? 1 ) ),
      -1,
      1,
      -p.PI,
      p.PI
    ) / ( sceneRot.microDivisorX ?? 12 ) );
    p.rotateY( p.map(
      p.cos( animation.angle * ( sceneRot.microSpeedY ?? 0.5 ) ),
      -1,
      1,
      -p.PI,
      p.PI
    ) / ( sceneRot.microDivisorY ?? 12 ) );
  }

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

  const chanceThreshold = cellCfg.chanceThreshold ?? 0.5;
  const crossSize = cellCfg.crossSize ?? cellSize - 1;
  const boxSize = cellCfg.boxSize ?? cellSize - 1;
  const boxDepth = cellCfg.boxDepth ?? 10000;

  const useNormalMaterial = color.useNormalMaterial ?? true;
  const palette = color.palette ?? "rainbow";
  const colorFunction = colors?.[ palette ] ?? colors.rainbow;
  const hueOffsetSpeed = color.hueOffsetSpeed ?? 5;

  // Each cell can mask a different letter, so precompute one alpha field per
  // distinct letter of the word (each cached + spatial-hash accelerated) and
  // look up the cell's alpha by index. Identical to the previous per-cell
  // reduction, without recomputing distances every frame.
  const uniqueLetters = Array.from( new Set( word ) );
  const fieldByLetter = new Map();

  for ( const letter of uniqueLetters ) {
    const letterPoints = string.getTextPoints( {
      text: letter,
      position: p.createVector(
        0,
        0
      ),
      size,
      font,
      sampleFactor,
      simplifyThreshold
    } );

    fieldByLetter.set(
      letter,
      await gridMask.field( {
        gridOptions,
        points: letterPoints,
        signature: string.textPointsSignature( {
          text: letter,
          font,
          size,
          sampleFactor,
          simplifyThreshold
        } ),
        distance: cellSize,
        space: "pixel",
        output: "falloff",
        alphaRange: [
          0,
          255
        ]
      } )
    );
  }

  const cells = fieldByLetter.get( uniqueLetters[ 0 ] ).cells;

  cells.forEach( (
    cell, cellIndex
  ) => {
    const cellVector = cell.position;
    const {
      x, y
    } = cell;

    const xx = p.sin( animation.angle );
    const yy = p.cos( animation.angle );
    const switchingIndex = xx * ( x / columns ) + yy * ( y / rows ) + animation.angle;
    const currentLetter = mappers.circularIndex(
      switchingIndex,
      word
    );

    const alpha = fieldByLetter.get( currentLetter ).alpha[ cellIndex ];

    if ( !alpha ) {
      return;
    }

    const chance = p.noise( xx * ( x / columns ) + animation.angle / 3 + yy * ( y / rows ) + animation.angle );

    if ( useNormalMaterial ) {
      p.normalMaterial();
    } else {
      const tint = colorFunction( {
        hueOffset: animation.angle * hueOffsetSpeed,
        hueIndex: cellVector.x + cellVector.y
      } );

      p.stroke( tint );
    }

    if ( chance > chanceThreshold ) {
      drawCross(
        p,
        cellVector,
        crossSize
      );
    } else {
      p.push();
      p.translate(
        cellVector.x,
        cellVector.y,
        -boxDepth / 2
      );
      p.box(
        boxSize,
        boxSize,
        -boxDepth
      );
      p.pop();
    }
  } );

  renderTitle();
} );
