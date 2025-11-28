import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";
import animation from "@/p5/utils/animation.js";
import renderTitle from "@/p5/utils/title/renderTitle.js";

sketch.setup( );

sketch.draw( () => {
  background( ...( options.sketch?.backgroundColor ?? [
    0
  ] ) );

  renderTitle( options.sketch?.text );

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
