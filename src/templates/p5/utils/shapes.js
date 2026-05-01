import animation from "./animation.js";
import {
  getP5
} from "./sketch.js";

const shapes = {
  cross: ( {
    position, size = 10, amount = 2, angle = 0
  } ) => {
    const p = getP5();
    const {
      x, y
    } = position;

    p.push();
    p.translate(
      x,
      y
    );
    p.rotate( angle );

    const step = p.PI / amount;

    for ( let i = 0; i < amount; i++ ) {
      p.rotate( step );
      p.line(
        -size,
        0,
        size,
        0
      );
    }
    p.pop();
  },
  hl: (
    y, graphics
  ) => {
    graphics ??= getP5();

    graphics.line(
      0,
      y,
      graphics.width,
      y
    );
  },
  vl: (
    x, graphics
  ) => {
    graphics ??= getP5();

    graphics.line(
      x,
      0,
      x,
      graphics.height
    );
  },
  sketchDurationBar: ( color ) => {
    const p = getP5();
    const sketchDurationBarStartPosition = p.createVector(
      0,
      p.height - 2
    );
    const sketchDurationBarEndPosition = p.createVector(
      p.width,
      p.height - 2
    );
    const sketchDurationBarCurrentPosition = sketchDurationBarStartPosition.copy().lerp(
      sketchDurationBarEndPosition,
      animation.progression
    );

    p.stroke( color );
    p.strokeWeight( 2 );
    p.line(
      sketchDurationBarStartPosition.x,
      sketchDurationBarStartPosition.y,
      sketchDurationBarCurrentPosition.x,
      sketchDurationBarCurrentPosition.y
    );
  },
  grid( {
    columns, rows, border = false
  } ) {
    const p = getP5();

    // Calculate the spacing between lines
    const columnSpacing = p.width / columns;
    const rowSpacing = p.height / rows;

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
          x = p.width - 1; // Right border
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
          y = p.height - 1; // Bottom border
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
    columns, rows, border = false, inset = 1
  } ) {
    const p = getP5();

    /* 1. Validation – same rules as in grid( … ) */
    if ( ![
      p.width,
      p.height,
      columns,
      rows
    ].every( Number.isFinite ) ) {
      throw new TypeError( "width, height, columns and rows must be numbers" );
    }
    if ( columns < 1 || rows < 1 ) return;

    /* 2. Pre-compute the spacing */
    const colStep = p.width / columns;
    const rowStep = p.height / rows;

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
        border && ( c === 0 || c === columns )
          ? c === 0
            ? 0
            : p.width // hard border
          : Math.round( c * colStep ) + ( border ? inset : 0 );

      for ( let r = rowStart; r <= rowEnd; ++r ) {
        // exact Y coordinate
        const y =
          border && ( r === 0 || r === rows )
            ? r === 0
              ? 0
              : p.height
            : Math.round( r * rowStep ) + ( border ? inset : 0 );

        // draw it
        p.point(
          x,
          y
        ); // ← adapt this primitive if necessary
      }
    }
  },
};

export default shapes;
