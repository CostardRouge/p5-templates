/**
 * The window extremes the grid sculpts pack as an air ceiling / floor for
 * their raymarcher. The separable passes must equal the brute-force block
 * extreme at every cell, edges included — a cell whose ceiling is too low by
 * one neighbour lets a ray step into a tube the scan never traced.
 */
import {
  windowMax,
  windowMin
} from "@/p5/sketches/sculpt/_extremes.js";

function seeded( seed: number ) {
  let s = seed >>> 0;

  return () => {
    s = ( s * 1664525 + 1013904223 ) >>> 0;

    return s / 4294967296;
  };
}

function field(
  cols: number, rows: number, seed: number
) {
  const rand = seeded( seed );
  const values = new Float32Array( cols * rows );

  for ( let n = 0; n < values.length; n++ ) {
    values[ n ] = rand() * 2 - 0.5;
  }

  return values;
}

function brute(
  values: Float32Array, cols: number, rows: number, reach: number, pick: ( a: number, b: number ) => number
) {
  const out = new Float32Array( cols * rows );

  for ( let j = 0; j < rows; j++ ) {
    for ( let i = 0; i < cols; i++ ) {
      let best = values[ j * cols + i ];

      for ( let dj = -reach; dj <= reach; dj++ ) {
        for ( let di = -reach; di <= reach; di++ ) {
          const ii = i + di;
          const jj = j + dj;

          if ( ii < 0 || jj < 0 || ii >= cols || jj >= rows ) {
            continue;
          }

          best = pick(
            best,
            values[ jj * cols + ii ]
          );
        }
      }

      out[ j * cols + i ] = best;
    }
  }

  return out;
}

describe(
  "windowMax / windowMin",
  () => {
    const shapes: [number, number][] = [
      [
        1,
        1
      ],
      [
        7,
        5
      ],
      [
        5,
        7
      ],
      [
        64,
        64
      ]
    ];

    it.each( shapes )(
      "equals the brute-force block extreme on a %d × %d field for reach 1, 2 and 3",
      (
        cols, rows
      ) => {
        const values = field(
          cols,
          rows,
          cols * 131 + rows
        );

        for ( const reach of [
          1,
          2,
          3
        ] ) {
          expect( Array.from( windowMax(
            values,
            cols,
            rows,
            reach,
            new Float32Array( cols * rows )
          ) ) ).toEqual( Array.from( brute(
            values,
            cols,
            rows,
            reach,
            Math.max
          ) ) );
          expect( Array.from( windowMin(
            values,
            cols,
            rows,
            reach,
            new Float32Array( cols * rows )
          ) ) ).toEqual( Array.from( brute(
            values,
            cols,
            rows,
            reach,
            Math.min
          ) ) );
        }
      }
    );

    it(
      "leaves a constant field constant",
      () => {
        const values = new Float32Array( 30 ).fill( 0.25 );
        const out = windowMax(
          values,
          6,
          5,
          2,
          new Float32Array( 30 )
        );

        expect( Array.from( out ) ).toEqual( Array.from( values ) );
      }
    );

    it(
      "spreads a single spike to exactly the (2 · reach + 1)² cells around it, clipped at the edge",
      () => {
        const cols = 9;
        const rows = 9;
        const values = new Float32Array( cols * rows );

        values[ 4 * cols + 4 ] = 1;

        const centred = windowMax(
          values,
          cols,
          rows,
          2,
          new Float32Array( cols * rows )
        );

        expect( centred.filter( ( v ) => v === 1 ).length ).toBe( 25 );

        values.fill( 0 );
        values[ 0 ] = 1;

        const cornered = windowMax(
          values,
          cols,
          rows,
          2,
          new Float32Array( cols * rows )
        );

        expect( cornered.filter( ( v ) => v === 1 ).length ).toBe( 9 );
      }
    );

    it(
      "returns the output buffer it was given",
      () => {
        const out = new Float32Array( 4 );

        expect( windowMin(
          new Float32Array( [
            1,
            2,
            3,
            4
          ] ),
          2,
          2,
          1,
          out
        ) ).toBe( out );
        expect( Array.from( out ) ).toEqual( [
          1,
          1,
          1,
          1
        ] );
      }
    );
  }
);
