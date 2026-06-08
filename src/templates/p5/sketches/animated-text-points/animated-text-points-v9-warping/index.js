import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";
import gridMask from "@/p5/utils/gridMask.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

sketch.draw( async() => {
  const p = getP5();

  p.clear();
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
  const maskDistance = cellSize * ( options.sketch?.mask?.distance ?? 1 );
  const letterSpeed = options.sketch?.letters?.speed ?? 1;
  const spatialFactor = options.sketch?.letters?.spatialFactor ?? 0;

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
        distance: maskDistance,
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

    const xSign = p.sin( animation.angle );
    const ySign = p.cos( animation.angle );
    const spatialTerm = xSign * ( x / columns ) + ySign * ( y / rows );
    const switchingIndex =
      animation.progression * word.length * letterSpeed + spatialFactor * spatialTerm;
    const currentLetter = mappers.circularIndex(
      switchingIndex,
      word
    );

    const alpha = fieldByLetter.get( currentLetter ).alpha[ cellIndex ];

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
  } );

  renderTitle();
} );
