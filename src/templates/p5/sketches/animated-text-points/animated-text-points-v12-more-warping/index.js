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

  const word = shape.text ?? "Turbulence ";
  const fontName = shape.font ?? "serif";
  const font = string.fonts?.[ fontName ] ?? string.fonts.serif;
  const letterSize = shape.letterSize ?? 900;
  const sampleFactor = shape.sampleFactor ?? 1;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;

  if ( word.length === 0 || !font?.font ) {
    return;
  }

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 40;
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

  const screenRatio = cellCfg.screenRatio ?? 1.5;
  const boxWidth = cellCfg.boxSize ?? cellSize;
  const boxDepth = cellCfg.boxDepth ?? 150;

  const warpAmount = warp.amount ?? 1 / 6;
  const warpInnerAmount = warp.innerAmount ?? 1 / 6;
  const warpRowDivisorA = warp.rowDivisorA ?? 10;
  const warpColDivisorA = warp.colDivisorA ?? 20;
  const warpRowDivisorB = warp.rowDivisorB ?? 20;
  const warpColDivisorB = warp.colDivisorB ?? 15;
  // animation.angle sweeps exactly TAU per loop, so the warp rate must
  // complete a WHOLE number of turns per loop to land back on its start pose
  // — snapped to whole turns per loop.
  const warpSpeed = Math.round( warp.speed ?? 1 );

  // The per-cell letter switch walks the word circularly, so it only returns
  // to its start letter after a whole number of word cycles per loop —
  // snapped to whole cycles per loop.
  const letterCycles = Math.round( letterSpeed );

  const useNormalMaterial = color.useNormalMaterial ?? true;
  const palette = color.palette ?? "rainbow";
  const colorFunction = colors?.[ palette ] ?? colors.rainbow;
  const hueIndexMultiplier = color.hueIndexMultiplier ?? 4;
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
      size: letterSize,
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
          size: letterSize,
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
      animation.progression * word.length * letterCycles + spatialFactor * spatialTerm;
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
      hueOffset: 0,
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

    if ( useNormalMaterial ) {
      p.normalMaterial();
    }
    p.stroke( tint );

    p.push();

    p.rotateX( p.map(
      p.sin( animation.angle * warpSpeed - y / warpRowDivisorA ),
      -1,
      1,
      -p.PI,
      p.PI
    ) * warpAmount );
    p.rotateY( p.map(
      p.cos( animation.angle * warpSpeed + x / warpColDivisorA ),
      -1,
      1,
      -p.PI,
      p.PI
    ) * warpAmount );

    p.rotateX( mappers.fn(
      p.cos( animation.angle * warpSpeed - y / warpRowDivisorB ),
      -1,
      1,
      -p.PI,
      p.PI,
      easing.easeInOutQuart
    ) * warpInnerAmount );
    p.rotateY( mappers.fn(
      p.sin( animation.angle * warpSpeed + x / warpColDivisorB ),
      -1,
      1,
      -p.PI,
      p.PI,
      easing.easeInOutExpo
    ) * warpInnerAmount );

    p.translate(
      cellVector.x,
      cellVector.y * screenRatio,
      -boxDepth / 2
    );
    p.box(
      boxWidth,
      boxWidth * screenRatio,
      -boxDepth
    );
    p.pop();
  } );

  renderTitle();
} );
