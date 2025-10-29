import options from "../../utils/options.js";

import exif from "../../utils/exif.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";
import events from "../../utils/events.js";
import mappers from "../../utils/mappers.js";
import animation from "../../utils/animation.js";
import imageUtils from "../../utils/imageUtils.js";

const sketchState = {
  image: null,
  input: null,
  exifData: null,
  loading: false
};

async function handleImage( file ) {
  sketchState.loading = true;

  if ( file.type === "image" ) {
    sketchState.image = createImg(
      file.data,
      ""
    );
    sketchState.image.hide();
    sketchState.exifData = await exif.load( file.data );

    // console.log( sketchState.exifData );

    document
      .querySelector( "canvas#defaultCanvas0" )
      .classList.add( "loaded" );

    sketchState.loading = null;
  } else {
    sketchState.image = null;
    sketchState.exifData = null;
    sketchState.loading = false;
  }
}

events.register(
  "engine-canvas-double-clicked",
  () => {
    sketchState.input.elt.click();
  }
);

events.register(
  "engine-canvas-handle-drop",
  event => {
    console.log(
      "Engine canvas handle drop",
      event
    );
  }
);

events.register(
  "engine-canvas-handle-file",
  async file => {
    console.log( "Engine file handle file" );
    await handleImage( file );
  }
);

sketch.setup(
  () => {
    sketchState.input = createFileInput( handleImage );
    sketchState.input.hide();
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

  string.write(
    sketchState.loading ? "loading..." : "double click to add an image",
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

  if ( sketchState.image ) {
    imageUtils.marginImage( {
      img: sketchState.image,
      margin: width * .1,
      center: true,
      position: center,
      // scale: .5,
      callback: (
        x, y, w, h
      ) => {
        const fontSize = 20;
        const yTopPosition = y - fontSize / 2;
        const yBottomPosition = y + h + fontSize / 2;
        const textStyle = {
          size: fontSize,
          stroke: color( 255 ),
          fill: color( 0 ),
          // fill: color(0, 0, 0, 255),
          // stroke: color(...options.colors.background),
          font: string.fonts.martian,
          // blendMode: EXCLUSION
        };

        // TOP LEFT
        string.write(
          exif.formatPhotoDate( sketchState.exifData?.date ),
          x,
          yTopPosition,
          textStyle
        );

        // TOP RIGHT
        string.write(
          exif.formatGPSCoordinates(
            sketchState.exifData?.gps?.latitude,
            sketchState.exifData?.gps?.longitude
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

        const bottomRightTexts = [
          exif.formatCameraModel( sketchState.exifData?.camera ),
          exif.formatLensModel( sketchState.exifData?.lens ),
          exif.formatFocalLength( sketchState.exifData?.focalLength ),
          exif.formatAperture( sketchState.exifData?.aperture ),
          exif.formatShutterSpeed( sketchState.exifData?.shutterSpeed ),
        ].filter( Boolean );

        const bottomRightText = mappers.circularIndex(
          animation.progression * bottomRightTexts.length,
          bottomRightTexts
        );

        // BOTTOM RIGHT
        string.write(
          bottomRightText,
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
