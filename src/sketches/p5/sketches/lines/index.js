import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  paintBackground,
  resolveBackground
} from "@/p5/utils/background.js";

sketch.draw( (
  _time, center
) => {
  const p = getP5();

  p.clear();
  paintBackground( resolveBackground(
    options.sketch?.backgroundColor,
    {
      fallback: [
        0,
        0,
        0
      ]
    }
  ) );
} );
