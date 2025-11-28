import options from "@/p5/utils/options.js";
import sketch from "@/p5/utils/sketch.js";

sketch.setup( () => {

}, );

sketch.draw( (
  _time, center
) => {
  text( options.name );
} );
