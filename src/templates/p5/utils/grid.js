import cache from "./cache.js";
import {
  getP5, loadP5Class
} from "./sketch.js";

const grid = {
  create: async(
    {
      rows = 2,
      columns = 2,
      diamond = false,
      topLeft = null,
      topRight = null,
      bottomLeft = null,
      bottomRight = null
    },
    cached = true
  ) => {
    const p = getP5();

    // Set defaults for p5-dependent parameters
    if ( topLeft === null ) {
      topLeft = p.createVector(
        0,
        0
      );
    }
    if ( topRight === null ) {
      topRight = p.createVector(
        p.width,
        0
      );
    }
    if ( bottomLeft === null ) {
      bottomLeft = p.createVector(
        0,
        p.height
      );
    }
    if ( bottomRight === null ) {
      bottomRight = p.createVector(
        p.width,
        p.height
      );
    }

    const compute = () => {
      const baseCellWidth = topLeft.dist( topRight ) / columns;
      const baseCellHeight = topLeft.dist( bottomLeft ) / rows;

      const cellWidth = diamond ? baseCellWidth / p.sqrt( 2 ) : baseCellWidth;
      const cellHeight = diamond ? baseCellWidth / p.sqrt( 2 ) : baseCellHeight;

      const halfDiagonal = baseCellWidth / 2;

      const cells = [];

      for ( let row = 0; row < rows; row++ ) {
        for ( let column = 0; column < columns; column++ ) {
          const corners = [];
          const x = topLeft.x + column * baseCellWidth;
          const y = topLeft.y + row * baseCellHeight;

          if ( diamond ) {
            corners.push( p.createVector(
              0,
              -halfDiagonal
            ) ); // top
            corners.push( p.createVector(
              halfDiagonal,
              0
            ) ); // right
            corners.push( p.createVector(
              0,
              halfDiagonal
            ) ); // bottom
            corners.push( p.createVector(
              -halfDiagonal,
              0
            ) ); // left
          } else {
            corners.push( p.createVector(
              0,
              0
            ) );
            corners.push( p.createVector(
              cellWidth,
              0
            ) );
            corners.push( p.createVector(
              cellWidth,
              cellHeight
            ) );
            corners.push( p.createVector(
              0,
              cellHeight
            ) );
          }

          cells.push( {
            center: diamond
              ? p.createVector(
                x + halfDiagonal,
                y + halfDiagonal
              )
              : p.createVector(
                x + cellWidth / 2,
                y + cellHeight / 2
              ),
            absoluteCorners: corners.map( ( corner ) => corner.copy().add(
              x,
              y
            ) ),
            position: p.createVector(
              x,
              y
            ),
            height: cellHeight,
            width: cellWidth,
            xIndex: column,
            yIndex: row,
            corners,
            column,
            row,
            x,
            y
          } );

          if ( diamond && row < rows - 1 && column < columns - 1 ) {
            const corners = [
              p.createVector(
                0,
                -halfDiagonal
              ), // top
              p.createVector(
                halfDiagonal,
                0
              ), // right
              p.createVector(
                0,
                halfDiagonal
              ), // bottom
              p.createVector(
                -halfDiagonal,
                0
              ) // left
            ];

            cells.push( {
              // position: p.createVector(x + halfDiagonal, y + halfDiagonal),
              center: p.createVector(
                x + halfDiagonal * 2,
                y + halfDiagonal * 2
              ),
              absoluteCorners: corners.map( ( corner ) => corner.copy().add(
                x,
                y
              ) ),
              corners,
              height: cellHeight,
              width: cellWidth,
              xIndex: column + 0.5,
              yIndex: row + 0.5,
              column: column + 0.5,
              row: row + 0.5,
              x: x + halfDiagonal,
              y: y + halfDiagonal
            } );
          }
        }
      }

      const corners = {
        topLeft,
        topRight,
        bottomLeft,
        bottomRight
      };

      return {
        cells,
        corners,
        cellWidth,
        cellHeight
      };
    };

    if ( false === cached ) {
      return compute();
    }

    const cacheKey = cache.key(
      topLeft.x,
      topRight.x,
      bottomLeft.x,
      bottomRight.x,
      topLeft.y,
      topRight.y,
      bottomLeft.y,
      bottomRight.y,
      rows,
      columns,
      diamond
    );

    return cache.store(
      cacheKey,
      compute
    );
  },
  debug: (
    gridOptions, cells, corners
  ) => {
    const p = getP5();

    // Draw grid corners
    p.stroke(
      255,
      0,
      0
    );
    p.strokeWeight( 10 );
    p.point(
      corners.topLeft.x,
      corners.topLeft.y
    );
    p.point(
      corners.topRight.x,
      corners.topRight.y
    );
    p.point(
      corners.bottomLeft.x,
      corners.bottomLeft.y
    );
    p.point(
      corners.bottomRight.x,
      corners.bottomRight.y
    );

    // Draw grid lines
    p.stroke( 0 );
    p.strokeWeight( 1 );
    for ( let row = 0; row < gridOptions.rows + 1; row++ ) {
      let startX = p.lerp(
        corners.topLeft.x,
        corners.bottomLeft.x,
        row / gridOptions.rows
      );
      let startY = p.lerp(
        corners.topLeft.y,
        corners.bottomLeft.y,
        row / gridOptions.rows
      );
      let endX = p.lerp(
        corners.topRight.x,
        corners.bottomRight.x,
        row / gridOptions.rows
      );
      let endY = p.lerp(
        corners.topRight.y,
        corners.bottomRight.y,
        row / gridOptions.rows
      );

      p.line(
        startX,
        startY,
        endX,
        endY
      );
    }
    for ( let col = 0; col < gridOptions.columns + 1; col++ ) {
      let startX = p.lerp(
        corners.topLeft.x,
        corners.topRight.x,
        col / gridOptions.columns
      );
      let startY = p.lerp(
        corners.topLeft.y,
        corners.topRight.y,
        col / gridOptions.columns
      );
      let endX = p.lerp(
        corners.bottomLeft.x,
        corners.bottomRight.x,
        col / gridOptions.columns
      );
      let endY = p.lerp(
        corners.bottomLeft.y,
        corners.bottomRight.y,
        col / gridOptions.columns
      );

      p.line(
        startX,
        startY,
        endX,
        endY
      );
    }

    // Draw grid cells as dots
    p.stroke(
      0,
      0,
      255
    );
    p.strokeWeight( 5 );
    for ( let cell of cells ) {
      p.point(
        cell.x,
        cell.y
      );
    }
  },
  prepare: async( gridOptions ) => {
    const {
      cells
    } = await grid.create( gridOptions );

    return {
      cells,
      draw: ( onGridCell ) => {
        cells.forEach( (
          {
            position, x, y
          }, index
        ) => {
          onGridCell?.(
            position,
            {
              x,
              y
            },
            index
          );
        } );
      }
    };
  },
  draw: async(
    gridOptions, handler
  ) => {
    const {
      cells
    } = await grid.create( gridOptions );

    cells.forEach( (
      {
        position, x, y
      }, index
    ) => {
      handler(
        position,
        {
          x,
          y
        },
        index / ( cells.length - 1 )
      );
    } );

    return cells;
  }
};

export default grid;
