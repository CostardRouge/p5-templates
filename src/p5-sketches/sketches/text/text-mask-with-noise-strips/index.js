import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";

const canvases = {
};

const getBg = () => options.sketch?.background ?? [
  0
];

const getFont = () => {
  const key = options.sketch?.font ?? options.font ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

sketch.setup(
  () => {
    canvases.mask = createGraphics(
      sketch?.engine?.canvas?.width,
      sketch?.engine?.canvas?.height
    );
    background( ...getBg() );
  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    },
  }
);

sketch.draw( ( time ) => {
  background( ...getBg() );

  // Controls
  const rows = options.sketch?.rows ?? 25;
  const columns = options.sketch?.columns ?? 300;
  const centered = options.sketch?.centered ?? true;

  const noiseOctaves = options.sketch?.noiseOctaves ?? 3;
  const noiseFalloff = options.sketch?.noiseFalloff ?? 0.45;

  const timeSpeed = options.sketch?.timeSpeed ?? 1;
  const t = time * timeSpeed;

  const xOffScale = options.sketch?.xOffScale ?? 1.5;
  const yOffScale = options.sketch?.yOffScale ?? 1.5;

  const angleRange = options.sketch?.angleRange ?? 1; // multiplies TAU
  const scale = options.sketch?.scale ?? 1;

  const weightMin = options.sketch?.weightMin ?? 150;
  const weightMax = options.sketch?.weightMax ?? 200;

  const paletteName = options.sketch?.palette ?? "rainbow";
  const paletteFn =
    typeof colors?.[ paletteName ] === "function"
      ? colors[ paletteName ]
      : colors.rainbow;
  const hueOffset = options.sketch?.hueOffset ?? 0;

  const opacityFrom = options.sketch?.opacityFactorFrom ?? 2;
  const opacityTo = options.sketch?.opacityFactorTo ?? 1;

  const title = options.sketch?.title ?? options.title ?? "";
  const textSizeDivisor = options.sketch?.textSizeDivisor ?? 2.3;

  const textFontSize = ( height + width ) / textSizeDivisor;

  canvases.mask.clear();

  const textBox = string.write(
    title,
    0,
    height / 2 - textFontSize / 8,
    {
      size: textFontSize,
      font: getFont(),
      textWidth: width,
      textAlign: [
        CENTER,
        CENTER
      ],
      popPush: false,
      graphics: canvases.mask,
    }
  );

  if ( !textBox ) {
    return;
  }

  const boundaryMargin = 50;
  const maskBoundary = [
    constrain(
      ( width - textBox.w ) / 2 - boundaryMargin,
      0,
      width
    ),
    constrain(
      ( height - textBox.h ) / 2 - boundaryMargin,
      0,
      height
    ),
    constrain(
      textBox.w + boundaryMargin * 2,
      0,
      width
    ),
    constrain(
      textBox.h + boundaryMargin * 2,
      0,
      height
    ),
  ];

  const gridOptions = {
    topLeft: createVector(
      0,
      0
    ),
    topRight: createVector(
      width,
      0
    ),
    bottomLeft: createVector(
      0,
      height
    ),
    bottomRight: createVector(
      width,
      height
    ),
    rows,
    columns,
    centered,
  };

  noiseDetail(
    noiseOctaves,
    noiseFalloff
  );

  function inMaskingBoundary(
    x, y
  ) {
    return (
      x >= maskBoundary[ 0 ] &&
      x - boundaryMargin <= maskBoundary[ 2 ] &&
      y >= maskBoundary[ 1 ] &&
      y <= maskBoundary[ 2 ]
    );
  }

  grid.draw(
    gridOptions,
    (
      cellVector, {
        x, y
      }
    ) => {
      const xOff = ( x / width ) * xOffScale;
      const yOff = ( y / height ) * yOffScale;

      // if ( !inMaskingBoundary(
      //   cellVector.x,
      //   cellVector.y
      // ) ) {
      //   return;
      // }

      const angle = mappers.fn(
        noise(
          xOff + t / 2,
          yOff / 2 - t / 4
        ),
        0,
        1,
        -TAU * angleRange,
        TAU * angleRange,
        easing.easeInOutSine
      );

      const weight = mappers.fn(
        noise(
          xOff,
          yOff + y,
          animation.circularProgression
        ),
        0,
        1,
        weightMin,
        weightMax,
        easing.easeInOutBack
      );

      stroke( paletteFn( {
        hueOffset,
        hueIndex: angle,
        opacityFactor: mappers.fn(
          noise(
            xOff,
            yOff,
            animation.circularProgression
          ),
          0,
          1,
          opacityFrom,
          opacityTo,
          easing.easeInOutSine
        ),
      } ) );

      push();
      translate(
        cellVector.x + scale * sin( angle ),
        cellVector.y + angle * scale * cos( angle + y )
      );
      strokeWeight( weight );
      point(
        0,
        0
      );
      pop();
    }
  );

  const maskedImage = window.get();

  maskedImage.mask( canvases.mask );

  background( ...getBg() );
  image(
    maskedImage,
    0,
    0
  );

  // noFill();
  // stroke( "red" );
  // strokeWeight( 2 );
  // rect( ...maskBoundary );
  //
  // image(
  //   canvases.mask,
  //   0,
  //   0
  // );
} );
