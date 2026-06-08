import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import {
  getP5
} from "@/p5/utils/sketch.js";

sketch.draw( (
  _time, center
) => {
  const p = getP5();

  p.clear();
  p.background( ...( options.sketch?.backgroundColor ?? [
    0,
    0,
    0
  ] ) );
} );
