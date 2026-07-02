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
  const noiseCfg = options.sketch?.noise ?? {};
  const sceneRot = options.sketch?.sceneRotation ?? {};
  const color = options.sketch?.color ?? {};

  const word = shape.text ?? "#*test-abc-123!";
  const fontName = shape.font ?? "serif";
  const font = string.fonts?.[ fontName ] ?? string.fonts.serif;
  const size = ( shape.size ?? 1.11 ) * p.width;
  const sampleFactor = shape.sampleFactor ?? 0.5;
  const simplifyThreshold = shape.simplifyThreshold ?? 0;
  const letterSpeed = options.sketch?.letters?.speed ?? 1;

  if ( word.length === 0 || !font?.font ) {
    return;
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

  const proportional = gridOpts.proportional ?? true;
  const columns = gridOpts.columns ?? 30;
  const rows = proportional ? Math.round( columns * p.height / p.width ) : gridOpts.rows ?? 50;
  const cellSize = p.width / columns;
  const maskDistance = cellSize * ( options.sketch?.mask?.distance ?? 1 );

  // Per-cell rotation precomputed once per frame (uniform across cells but applied before translate, creating a wobble)
  const cellRotEnabled = sceneRot.enabled ?? true;
  const cellRotAmount = sceneRot.amount ?? p.PI / 12;
  // animation.angle sweeps exactly TAU per loop, so the rotation rate must
  // complete a WHOLE number of turns per loop to land back on its start pose
  // — snapped to whole turns per loop.
  const cellRotSpeed = Math.round( sceneRot.speed ?? 1.5 );
  const cellRotY = cellRotEnabled
    ? mappers.fn(
      p.sin( animation.angle * cellRotSpeed ),
      -1,
      1,
      -cellRotAmount,
      cellRotAmount,
      easing.easeInOutExpo
    )
    : 0;
  const cellRotX = cellRotEnabled
    ? mappers.fn(
      p.cos( animation.angle * cellRotSpeed ),
      -1,
      1,
      -cellRotAmount,
      cellRotAmount,
      easing.easeInOutQuart
    )
    : 0;

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

  const noiseGateEnabled = noiseCfg.gateEnabled ?? true;
  const noiseThresholdW = noiseCfg.thresholdW ?? 0.15;
  const noiseThresholdH = noiseCfg.thresholdH ?? 0.15;
  const chanceThreshold = cellCfg.chanceThreshold ?? 0.5;

  const circleSize = cellCfg.circleSize ?? 20;
  const boxWidth = cellCfg.boxSize ?? 15;
  const boxDepth = cellCfg.boxDepth ?? 75;

  const palette = color.palette ?? "rainbow";
  const colorFunction = colors?.[ palette ] ?? colors.rainbow;
  // Whole turns per loop so the hue scroll lands back on its start hue.
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

    const t = animation.angle;
    const ww = p.noise( cellVector.x + t ) > noiseThresholdW;
    const hh = p.noise( cellVector.y + t ) > noiseThresholdH;
    const extraLines = ww && hh;

    if ( noiseGateEnabled && !alpha && extraLines ) {
      return;
    }

    const chance = p.noise( x / columns + y / rows + t );

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
        0
      );
      p.circle(
        0,
        0,
        circleSize
      );
      p.pop();
    } else {
      p.push();
      p.rotateY( cellRotY );
      p.rotateX( cellRotX );
      p.translate(
        cellVector.x,
        cellVector.y,
        boxDepth / 2
      );
      p.box(
        boxWidth,
        boxWidth,
        boxDepth
      );
      p.pop();
    }
  } );

  renderTitle();
} );
