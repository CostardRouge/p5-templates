import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import {
  getP5
} from "@/p5/utils/sketch.js";
import {
  paintBackground,
  resolveBackground
} from "@/p5/utils/background.js";

sketch.draw( () => {
  const p = getP5();

  p.clear();
  paintBackground( resolveBackground(
    options.sketch?.backgroundColor,
    {
      fallback: [
        0
      ]
    }
  ) );

  p.strokeWeight( 2 );
  p.stroke( p.color( ...( options.sketch?.font?.stroke ?? [
    255
  ] ) ) );

  p.line(
    0,
    p.height / 2,
    p.map(
      animation.progression,
      0,
      1,
      0,
      p.width
    ),
    p.height / 2
  );
} );
