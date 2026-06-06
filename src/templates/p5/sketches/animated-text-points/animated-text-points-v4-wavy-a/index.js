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
  const wobble = options.sketch?.wobble ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "2+2=??";
  const fontName = shape.font ?? "serif";
  const font = string.fonts?.[ fontName ] ?? string.fonts.serif;
  const size = ( shape.size ?? 1.11 ) * p.width;
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

  if ( sceneRot.enabled ?? true ) {
    p.rotateY( mappers.fn(
      p.sin( animation.angle * ( sceneRot.speed ?? 1 ) ),
      -1,
      1,
      -( sceneRot.amount ?? p.PI / 6 ),
      sceneRot.amount ?? p.PI / 6,
      easing.easeInOutExpo
    ) );
    p.rotateX( sceneRot.tiltX ?? p.PI / 6 );
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
  const circleSize = cellCfg.circleSize ?? 20;
  const sphereSize = cellCfg.sphereSize ?? cellSize - 1;
  const wobbleAmplitude = wobble.amplitude ?? 50;
  const wobbleCircleSpeed = wobble.circleSpeed ?? 1;
  const wobbleSphereSpeed = wobble.sphereSpeed ?? 5;
  const wobbleRowMultiplier = wobble.rowMultiplier ?? 10;

  const palette = color.palette ?? "rainbowCrazy";
  const colorFunction = colors?.[ palette ] ?? colors.rainbowCrazy;
  const hueOffsetSpeed = color.hueOffsetSpeed ?? 1;

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
    const chance = p.noise( xSign * ( x / columns ) + ySign * ( y / rows ) + animation.angle );

    const currentLetter = mappers.circularIndex(
      chance + animation.angle / 2,
      word
    );

    const alpha = fieldByLetter.get( currentLetter ).alpha[ cellIndex ];

    if ( !alpha ) {
      return;
    }

    const tint = colorFunction( {
      hueOffset: animation.angle * hueOffsetSpeed,
      hueIndex: cellVector.x + cellVector.y
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
      alpha
    );

    if ( chance > chanceThreshold ) {
      p.push();
      p.translate(
        cellVector.x,
        cellVector.y,
        wobbleAmplitude * p.sin( animation.angle * wobbleCircleSpeed + ( y / rows ) * wobbleRowMultiplier )
      );
      p.circle(
        0,
        0,
        circleSize
      );
      p.pop();
    } else {
      p.push();
      p.translate(
        cellVector.x,
        cellVector.y,
        wobbleAmplitude * p.sin( animation.angle * wobbleSphereSpeed + ( y / rows ) * wobbleRowMultiplier )
      );
      p.sphere( sphereSize );
      p.pop();
    }
  } );

  renderTitle();
} );
