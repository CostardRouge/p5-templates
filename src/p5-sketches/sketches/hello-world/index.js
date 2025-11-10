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

const getFont = () => {
  const key = options.sketch?.font?.face ?? "martian";

  return ( string.fonts && string.fonts[ key ] ) || string.fonts.martian;
};

sketch.draw( (
  _time, center
) => {
  background( ...( options.sketch?.backgroundColor ?? [
      0
    ] ) );

  string.write(
    "hello world",
    0,
    0,
    {
      size: options.sketch?.font?.size || 20,
      stroke: color( ...( options.sketch?.font?.stroke ?? [
      255
    ] ) ),
      fill: color( ...( options.sketch?.font?.color ?? [
      0
    ] ) ),
      textHeight: height,
      font: getFont(),
      textAlign: [
        CENTER,
        CENTER
      ]
    }
  );

  strokeWeight(2);
  stroke(color( ...( options.sketch?.font?.stroke ?? [
      255
    ] ) ))

  line(
    0,
    height/2,
    map(animation.progression, 0, 1, 0, width),
    height/2
  )
} );
