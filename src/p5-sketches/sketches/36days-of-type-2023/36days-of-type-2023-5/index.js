import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

import cache from "@/p5/utils/cache.js";
import colors from "@/p5/utils/colors.js";
import easing from "@/p5/utils/easing.js";
import events from "@/p5/utils/events.js";
import grid from "@/p5/utils/grid.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import string from "@/p5/utils/string.js";

import addScreenPositionFunction from "@/public/assets/libraries/addScreenPositionFunction.js";

const sketchState = {
  interactive: {
    currentTimeValue: 0,
    position: null,
    image: null,
  },
  shape: {
    graphics: null,
  }
}

events.register(
  "engine-window-preload",
  () => {
    sketchState.interactive.image = loadImage("/assets/images/handpointing.png")
  }
);

sketch.setup(
  ({
    canvas
  }) => {
    sketchState.shape.graphics = createGraphics(width, height, "webgl");

    background(...getBackgroundColor());
    addScreenPositionFunction(sketchState.shape.graphics);
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

sketch.draw(() => {
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

  const textToWrite = options.sketch?.shape?.text ?? "5";

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

    const hue = sketchState.shape.graphics.noise(
      position.x / columns + (
        +sketchState.shape.graphics.map(
          Math.sin(animation.angle),
          -1,
          1,
          0,
          1
        )
      ),
      position.y / rows + (
        +sketchState.shape.graphics.map(
          Math.cos(animation.angle),
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
      hueIndex: sketchState.shape.graphics.map(
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

    sketchState.shape.graphics.push();

    const w = cellSize;// -2
    const h = cellSize;// -2
    const d = cellSize * (options.sketch?.shape?.depth ?? 20);

    sketchState.shape.graphics.translate(position);

    const fillAlphaStart = options.sketch?.color?.fillAlphaStart ?? 240;
    const fillAlphaEnd = options.sketch?.color?.fillAlphaEnd ?? 0;
    const strokeAlpha = options.sketch?.color?.strokeAlpha ?? 200;

    if (options.sketch.interactive.enabled && sketchState.interactive.position) {
      const screenPos = sketchState.shape.graphics.screenPosition(width / 2, height / 2, 0);
      const distance = sketchState.shape.graphics.dist(sketchState.interactive.position.x, sketchState.interactive.position.y, screenPos.x, screenPos.y);

      sketchState.interactive.currentTimeValue = map(
        distance,
        0,
        (options.sketch.interactive.sensitivityMultiplier * width) ?? width * 0.5,
        0,
        1
      ) / 6;
    }

    // Calculate wave propagation
    const normalizedX = map(position.x, -width / 2, width / 2, 0, 1);
    const normalizedY = map(position.y, -height / 2, height / 2, 0, 1);
    
    const waveConfig = options.sketch?.animation?.wave ?? { mode: "linear", directionX: -1, directionY: -1 };
    const waveSpeed = options.sketch?.animation?.waveSpeed ?? 1;
    const waveSpread = options.sketch?.animation?.waveSpread ?? 0.3;
    
    let waveOffset;
    
    if (waveConfig.mode === "radial") {
      // Radial wave from center or edges
      const distanceFromCenter = dist(normalizedX, normalizedY, 0.5, 0.5) / (Math.sqrt(2) / 2);
      const fromCenter = waveConfig.fromCenter ?? true;
      waveOffset = fromCenter ? distanceFromCenter : (1 - distanceFromCenter);
    } else {
      // Linear wave with controllable direction
      const directionX = waveConfig.directionX ?? -1;
      const directionY = waveConfig.directionY ?? -1;
      const xComponent = directionX * (normalizedX - 0.5);
      const yComponent = directionY * (normalizedY - 0.5);
      waveOffset = (xComponent + yComponent + 1) / 2; // Normalize to 0-1
    }
    
    const switchIndex = (animation.progression * waveSpeed + waveOffset * waveSpread) % 1;

    // const currentTimeValue = options.sketch.interactive.enabled ? sketchState.interactive.currentTimeValue : (
    //   switchIndex
    // );

    const fillAlpha = animation.ease({
      values: [
        fillAlphaStart,
        fillAlphaEnd
      ],
      currentTime: switchIndex,
      duration: 1,
      // easingFn: easing.easeInOutExpo,
    });

    sketchState.shape.graphics.fill(
      red,
      green,
      blue,
      fillAlpha
    );
    sketchState.shape.graphics.stroke(
      red,
      green,
      blue,
      strokeAlpha
    );

    if (options.sketch?.animation?.rotate ?? true) {
      const rotationMax = PI * (options.sketch?.animation?.rotationCount ?? 2);

      const {
        x: rX,
        y: rY,
        // z: rZ
      } = animation.ease({
        values: [
          // createVector(),
          createVector(
            0,
            rotationMax
          ),
          createVector(
            rotationMax,
            rotationMax,
            0
          ),
          createVector(rotationMax),
        ],
        currentTime: switchIndex,
        duration: 1,
        lerpFn: p5.Vector.lerp,
        easingFn: easing.easeInOutExpo,
        // easingFn: easing.easeInOutElastic,
        // easingFn: easing.easeInOutCirc,
      });

      sketchState.shape.graphics.rotateX(rX);
      sketchState.shape.graphics.rotateY(rY);
    }

    sketchState.shape.graphics.box(
      w,
      h,
      -d
    );

    sketchState.shape.graphics.pop();
  });

  image(sketchState.shape.graphics, 0, 0);
  sketchState.shape.graphics.clear();

  if (options.sketch.interactive.enabled) {
    if (options.sketch.interactive.mouse) {
      sketchState.interactive.position = createVector(
        mouseX,
        mouseY
      )
    } else {
      sketchState.interactive.position = createVector(
        map(Math.sin(animation.angle * options.sketch.interactive.sinMultiplier), -1, 1, 0, width),
        map(Math.cos(animation.angle * options.sketch.interactive.cosMultiplier), -1, 1, 0, height)
      )
    }

    stroke(128, 128, 255)
    strokeWeight(2)
    line(
      sketchState.interactive.position.x,
      0,
      sketchState.interactive.position.x,
      height
    )
    line(
      0,
      sketchState.interactive.position.y,
      width,
      sketchState.interactive.position.y
    )

    if (options.sketch.interactive.enabled) {
      if (!options.sketch.interactive.mouse) {
        image(
          sketchState.interactive.image,
          sketchState.interactive.position.x,
          sketchState.interactive.position.y
        )
      }
    }
  }
});
