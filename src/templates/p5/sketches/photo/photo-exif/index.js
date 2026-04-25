import options from "@/p5/utils/options.js";

import exif from "@/p5/utils/exif.js";
import string from "@/p5/utils/string.js";
import sketch from "@/p5/utils/sketch.js";
import mappers from "@/p5/utils/mappers.js";
import animation from "@/p5/utils/animation.js";
import imageUtils from "@/p5/utils/imageUtils.js";

import * as common from "@/p5/utils/common.js";

sketch.setup();

const getFont = () => {
  const key = options.sketch?.font?.face ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

sketch.draw( (
  _time, center
) => {
  background( ...( options.sketch?.photo?.backgroundColor ?? [
    246,
    235,
    225
  ] ) );

  const photo = common.getAsset( options.sketch?.photo?.image );

  if ( !photo ) {
    string.write(
      "photo-exif:\n\nadd a photo :)",
      0,
      0,
      {
        size: 72,
        stroke: color( 255 ),
        fill: color( 0 ),
        textHeight: height,
        font: getFont(),
        textAlign: [
          CENTER,
          CENTER
        ],
      }
    );
  }

  if ( photo ) {
    imageUtils.marginImage( {
      img: photo.img,
      margin: width * options.sketch?.photo?.margin,
      center: true,
      position: center,
      callback: (
        x, y, w, h
      ) => {
        const fontSize = options.sketch?.font?.size || 20;
        const yTopPosition = y - fontSize / 2;
        const yBottomPosition = y + h + fontSize / 2;
        const textStyle = {
          size: fontSize,
          stroke: color( ...( options.sketch?.font?.stroke ?? [
            255
          ] ) ),
          fill: color( ...( options.sketch?.font?.color ?? [
            0
          ] ) ),
          font: getFont(),
        };

        // TOP LEFT
        string.write(
          options.sketch.textOverrides?.topLeft !== ""
            ? options.sketch?.textOverrides?.topLeft
            : exif.formatPhotoDate( photo.exif?.date ),
          x,
          yTopPosition,
          textStyle
        );

        // TOP RIGHT
        string.write(
          options.sketch.textOverrides?.topRight !== ""
            ? options.sketch.textOverrides?.topRight
            : exif.formatGPSCoordinates(
              photo.exif?.gps?.latitude,
              photo.exif?.gps?.longitude
            ),
          x,
          yTopPosition,
          {
            ...textStyle,
            textWidth: w,
            textAlign: [
              RIGHT
            ],
          }
        );

        // BOTTOM LEFT
        string.write(
          options.sketch.textOverrides?.bottomLeft,
          x,
          yBottomPosition,
          {
            ...textStyle,
            textWidth: w,
            textAlign: [
              LEFT,
              TOP
            ],
          }
        );

        const bottomRightTexts = [
          exif.formatCameraModel( photo.exif?.camera ),
          exif.formatLensModel( photo.exif?.lens ),
          exif.formatFocalLength( photo.exif?.focalLength ),
          exif.formatAperture( photo.exif?.aperture ),
          exif.formatShutterSpeed( photo.exif?.shutterSpeed ),
        ].filter( Boolean );

        const bottomRightText = mappers.circularIndex(
          animation.progression * bottomRightTexts.length,
          bottomRightTexts
        );

        // BOTTOM RIGHT
        string.write(
          options.sketch.textOverrides?.bottomRight !== ""
            ? options.sketch.textOverrides?.bottomRight
            : bottomRightText,
          x,
          yBottomPosition,
          {
            ...textStyle,
            textWidth: w,
            textAlign: [
              RIGHT,
              TOP
            ],
          }
        );
      },
    } );
  }
} );
