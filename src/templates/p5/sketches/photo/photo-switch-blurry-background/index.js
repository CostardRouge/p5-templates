import options from "@/p5/utils/options.js";

import exif from "@/p5/utils/exif.js";
import cache from "@/p5/utils/cache.js";
import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

const canvases = {
};

sketch.setup( () => {
  const p = getP5();

  canvases.blurredLayer = p.createGraphics(
    p.width,
    p.height
  );

  canvases.blurredLayer.pixelDensity( options.backgroundPixelDensity || 0.055 );
  canvases.blurredLayer.drawingContext.filter = "blur(2px)";

  p.background( ...options.colors.background );
} );

sketch.draw( (
  time, center, favoriteColor
) => {
  const p = getP5();

  p.background( ...options.colors.background );
  canvases.blurredLayer.background( ...options.colors.background );

  const images = cache.get( "images" );
  const imageObjectAtIndex = mappers.circularIndex(
    animation.progression * images.length,
    images
  );

  const imageAtIndex = imageObjectAtIndex.img;

  imageUtils.marginImage( {
    img: imageAtIndex,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    graphics: canvases.blurredLayer,
    // margin: undefined,
    center: true,
    fill: true,
    scale: 1,
  } );

  // canvases.background(...options.colors.background, 0);
  // canvases.background(0, 0 ,0, 90);
  p.image(
    canvases.blurredLayer,
    0,
    0,
    p.width,
    p.height
  );
  // filter(BLUR, options.blur || 2);
  // filter(POSTERIZE, options.blur || 9, true);

  // p.background(...options.colors.background);

  imageUtils.marginImage( {
    img: imageAtIndex,
    // graphics: canvases.blurredLayer,
    margin: p.width * 0.1,
    center: true,
    position: p.createVector(
      p.width / 2,
      p.height / 2
    ),
    // scale: .5,
    callback: (
      x, y, w, h
    ) => {
      const fontSize = 20;
      const yTopPosition = y - fontSize / 2;
      const yBottomPosition = y + h + fontSize / 2;
      const textStyle = {
        size: fontSize,
        stroke: p.color(
          0,
          0,
          0,
          255
        ),
        fill: p.color( ...options.colors.background ),
        // fill: p.color(0, 0, 0, 255),
        // stroke: p.color(...options.colors.background),
        font: string.fonts.martian,
        // blendMode: p.EXCLUSION
      };

      string.write(
        exif.formatFocalLength( imageObjectAtIndex?.exif?.focalLength ),
        x,
        yTopPosition,
        textStyle
      );

      string.write(
        exif.formatISO( imageObjectAtIndex?.exif?.iso ),
        x + w,
        yTopPosition,
        {
          ...textStyle,
          textAlign: [
            p.RIGHT
          ],
        }
      );

      string.write(
        exif.formatAperture( imageObjectAtIndex?.exif?.aperture ),
        p.map(
          1 / 4,
          0,
          1,
          x,
          x + w
        ),
        yTopPosition,
        {
          ...textStyle,
          textAlign: [
            p.LEFT
          ],
        }
      );

      string.write(
        exif.formatShutterSpeed( imageObjectAtIndex?.exif?.shutterSpeed ),
        p.map(
          2 / 4,
          0,
          1,
          x,
          x + w
        ),
        yTopPosition,
        {
          ...textStyle,
          textAlign: [
            p.LEFT
          ],
        }
      );

      string.write(
        exif.formatLensModel( imageObjectAtIndex?.exif?.lens ),
        x + w / 2,
        yBottomPosition,
        {
          ...textStyle,
          textAlign: [
            p.CENTER,
            p.TOP
          ],
        }
      );
    },
  } );

  const defaultTitle = options?.name?.replaceAll(
    "-",
    "\n"
  );

  if ( animation.progression < 0.2 ) {
    string.write(
      options?.texts?.title || defaultTitle,
      0,
      p.height / 2,
      {
        size: 144,
        stroke: p.color( ...options.colors.text ),
        fill: p.color( ...options.colors.background ),
        font: string.fonts.martian,
        textAlign: [
          p.CENTER,
          p.CENTER
        ],
        blendMode: p.EXCLUSION,
      }
    );
  }

  p.push();
  p.translate(
    0,
    48
  );
  // p.rotate(p.PI/2)
  string.write(
    String( Number( animation.progression ).toPrecision( 3 ) ).slice(
      0,
      5
    ),
    0,
    0,
    {
      size: 24,
      stroke: p.color( ...options.colors.text ),
      fill: p.color( ...options.colors.background ),
      font: string.fonts.martian,
      textAlign: [
        p.CENTER
      ],
    }
  );
  p.pop();
} );
