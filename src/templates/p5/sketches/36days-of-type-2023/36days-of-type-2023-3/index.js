import options from "@/p5/utils/options.js";
import sketch, {
  getP5
} from "@/p5/utils/sketch.js";

import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import grid from "@/p5/utils/grid.js";
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

function getAlphaFromMask( {
  position,
  maskPoints,
  distance
} ) {
  const p = getP5();
  const {
    x, y
  } = position;

  const normalizedPosition = p.createVector(
    p.map(
      x,
      -p.width / 2,
      p.width / 2,
      0,
      1
    ),
    p.map(
      y,
      -p.height / 2,
      p.height / 2,
      0,
      1
    )
  );

  return maskPoints.reduce(
    (
      result, pointPosition
    ) => {
      if ( 255 <= result ) {
        return result;
      }

      const normalizedPointPosition = p.createVector(
        p.map(
          pointPosition.x,
          -p.width / 2,
          p.width / 2,
          0,
          1
        ),
        p.map(
          pointPosition.y,
          -p.height / 2,
          p.height / 2,
          0,
          1
        )
      );

      const d = normalizedPointPosition.dist( normalizedPosition );
      const mapped = ~~p.map(
        d,
        0,
        distance,
        255,
        0,
        true
      );

      return Math.max(
        result,
        mapped
      );
    },
    0
  );
}

function createGridAlphaPoints(
  gridOptions, maskPoints, cacheKey, distance
) {
  return cache.store(
    `alpha-points+${ cacheKey }`,
    () => {
      const alphaPoints = [];

      grid.draw(
        gridOptions,
        ( position ) => {
          const alpha = getAlphaFromMask( {
            position,
            maskPoints,
            distance
          } );

          if ( alpha ) {
            alphaPoints.push( {
              position,
              alpha
            } );
          }
        }
      );

      return alphaPoints;
    }
  );
}

sketch.draw( () => {
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

  const alphaPoints = createGridAlphaPoints(
    gridOptions,
    letterPoints,
    cacheKey,
    distance
  );

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

  const depth = options.sketch?.shape?.depth ?? 100;
  const rotateAngle = options.sketch?.animation?.rotateAngle ?? p.PI / 12;
  const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 3;
  const opacityFactor = options.sketch?.color?.opacityFactor ?? 1.5;
  const fillAlpha = options.sketch?.color?.fillAlpha ?? 225;
  const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 100;

  const t = animation.angle;

  pairedPoints.forEach( (
    {
      start, end
    }, index
  ) => {
    const position = animation.ease( {
      values: [
        start.position,
        start.position,
        start.position,
        end.position,
        end.position,
        end.position
      ],
      currentTime:
        animation.progression * pairedPoints.length / 5 +
        index / pairedPoints.length / 5,
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

    p.box(
      cellSize - 2,
      cellSize - 2,
      depth
    );

    p.pop();
  } );
} );
