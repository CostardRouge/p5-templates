import options from "@/p5/utils/options.js";

import grid from "@/p5/utils/grid.js";
import string from "@/p5/utils/string.js";
import easing from "@/p5/utils/easing.js";
import sketch from "@/p5/utils/sketch.js";
import colors from "@/p5/utils/colors.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const canvases = {};

const getBg = () => options.sketch?.background ?? [
  0
];

const getFont = () => {
  const key = options.sketch?.font ?? options.font ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

sketch.setup( () => {
  const p = getP5();

  canvases.mask = p.createGraphics(
    p.width,
    p.height
  );

  p.background( ...getBg() );
} );

sketch.draw( async( time ) => {
  const p = getP5();

  p.background( ...getBg() );

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

  const angleRange = options.sketch?.angleRange ?? 1; // multiplies p.TAU
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

  const textFontSize = ( p.height + p.width ) / textSizeDivisor;

  canvases.mask.clear();

  const textBox = string.write(
    title,
    0,
    p.height / 2 - textFontSize / 8,
    {
      size: textFontSize,
      font: getFont(),
      textWidth: p.width,
      textAlign: [
        p.CENTER,
        p.CENTER
      ],
      popPush: false,
      graphics: canvases.mask
    }
  );

  if ( !textBox ) {
    return;
  }

  const boundaryMargin = 50;
  const maskBoundary = [
    p.constrain(
      ( p.width - textBox.w ) / 2 - boundaryMargin,
      0,
      p.width
    ),
    p.constrain(
      ( p.height - textBox.h ) / 2 - boundaryMargin,
      0,
      p.height
    ),
    p.constrain(
      textBox.w + boundaryMargin * 2,
      0,
      p.width
    ),
    p.constrain(
      textBox.h + boundaryMargin * 2,
      0,
      p.height
    )
  ];

  const gridOptions = {
    topLeft: p.createVector(
      0,
      0
    ),
    topRight: p.createVector(
      p.width,
      0
    ),
    bottomLeft: p.createVector(
      0,
      p.height
    ),
    bottomRight: p.createVector(
      p.width,
      p.height
    ),
    rows,
    columns,
    centered
  };

  p.noiseDetail(
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

  await grid.draw(
    gridOptions,
    (
      cellVector, {
        x, y
      }
    ) => {
      const xOff = ( x / p.width ) * xOffScale;
      const yOff = ( y / p.height ) * yOffScale;

      // if ( !inMaskingBoundary(
      //   cellVector.x,
      //   cellVector.y
      // ) ) {
      //   return;
      // }

      const angle = mappers.fn(
        p.noise(
          xOff + t / 2,
          yOff / 2 - t / 4
        ),
        0,
        1,
        -p.TAU * angleRange,
        p.TAU * angleRange,
        easing.easeInOutSine
      );

      const weight = mappers.fn(
        p.noise(
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

      p.stroke( paletteFn( {
        hueOffset,
        hueIndex: angle,
        opacityFactor: mappers.fn(
          p.noise(
            xOff,
            yOff,
            animation.circularProgression
          ),
          0,
          1,
          opacityFrom,
          opacityTo,
          easing.easeInOutSine
        )
      } ) );

      p.push();
      p.translate(
        cellVector.x + scale * p.sin( angle ),
        cellVector.y + angle * scale * p.cos( angle + y )
      );
      p.strokeWeight( weight );
      p.point(
        0,
        0
      );
      p.pop();
    }
  );

  const maskedImage = p.get();

  maskedImage.mask( canvases.mask );

  p.background( ...getBg() );
  p.image(
    maskedImage,
    0,
    0
  );

  // p.noFill();
  // p.stroke( "red" );
  // p.strokeWeight( 2 );
  // p.rect( ...maskBoundary );
  //
  // p.image(
  //   canvases.mask,
  //   0,
  //   0
  // );
} );
