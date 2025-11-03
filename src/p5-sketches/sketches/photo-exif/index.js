import options from "../../utils/options.js";

import exif from "../../utils/exif.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";
import mappers from "../../utils/mappers.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";

import * as common from "../../utils/common.js";

sketch.setup(
  () => {

  },
  {
    size: {
      width: options.size.width,
      height: options.size.height,
    },
    animation: {
      framerate: options.animation.framerate,
      duration: options.animation.duration,
    }
  }
);

sketch.draw( (
  _time, center
) => {
  background( 255 );

  const photo = common.getAsset( options.sketch?.photo );

  if ( !photo ) {
    string.write(
      "add a photo :)",
      0,
      0,
      {
        size: 72,
        stroke: color( 255 ),
        fill: color( 0 ),
        textHeight: height,
        font: string.fonts.martian,
        textAlign: [
          CENTER,
          CENTER
        ]
      }
    );
  }

  if ( photo ) {
    imageUtils.marginImage( {
      img: photo.img,
      margin: width * options.sketch?.margin,
      center: true,
      position: center,
      callback: (
        x, y, w, h
      ) => {
        const fontSize = options.sketch?.fontSize || 20;
        const yTopPosition = y - fontSize / 2;
        const yBottomPosition = y + h + fontSize / 2;
        const textStyle = {
          size: fontSize,
          stroke: color( ...( options.sketch?.fontStroke ?? [
            255
          ] ) ),
          fill: color( ...( options.sketch?.fontColor ?? [
            0
          ] ) ),
          font: string.fonts.martian,
        };

        // TOP LEFT
        string.write(
          options.sketch.topLeft !== "" ? options.sketch.topLeft : exif.formatPhotoDate( photo.exif?.date ),
          x,
          yTopPosition,
          textStyle
        );

        // TOP RIGHT
        string.write(
          options.sketch.topRight !== "" ? options.sketch.topRight : exif.formatGPSCoordinates(
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
            ]
          }
        );

        // BOTTOM LEFT
        string.write(
          options.sketch.bottomLeft,
          x,
          yBottomPosition,
          {
            ...textStyle,
            textWidth: w,
            textAlign: [
              LEFT,
              TOP
            ]
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
          options.sketch.bottomRight !== "" ? options.sketch.bottomRight : bottomRightText,
          x,
          yBottomPosition,
          {
            ...textStyle,
            textWidth: w,
            textAlign: [
              RIGHT,
              TOP
            ]
          }
        );
      }
    } );
  }
} );
