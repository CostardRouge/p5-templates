import options from "../../utils/options.js";
import sketch from "../../utils/sketch.js";

sketch.setup(
  undefined,
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

sketch.draw( () => {

} );

