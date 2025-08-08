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
  },
  dots( {
    columns,
    rows,
    border = false,
    inset = 1,
  } ) {
    /* 1. Validation – same rules as in grid( … ) */
    if ( ![
      width,
      height,
      columns,
      rows
    ].every( Number.isFinite ) ) {
      throw new TypeError( "width, height, columns and rows must be numbers" );
    }
    if ( columns < 1 || rows < 1 ) return;

    /* 2. Pre-compute the spacing */
    const colStep = width / columns;
    const rowStep = height / rows;

    /* 3. Decide where to start/stop depending on the border flag       *
     *    - With border=false we skip the first row/col (0) so that the *
     *      dots appear only inside the canvas.                         */
    const colStart = border ? 0 : 1;
    const colEnd = border ? columns : columns - 1;
    const rowStart = border ? 0 : 1;
    const rowEnd = border ? rows : rows - 1;

    /* 4. Iterate through every logical grid vertex and place a dot */
    for ( let c = colStart; c <= colEnd; ++c ) {
      // exact X coordinate
      const x =
        ( border && ( c === 0 || c === columns ) )
          ? ( c === 0 ? 0 : width ) // hard border
          : Math.round( c * colStep ) + ( border ? inset : 0 );

      for ( let r = rowStart; r <= rowEnd; ++r ) {
        // exact Y coordinate
        const y =
          ( border && ( r === 0 || r === rows ) )
            ? ( r === 0 ? 0 : height )
            : Math.round( r * rowStep ) + ( border ? inset : 0 );

        // draw it
        point(
          x,
          y
        ); // ← adapt this primitive if necessary
      }
    }
  }
};

export default shapes;
