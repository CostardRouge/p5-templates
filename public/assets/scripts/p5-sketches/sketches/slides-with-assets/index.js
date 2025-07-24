import {
  captureOptions as options, sketch, slides
} from "/assets/scripts/p5-sketches/utils/index.js";

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
  slides.render( options );
  slides.renderCurrentSlide();
} );

