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
  const noiseCfg = options.sketch?.noise ?? {};
  const sceneRot = options.sketch?.sceneRotation ?? {};
  const wobble = options.sketch?.wobble ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "#test!";
  const fontName = shape.font ?? "serif";
  const font = string.fonts?.[ fontName ] ?? string.fonts.serif;
  const size = ( shape.size ?? 1.11 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.5;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;
  const letterSpeed = options.sketch?.letters?.speed ?? 1;

  if ( word.length === 0 || !font?.font ) {
    return;
  }

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 30;
  const rows = proportional ? Math.round( columns * p.height / p.width ) : gridOpts.rows ?? 50;
  const cellSize = p.width / columns;
  const maskDistance = cellSize * ( options.sketch?.mask?.distance ?? 1 );

  if ( sceneRot.enabled ?? true ) {
    // animation.angle sweeps exactly TAU per loop, so the rotation rate must
    // complete a WHOLE number of turns per loop to land back on its start
    // pose — snapped to whole turns per loop.
    const sceneRotTurns = Math.round( sceneRot.speed ?? 1.5 );

    p.rotateY( mappers.fn(
      p.sin( animation.angle * sceneRotTurns ),
      -1,
      1,
      -( sceneRot.amount ?? p.PI / 6 ),
      sceneRot.amount ?? p.PI / 6,
      easing.easeInOutCubic
    ) );
  }

  // The letter walk only returns to its start letter after a whole number of
  // word cycles per loop — snapped to whole cycles per loop.
  const letterCycles = Math.round( letterSpeed );
  const phase = animation.progression * word.length * letterCycles;
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
  const sphereSize = cellCfg.sphereSize ?? cellSize - 1;
  const crossSize = cellCfg.crossSize ?? cellSize;
  const crossColor = cellCfg.crossColor ?? [
    32,
    32,
    255
  ];

  const noiseGateEnabled = noiseCfg.gateEnabled ?? true;
  const noiseSpeedW = noiseCfg.speedW ?? 2;
  const noiseSpeedH = noiseCfg.speedH ?? -1;
  const noiseThresholdW = noiseCfg.thresholdW ?? 0.2;
  const noiseThresholdH = noiseCfg.thresholdH ?? 0.25;

  const wobbleAmplitude = wobble.amplitude ?? 100;
  // The wobble oscillation and the hue scroll both key off animation.angle
  // (whole TAU per loop), so their rates must be whole turns/loop too.
  const wobbleSpeed = Math.round( wobble.speed ?? 5 );
  const wobbleRowMultiplier = wobble.rowMultiplier ?? 4;

  const palette = color.palette ?? "rainbow";
  const colorFunction = colors?.[ palette ] ?? colors.rainbow;
  const hueOffsetSpeed = Math.round( color.hueOffsetSpeed ?? 1 );

  const field = await gridMask.field( {
    gridOptions,
    points,
    signature: string.textPointsSignature( {
      text: currentLetter,
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
  } );

  field.cells.forEach( (
    cell, cellIndex
  ) => {
    const cellVector = cell.position;
    const {
      x, y
    } = cell;
    const alpha = field.alpha[ cellIndex ];

    const ww = p.noise( x / columns + animation.angle * noiseSpeedW ) > noiseThresholdW;
    const hh = p.noise( y / rows + animation.angle * noiseSpeedH ) > noiseThresholdH;
    const extraLines = ww && hh;

    if ( noiseGateEnabled && !alpha && extraLines ) {
      return;
    }

    const xSign = p.sin( animation.angle );
    const ySign = p.cos( animation.angle );
    const chance = p.noise( xSign * ( x / columns ) + ySign * ( y / rows ) + animation.angle );

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
      p.stroke( ...crossColor );
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
        wobbleAmplitude * p.sin( animation.angle * wobbleSpeed + ( y / rows ) * wobbleRowMultiplier )
      );
      p.sphere( sphereSize );
      p.pop();
    }
  } );

  renderTitle();
} );
