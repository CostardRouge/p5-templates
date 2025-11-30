import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import grid from "@/p5/utils/grid.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

sketch.setup(
  () => {
    background(...getBackgroundColor());
  },
  {
    type: "webgl"
  }
);

function getAlphaFromMask({
  position: {
    x, y
  }, maskPoints, distance = options.sketch?.mask?.distance ?? 0.015
}) {
  const normalizedPosition = createVector(
    map(
      x,
      -width / 2,
      width / 2,
      0,
      1
    ),
    map(
      y,
      -height / 2,
      height / 2,
      0,
      1
    )
  );

  return maskPoints.reduce(
    (
      result, pointPosition
    ) => {
      if (true === result) {
        return result;
      }

      const normalizedPointPosition = createVector(
        map(
          pointPosition.x,
          -width / 2,
          width / 2,
          0,
          1
        ),
        map(
          pointPosition.y,
          -height / 2,
          height / 2,
          0,
          1
        )
      );

      const d = normalizedPointPosition.dist(normalizedPosition);

      return Math.max(
        result,
        d > 0 && d < distance
      );
    },
    0
  );
}

function createGridAlphaPoints(
  gridOptions, textPointsMatrix, cacheKey
) {
  return cache.store(
    `alpha-points-matrix+${cacheKey}`,
    () => {
      const alphaPoints = [
      ];

      grid.draw(
        gridOptions,
        position => {
          const alphaLayers = [
          ];

          for (const points of textPointsMatrix) {
            const alpha = getAlphaFromMask({
              position,
              maskPoints: points
            });

            alphaLayers.push(alpha);
          }

          alphaPoints.push({
            position,
            layers: alphaLayers
          });
        }
      );

      return alphaPoints;
    }
  );
}

const getBackgroundColor = () =>
(options.sketch?.backgroundColor ??
  [
    246,
    235,
    225
  ]);

sketch.draw((time) => {
  background(...getBackgroundColor());

  const size = (options.sketch?.shape?.size * width) ?? width;
  const sampleFactor = options.sketch?.shape?.sampleFactor ?? 0.1;
  const simplifyThreshold = options.sketch?.shape?.simplifyThreshold ?? 0;

  const columns = options.sketch?.shape?.columns ?? 65;
  const rows = columns * height / width;
  const cellSize = width / columns;

  const gridOptions = {
    topLeft: createVector(
      -width / 2,
      -height / 2
    ),
    topRight: createVector(
      width / 2,
      -height / 2
    ),
    bottomLeft: createVector(
      -width / 2,
      height / 2
    ),
    bottomRight: createVector(
      width / 2,
      height / 2
    ),
    rows,
    columns,
    centered: true
  };

  const fonts = [
    string.fonts.martian,
    // string.fonts.multicoloure,
    // string.fonts.openSans,
    // string.fonts.sans,
    // string.fonts.serif
  ];

  const textToWrite = options.sketch?.shape?.text ?? "8";

  const textPointsMatrix = fonts.map(font => (
    string.getTextPoints({
      text: textToWrite,
      position: createVector(
        0,
        0
      ),
      size,
      font,
      sampleFactor,
      simplifyThreshold
    })
  ));

  if (textPointsMatrix.some(matrix => matrix.length === 0)) {
    return;
  }

  const cacheComponent = [
    textToWrite,
    cellSize,
    size,
    sampleFactor,
    simplifyThreshold,
    options.sketch?.mask?.distance
  ];
  const cacheKey = cacheComponent.join("+");

  const alphaPoints = createGridAlphaPoints(
    gridOptions,
    textPointsMatrix,
    cacheKey
  );

  if (options.sketch?.animation?.rotate ?? true) {
    const rotationMax = PI * (options.sketch?.animation?.rotationCount ?? 2);

    const {
      x: rX,
      y: rY,
      // z: rZ
    } = animation.ease({
      values: [
        createVector(),
        createVector(
          0,
          rotationMax
        ),
        createVector(
          rotationMax,
          rotationMax
        ),
        createVector(rotationMax),
      ],
      currentTime: animation.progression * 3,
      duration: 1,
      lerpFn: p5.Vector.lerp,
      easingFn: easing.easeInOutExpo,
      // easingFn: easing.easeInOutElastic,
      // easingFn: easing.easeInOutCirc,
    });

    rotateX(rX);
    rotateY(rY);
  }

  // const finalPoints = alphaPoints

  alphaPoints.forEach((
    {
      layers, position
    }, index
  ) => {
    const layer = mappers.circularIndex(
      animation.progression / 3,
      layers
    );
    // const layer = animation.ease({
    //   values: layers,
    //   currentTime: generalAnimationTime+1/2,
    //   duration: 1,
    //   easingFn: easing.easeInOutExpo
    // })

    if (!layer) {
      return;
    }

    const switchSpeed = options.sketch?.animation?.switchSpeed ?? 2;
    const switchIndexDivisor = options.sketch?.animation?.switchIndexDivisor ?? 5;
    const positionInfluence = options.sketch?.animation?.positionInfluence ?? 100;

    const switchIndex = animation.progression * switchSpeed + (
      +index / alphaPoints.length / switchIndexDivisor
      + position.x / columns / positionInfluence
      + position.y / rows / positionInfluence
    );

    const hue = noise(
      position.x / columns + (
        +map(
          sin(animation.angle),
          -1,
          1,
          0,
          1
        )
      ),
      position.y / rows + (
        +map(
          cos(animation.angle),
          -1,
          1,
          0,
          1
        )
      )
    );

    const hueMultiplier = options.sketch?.color?.hueMultiplier ?? 2;
    const opacityFactor = options.sketch?.color?.opacityFactor ?? 1.5;

    const tint = colors.rainbow({
      hueOffset: animation.circularProgression,
      hueIndex: map(
        hue,
        0,
        1,
        -PI,
        PI
      ) * hueMultiplier,
      opacityFactor
    });

    const {
      levels: [
        red,
        green,
        blue
      ]
    } = tint;

    push();

    const w = cellSize;// -2
    const h = cellSize;// -2
    const d = cellSize * (options.sketch?.shape?.depth ?? 20);

    translate(position);

    const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
    const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
    const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

    const fillAlpha = animation.ease({
      values: [
        fillAlphaStart,
        fillAlphaEnd
      ],
      currentTime: switchIndex,
      duration: 1,
      easingFn: easing.easeInOutExpo,
    });

    fill(
      red,
      green,
      blue,
      fillAlpha
    );
    stroke(
      red,
      green,
      blue,
      strokeAlpha
    );
    box(
      w,
      h,
      -d
    );

    pop();
  });
});
