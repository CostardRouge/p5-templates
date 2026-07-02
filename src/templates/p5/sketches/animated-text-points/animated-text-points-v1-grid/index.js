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

  // Loop-exact letter walk: mappers.circularIndex only returns to the start
  // letter when the phase advances a whole number of word-length cycles per
  // loop — snapped to whole cycles per loop.
  const morphCycles = Math.round( morphSpeed / word.length );
  const phase = animation.progression * morphCycles * word.length;
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

  // animation.angle sweeps exactly TAU per loop, so the hue scroll rate must
  // complete a WHOLE number of turns per loop to land back on its start hue
  // — snapped to whole turns per loop.
  const hueOffsetTurns = Math.round( color.hueOffsetSpeed ?? 0 );

  p.noStroke();

  // Per-cell alpha field computed once (spatial-hash accelerated) and cached
  // per letter via the shared gridMask utility. Pixel-space falloff, identical
  // to the previous inline reduction.
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
    distance: distanceThreshold,
    space: "pixel",
    output: "falloff",
    alphaRange: [
      0,
      255
    ]
  } );

  for ( const index of field.nonZero ) {
    const cellVector = field.cells[ index ].position;
    const alpha = field.alpha[ index ];

    const tint = colorFunction( {
      hueOffset: animation.angle * hueOffsetTurns,
      hueIndex: mappers.fn(
        cellVector.x / columns + cellVector.y / rows,
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

  renderTitle();
} );
