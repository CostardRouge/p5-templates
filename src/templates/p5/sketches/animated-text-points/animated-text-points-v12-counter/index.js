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
import iterators from "@/p5/utils/iterators.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

const drawBackgroundPattern = (
  p, columns, time, weight, strokeColor
) => {
  p.push();
  p.noFill();
  p.stroke( ...strokeColor );
  p.strokeWeight( weight );
  p.translate(
    -p.width,
    -p.height / 2,
    -200
  );

  const columnSize = p.width / columns;
  const halfColumnSize = columnSize / 2;
  const columnPadding = weight + halfColumnSize;
  const precision = 0.04;

  for ( let i = 0; i < columns; i++ ) {
    const x = i * columnSize + halfColumnSize;
    const top = p.createVector(
      x,
      -200
    );
    const bottom = p.createVector(
      x,
      p.height + 200
    );

    p.beginShape();
    iterators.vector(
      top,
      bottom,
      precision,
      (
        position, lerpIndex
      ) => {
        const driftBound = ( halfColumnSize + columnPadding ) * p.sin( time + i );
        const driftX = p.map(
          easing.easeInOutBack( lerpIndex % 1 ),
          0,
          1,
          -driftBound,
          driftBound
        );

        p.vertex(
          position.x + driftX,
          position.y
        );
      }
    );
    p.endShape();
  }

  p.pop();
};

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
  const bgPattern = options.sketch?.bgPattern ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "0123456789 ";
  const fontName = shape.font ?? "sans";
  const font = string.fonts?.[ fontName ] ?? string.fonts.sans;
  const sampleFactor = shape.sampleFactor ?? 1;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;
  const letterSize = shape.letterSize ?? 1000;

  // if ( word.length === 0 || !font?.font ) {
  //   return;
  // }

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 30;
  const rows = proportional ? Math.round( columns * p.height / p.width ) : gridOpts.rows ?? 50;
  const cellSize = p.width / columns;
  const maskDistance = cellSize * ( options.sketch?.mask?.distance ?? 1 );

  // Background drifting column pattern
  if ( bgPattern.enabled ?? true ) {
    const counterValues = bgPattern.counterValues ?? [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      0
    ];
    const n = Math.max(
      1,
      ~~animation.ease( {
        values: counterValues,
        currentTime: animation.angle,
        duration: 1,
        easingFn: easing[ bgPattern.easing ] ?? easing.easeInOutExpo
      } )
    );

    drawBackgroundPattern(
      p,
      n,
      animation.angle,
      bgPattern.weight ?? 3,
      bgPattern.color ?? [
        255,
        255,
        255
      ]
    );
  }

  // return;

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

  const palette = color.palette ?? "rainbow";
  const colorFunction = colors?.[ palette ] ?? colors.rainbow;
  const hueIndexMultiplier = color.hueIndexMultiplier ?? 4;
  const opacityMax = color.opacityMax ?? 2.1;
  const opacityMin = color.opacityMin ?? 1;
  const fillAlpha = color.fillAlpha ?? 230;
  const microRotAmount = cellCfg.microRotAmount ?? 1 / 6;
  const ringRotMultiplier = cellCfg.ringRotMultiplier ?? 2;

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

  const cells = uniqueLetters.length
    ? fieldByLetter.get( uniqueLetters[ 0 ] ).cells
    : [];

  cells.forEach( (
    cell, cellIndex
  ) => {
    const cellVector = cell.position;
    const {
      x, y
    } = cell;

    const commonSwitchingIndex = x / columns - y / rows;
    const currentLetter = mappers.circularIndex(
      commonSwitchingIndex + animation.angle,
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
    const {
      levels: [
        r,
        g,
        b
      ]
    } = tint;

    p.stroke( tint );
    p.fill(
      r,
      g,
      b,
      fillAlpha
    );

    const angleY = animation.ease( {
      values: [
        -p.PI,
        p.PI
      ],
      currentTime: animation.angle - y / rows,
      duration: 1,
      easingFn: easing.easeInOutElastic
    } );

    p.push();
    p.rotateX( p.map(
      p.sin( animation.angle - y / 10 ),
      -1,
      1,
      -p.PI,
      p.PI
    ) * microRotAmount );
    p.rotateY( p.map(
      p.cos( animation.angle + x / 20 ),
      -1,
      1,
      -p.PI,
      p.PI
    ) * microRotAmount );
    p.rotateY( angleY * ringRotMultiplier );
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
