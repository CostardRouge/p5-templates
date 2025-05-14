import {
  animation
} from "./index.js";

const shapes = {
  cross: ( {
    position,
    size = 10,
    amount = 2,
    angle = 0
  } ) => {
    const {
      x, y
    } = position;

    push();
    translate(
      x,
      y
    );
    rotate( angle );

    const step = PI / amount;

    for ( let i = 0; i < amount; i++ ) {
      rotate( step );
      line(
        -size,
        0,
        size,
        0
      );
    }
    pop();
  },
  hl: ( y ) => {
    line(
      0,
      y,
      width,
      y
    );
  },
  vl: ( x ) => {
    line(
      x,
      0,
      x,
      height
    );
  },
  sketchDurationBar: ( color ) => {
    const sketchDurationBarStartPosition = createVector(
      0,
      height - 2
    );
    const sketchDurationBarEndPosition = createVector(
      width,
      height - 2
    );
    const sketchDurationBarCurrentPosition = p5.Vector.lerp(
      sketchDurationBarStartPosition,
      sketchDurationBarEndPosition,
      animation.progression
    );

    stroke( color );
    strokeWeight( 2 );
    line(
      sketchDurationBarStartPosition.x,
      sketchDurationBarStartPosition.y,
      sketchDurationBarCurrentPosition.x,
      sketchDurationBarCurrentPosition.y
    );
  }
};

export default shapes;
