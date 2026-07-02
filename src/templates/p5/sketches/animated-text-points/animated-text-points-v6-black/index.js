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
  p.ambientLight( 0 );

  const shape = options.sketch?.shape ?? {};
  const gridOpts = options.sketch?.grid ?? {};
  const cellCfg = options.sketch?.cell ?? {};
  const sceneRot = options.sketch?.sceneRotation ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "#sans";
  const size = ( shape.size ?? 1.11 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.5;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;

  if ( word.length === 0 ) {
    return;
  }

  const fonts = [
    string.fonts?.[ shape.fontA ?? "sans" ],
    string.fonts?.[ shape.fontB ?? "serif" ]
  ].filter( ( font ) => font?.font );

  if ( fonts.length === 0 ) {
    return;
  }

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 30;
  const rows = proportional ? Math.round( columns * p.height / p.width ) : gridOpts.rows ?? 50;
  const cellSize = p.width / columns;
  const maskDistance = cellSize * ( options.sketch?.mask?.distance ?? 1 );
  const letterSpeed = options.sketch?.letters?.speed ?? 1;
  const spatialFactor = options.sketch?.letters?.spatialFactor ?? 0;

  if ( sceneRot.enabled ?? true ) {
    // animation.angle sweeps exactly TAU per loop, so every rotation rate
    // below must complete a WHOLE number of turns per loop to land back on
    // its start pose — snapped to whole turns per loop.
    const sceneRotTurns = Math.round( sceneRot.speed ?? 1 );
    const microSpeedXTurns = Math.round( sceneRot.microSpeedX ?? 1 );
    const microSpeedYTurns = Math.round( sceneRot.microSpeedY ?? 2 );

    p.rotateY( mappers.fn(
      p.sin( animation.angle * sceneRotTurns ),
      -1,
      1,
      -( sceneRot.amount ?? p.PI / 6 ),
      sceneRot.amount ?? p.PI / 6,
      easing.easeInOutCubic
    ) );

    p.rotateX( p.map(
      p.sin( animation.angle * microSpeedXTurns ),
      -1,
      1,
      -p.PI,
      p.PI
    ) / ( sceneRot.microDivisorX ?? 12 ) );
    p.rotateY( p.map(
      p.cos( animation.angle * microSpeedYTurns ),
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

  const boxWidth = cellCfg.boxSize ?? cellSize - 2;
  const boxDepth = cellCfg.boxDepth ?? 1000;
  const showFrontCircle = cellCfg.showFrontCircle ?? true;
  const frontCircleChance = cellCfg.frontCircleChance ?? 0.5;
  const frontCircleSize = cellCfg.frontCircleSize ?? cellSize / 2;

  const palette = color.palette ?? "rainbow";
  const colorFunction = colors?.[ palette ] ?? colors.rainbow;
  // Whole turns per loop so the hue scroll lands back on its start hue.
  const hueOffsetSpeed = Math.round( color.hueOffsetSpeed ?? 2 );
  const hueIndexMultiplier = color.hueIndexMultiplier ?? 16;

  // Each cell can mask a different (letter, font) pair, so precompute one alpha
  // field per distinct letter x font combination (each cached + spatial-hash
  // accelerated) and look up the cell's alpha by index. Identical to the
  // previous per-cell reduction, without recomputing distances every frame.
  const uniqueLetters = Array.from( new Set( word ) );
  const fieldByKey = new Map();
  const maskKey = (
    letter, fontIndex
  ) => letter + "@" + fontIndex;

  for ( let fontIndex = 0; fontIndex < fonts.length; fontIndex++ ) {
    const currentFont = fonts[ fontIndex ];

    for ( const letter of uniqueLetters ) {
      const letterPoints = string.getTextPoints( {
        text: letter,
        position: p.createVector(
          0,
          0
        ),
        size,
        font: currentFont,
        sampleFactor,
        simplifyThreshold
      } );

      fieldByKey.set(
        maskKey(
          letter,
          fontIndex
        ),
        await gridMask.field( {
          gridOptions,
          points: letterPoints,
          signature: string.textPointsSignature( {
            text: letter,
            font: currentFont,
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
  }

  const cells = fieldByKey.get( maskKey(
    uniqueLetters[ 0 ],
    0
  ) ).cells;

  // switchingIndex below walks BOTH the word (length word.length) and the
  // font list (length fonts.length) circularly off the same clock, so it
  // only returns to its start letter AND start font after a whole number of
  // cycles of their least common multiple — snapped to whole cycles of
  // lcm( word.length, fonts.length ) per loop.
  const gcd = (
    a, b
  ) => ( b ? gcd(
    b,
    a % b
  ) : a );
  const lcmLength = ( word.length * fonts.length ) / gcd(
    word.length,
    fonts.length
  );
  const switchingCycles = Math.round( ( word.length * letterSpeed ) / lcmLength );
  const switchingSpan = switchingCycles * lcmLength;

  cells.forEach( (
    cell, cellIndex
  ) => {
    const cellVector = cell.position;
    const {
      x, y
    } = cell;

    const xx = p.sin( animation.angle );
    const yy = p.cos( animation.angle );
    const spatialTerm = xx * ( x / columns ) + yy * ( y / rows );
    const switchingIndex =
      animation.progression * switchingSpan + spatialFactor * spatialTerm;
    const currentLetter = mappers.circularIndex(
      switchingIndex,
      word
    );
    const currentFont = mappers.circularIndex(
      switchingIndex,
      fonts
    );
    const fontIndex = fonts.indexOf( currentFont );

    const alpha = fieldByKey.get( maskKey(
      currentLetter,
      fontIndex
    ) ).alpha[ cellIndex ];

    if ( !alpha ) {
      return;
    }

    const chance = p.noise( xx * ( x / columns ) + animation.angle / 3 + yy * ( y / rows ) + animation.angle );

    const tint = colorFunction( {
      hueOffset: animation.angle * hueOffsetSpeed,
      hueIndex: ( x / columns + y / rows ) * hueIndexMultiplier
    } );

    p.stroke( tint );
    p.noFill();

    p.push();
    p.translate(
      cellVector.x,
      cellVector.y,
      -boxDepth / 2
    );
    p.box(
      boxWidth,
      boxWidth,
      boxDepth
    );

    if ( showFrontCircle && chance > frontCircleChance ) {
      p.translate(
        0,
        0,
        boxDepth / 2
      );
      p.circle(
        0,
        0,
        frontCircleSize
      );
    }
    p.pop();
  } );

  renderTitle();
} );
