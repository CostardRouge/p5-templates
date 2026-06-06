import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import cache from "@/p5/utils/cache.js";
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

// 6-step pattern: hold start 3 frames, transition, hold end 2 frames, return.
const SWAP_VALUES_COUNT = 6;

sketch.draw( async() => {
  const p = getP5();

  p.background( ...getBackgroundColor() );

  const fontName = options.sketch?.shape?.font ?? "martian";
  const font = string.fonts?.[ fontName ];
  const text = options.sketch?.shape?.text ?? "3";
  const size = ( options.sketch?.shape?.size ?? 1 ) * p.width;
  const sampleFactor = options.sketch?.shape?.sampleFactor ?? 0.1;
  const simplifyThreshold = options.sketch?.shape?.simplifyThreshold ?? 0;
  const columns = options.sketch?.shape?.columns ?? 65;
  const rows = ( columns * p.height ) / p.width;
  const cellSize = p.width / columns;
  const distance = options.sketch?.mask?.distance ?? 0.025;
  const cameraPullback =
    options.sketch?.camera?.pullback ?? p.width / 2;

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

  if ( alphaPoints.length === 0 ) {
    return;
  }

  const pairedPoints = cache.store(
    `paired-points+${ cacheKey }`,
    () => {
      const shuffled = [
        ...alphaPoints
      ].sort( () => 0.5 - Math.random() );

      return shuffled.map( (
        start, i
      ) => ( {
        start,
        end: shuffled[ ( i + 1 ) % shuffled.length ]
      } ) );
    }
  );

  const depth = options.sketch?.shape?.depth ?? 60;
  const rotateAngle = options.sketch?.animation?.rotateAngle ?? p.PI / 12;
  const swapSpeed = options.sketch?.animation?.swapSpeed ?? 1;
  const stagger = options.sketch?.animation?.stagger ?? 0.5;
  const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 3;
  const opacityFactor = options.sketch?.color?.opacityFactor ?? 1.5;
  const fillAlpha = options.sketch?.color?.fillAlpha ?? 225;
  const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 100;

  p.translate(
    0,
    0,
    -cameraPullback
  );

  const t = animation.angle;
  const baseTime = animation.progression * SWAP_VALUES_COUNT * swapSpeed;

  pairedPoints.forEach( (
    {
      start, end
    }, index
  ) => {
    if ( !start?.position || !end?.position ) {
      return;
    }

    const perPointOffset = ( index / pairedPoints.length ) * stagger;
    const position = animation.ease( {
      values: [
        start.position,
        start.position,
        start.position,
        end.position,
        end.position,
        end.position
      ],
      currentTime: baseTime + perPointOffset,
      duration: 1,
      lerpFn: mappers.lerpVector,
      easingFn: easing.easeInOutBack
    } );

    const hue = p.noise(
      position.y / rows,
      position.x / columns
    );

    const tint = colors.rainbow( {
      hueIndex: p.map(
        hue,
        0,
        1,
        -p.PI,
        p.PI
      ) * hueMultiplier,
      opacityFactor
    } );

    const {
      levels: [
        red,
        green,
        blue
      ]
    } = tint;

    p.push();

    p.rotateX( p.map(
      Math.cos( 2 * t - position.y / rows ),
      -1,
      1,
      -rotateAngle,
      rotateAngle
    ) );

    p.translate(
      position.x,
      position.y,
      depth
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
      strokeAlpha
    );

    p.box(
      cellSize - 2,
      cellSize - 2,
      depth
    );

    p.pop();
  } );
} );
