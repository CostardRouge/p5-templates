import options from "../../utils/options.js";
import sketch from "../../utils/sketch.js";

sketch.setup( () => {

}, );

sketch.draw( (
  _time, center
) => {
  text( options.name );
} );
