import options from "../../utils/options.js";
import string from "../../utils/string.js";
import sketch from "../../utils/sketch.js";
import animation from "../../utils/animation.js";

sketch.setup( );

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
    options.sketch.text ?? "hello world",
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

  strokeWeight( 2 );
  stroke( color( ...( options.sketch?.font?.stroke ?? [
    255
  ] ) ) );

  line(
    0,
    height / 2,
    map(
      animation.progression,
      0,
      1,
      0,
      width
    ),
    height / 2
  );
} );
