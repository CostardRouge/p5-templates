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
  },
  grid( {
    columns, rows, border = false
  } ) {
    // Calculate the spacing between lines
    const columnSpacing = width / columns;
    const rowSpacing = height / rows;

    // Draw vertical lines
    for ( let column = 0; column <= columns; column++ ) {
      // Calculate x position
      let x = column * columnSpacing;

      // Adjust position based on border setting
      if ( border ) {
        // For borders, we want lines at exact edges (0 and width)
        // and inner lines offset by 1 unit from edges
        if ( column === 0 ) {
          x = 1; // Left border
        } else if ( column === columns ) {
          x = width - 1; // Right border
        }
      } else {
        // Without borders, skip first vertical line
        if ( column === 0 ) {
          continue;
        }
      }

      shapes.vl( x );
    }

    // Draw horizontal lines
    for ( let row = 0; row <= rows; row++ ) {
      // Calculate y position
      let y = row * rowSpacing;

      // Adjust position based on border setting
      if ( border ) {
        // For borders, we want lines at exact edges (0 and height)
        // and inner lines offset by 1 unit from edges
        if ( row === 0 ) {
          y = 1; // Top border
        } else if ( row === rows ) {
          y = height - 1; // Bottom border
        }
      } else {
        // Without borders, skip first horizontal line
        if ( row === 0 ) {
          continue;
        }
      }

      shapes.hl( y );
    }
  }
};

export default shapes;
