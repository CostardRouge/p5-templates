import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import gridMask from "@/p5/utils/gridMask.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

sketch.setup(
  undefined,
  {
    type: "webgl"
  }
);

const getBackgroundColor = () =>
  options.sketch?.backgroundColor ?? [
    0,
    0,
    0
  ];

// Single-layer falloff mask delegated to the shared gridMask utility, which
// computes the per-cell alpha field once (spatial-hash accelerated) and caches
// it. Behaviour is identical to the previous inline reduction.
async function createGridAlphaPoints(
  gridOptions, maskPoints, cacheKey, distance
) {
  const field = await gridMask.field( {
    gridOptions,
    points: maskPoints,
    signature: cacheKey,
    distance,
    space: "normalized",
    output: "falloff",
    alphaRange: [
      0,
      255
    ]
  } );

  return field.nonZero.map( ( index ) => ( {
    position: field.cells[ index ].position,
    alpha: field.alpha[ index ]
  } ) );
}

function dice(
  size, render
) {
  const p = getP5();
  const rotations = [
    p.createVector(),
    p.createVector(
      0,
      p.HALF_PI
    ),
    p.createVector( p.HALF_PI ),
    p.createVector(
      0,
      -p.HALF_PI
    ),
    p.createVector(
      0,
      p.PI
    ),
    p.createVector( -p.HALF_PI )
  ];

  for ( let i = 0; i < rotations.length; i++ ) {
    const {
      x: rX,
      y: rY
    } = rotations[ i ];

    p.push();
    p.rotateX( rX );
    p.rotateY( rY );
    p.translate(
      0,
      0,
      size / 2
    );

    render(
      i,
      size
    );

    p.pop();
  }
}

function renderFace( {
  diceIndex,
  rotationIndex,
  alphaPoints,
  cellSize,
  columns,
  rows,
  hueMultiplier,
  fillAlpha
} ) {
  const p = getP5();

  alphaPoints.forEach( ( {
    position
  } ) => {
    const hue = p.noise(
      position.x / columns +
        p.map(
          Math.sin( animation.angle ),
          -1,
          1,
          0,
          1
        ) * 3,
      position.y / rows +
        p.map(
          Math.cos( animation.angle ),
          -1,
          1,
          0,
          1
        ) * 3
    );

    const tint = colors.rainbow( {
      hueOffset: diceIndex,
      hueIndex: p.map(
        hue,
        0,
        1,
        -p.PI,
        p.PI
      ) * hueMultiplier,
      opacityFactor: p.map(
        diceIndex - rotationIndex,
        0,
        1,
        1.5,
        150,
        true
      )
    } );

    const {
      levels: [
        red,
        green,
        blue
      ]
    } = tint;

    p.push();
    p.translate(
      position.x,
      position.y
    );
    p.fill(
      red,
      green,
      blue,
      fillAlpha
    );
    p.stroke(
      red,
      green,
      blue,
      0
    );
    p.box(
      cellSize,
      cellSize,
      -cellSize * 4
    );
    p.pop();
  } );
}

sketch.draw( async() => {
  const p = getP5();

  p.background( ...getBackgroundColor() );

  const fontName = options.sketch?.shape?.font ?? "martian";
  const font = string.fonts?.[ fontName ];
  const text = options.sketch?.shape?.text ?? "6";
  const size = ( options.sketch?.shape?.size ?? 1 ) * p.width;
  const sampleFactor = options.sketch?.shape?.sampleFactor ?? 0.1;
  const simplifyThreshold = options.sketch?.shape?.simplifyThreshold ?? 0;
  const columns = options.sketch?.shape?.columns ?? 50;
  const rows = ( columns * p.height ) / p.width;
  const cellSize = p.width / columns;
  const distance = options.sketch?.mask?.distance ?? 0.025;
  const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 1;
  const fillAlpha = options.sketch?.color?.fillAlpha ?? 230;

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
    columns,
    centered: true
  };

  const letterPoints = string.getTextPoints( {
    text,
    position: p.createVector(
      0,
      0
    ),
    size,
    font,
    sampleFactor,
    simplifyThreshold
  } );

  if ( !letterPoints || letterPoints.length === 0 ) {
    return;
  }

  const cacheKey = [
    text,
    fontName,
    cellSize,
    size,
    sampleFactor,
    simplifyThreshold,
    distance
  ].join( "+" );

  const alphaPoints = await createGridAlphaPoints(
    gridOptions,
    letterPoints,
    cacheKey,
    distance
  );

  p.translate(
    0,
    0,
    -p.width / 2
  );

  const orientationTime = animation.progression * 6;

  const orientation = animation.ease( {
    values: [
      p.createVector(),
      p.createVector(
        0,
        -p.HALF_PI
      ),
      p.createVector( -p.HALF_PI ),
      p.createVector(
        0,
        p.HALF_PI
      ),
      p.createVector(
        0,
        p.PI
      ),
      p.createVector( p.HALF_PI )
    ],
    currentTime: orientationTime,
    duration: 1,
    lerpFn: mappers.lerpVector,
    easingFn: easing.easeInOutCirc
  } );

  p.rotateX( orientation.x );
  p.rotateY( orientation.y );

  const rotationIndex = animation.ease( {
    values: [
      0,
      1,
      2,
      3,
      4,
      5
    ],
    currentTime: orientationTime,
    duration: 1,
    easingFn: easing.easeInOutCirc
  } );

  dice(
    p.width,
    ( diceIndex ) => {
      renderFace( {
        diceIndex,
        rotationIndex,
        alphaPoints,
        cellSize,
        columns,
        rows,
        hueMultiplier,
        fillAlpha
      } );
    }
  );
} );
