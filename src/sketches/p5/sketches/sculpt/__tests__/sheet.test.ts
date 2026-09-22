/**
 * Unit tests for the relief sheet: the grid, its jitter budget, the height
 * dynamics and the texture packing. All pure functions (no p5), which is what
 * lets a headless capture reproduce the studio: the same options give the same
 * sheet, the dynamics depend on dt and never on the framerate, and a packed
 * height decodes to what the shader will read.
 */
import {
  HEX_OFFSET,
  HEX_ROW_SCALE,
  MAX_COLUMNS,
  buildSheet,
  canvasToSheet,
  computeTargets,
  createHeightState,
  getSheet,
  integrateHeights,
  jitterBudget,
  liftRank,
  linkGate,
  packSheet,
  packTops,
  rateFor,
  sheetDriftAt,
  sheetFrame,
  sheetToCanvas,
  spreadTargets,
  unpackHeight
} from "@/p5/sketches/sculpt/_sheet.js";

const FRAME = {
  columns: 36,
  rowScale: 1,
  width: 1080,
  height: 1350,
  margin: 0.06
};

describe(
  "sheetFrame",
  () => {
    it(
      "spans the columns across the width inside the margin and derives square rows",
      () => {
        const frame = sheetFrame( FRAME );

        expect( frame.columns ).toBe( 36 );
        expect( frame.cellPx ).toBeCloseTo(
          1080 * 0.88 / 35,
          6
        );
        expect( frame.rows ).toBe( 1 + Math.round( 1350 * 0.88 / frame.cellPx ) );
        expect( frame.originX ).toBeCloseTo(
          1080 * 0.06,
          6
        );

        // Rows are centred vertically.
        const bottom = frame.originY + ( frame.rows - 1 ) * frame.cellPx;

        expect( frame.originY ).toBeCloseTo(
          1350 - bottom,
          6
        );
      }
    );

    it(
      "maps canvas and sheet both ways",
      () => {
        const frame = sheetFrame( FRAME );
        const px = sheetToCanvas(
          frame,
          3,
          2.5
        );
        const back = canvasToSheet(
          frame,
          px.x,
          px.y
        );

        expect( px.x - frame.originX ).toBeCloseTo(
          3 * frame.cellPx,
          6
        );
        expect( back.x ).toBeCloseTo(
          3,
          9
        );
        expect( back.z ).toBeCloseTo(
          2.5,
          9
        );
      }
    );

    it(
      "clamps the columns to the texture budget",
      () => {
        expect( sheetFrame( {
          ...FRAME,
          columns: 500
        } ).columns ).toBe( MAX_COLUMNS );
      }
    );
  }
);

describe(
  "jitterBudget",
  () => {
    it(
      "leaves half a cell minus the widest tube and the wall margin",
      () => {
        const budget = jitterBudget( {
          layout: "square",
          jitter: 0.45,
          maxRadius: 0.1
        } );

        expect( budget.x ).toBeCloseTo(
          0.38,
          9
        );
        expect( budget.z ).toBeCloseTo(
          0.38,
          9
        );
      }
    );

    it(
      "never goes negative, and takes the hex parity shift out of x",
      () => {
        expect( jitterBudget( {
          layout: "square",
          jitter: 0.3,
          maxRadius: 0.6
        } ).x ).toBe( 0 );

        const hex = jitterBudget( {
          layout: "hex",
          jitter: 0.45,
          maxRadius: 0.05
        } );

        expect( hex.x ).toBeCloseTo(
          0.5 - HEX_OFFSET - 0.05 - 0.02,
          9
        );
        expect( hex.z ).toBeCloseTo(
          0.5 * HEX_ROW_SCALE - 0.05 - 0.02,
          9
        );
      }
    );
  }
);

describe(
  "buildSheet",
  () => {
    // A wide tube (0.25) so the budget (0.23) is what bounds the asked jitter.
    const cfg = {
      columns: 12,
      rows: 8,
      layout: "square",
      jitter: 0.3,
      seed: 7,
      maxRadius: 0.25
    };

    it(
      "is a pure function of its inputs",
      () => {
        const a = buildSheet( cfg );
        const b = buildSheet( cfg );
        const c = buildSheet( {
          ...cfg,
          seed: 8
        } );

        expect( Array.from( a.px ) ).toEqual( Array.from( b.px ) );
        expect( Array.from( a.pz ) ).toEqual( Array.from( b.pz ) );
        expect( Array.from( a.px ) ).not.toEqual( Array.from( c.px ) );
      }
    );

    it(
      "sits every node on its grid point at jitter 0",
      () => {
        const sheet = buildSheet( {
          ...cfg,
          jitter: 0
        } );

        for ( let j = 0; j < sheet.rows; j++ ) {
          for ( let i = 0; i < sheet.columns; i++ ) {
            const k = j * sheet.columns + i;

            expect( sheet.px[ k ] ).toBe( i );
            expect( sheet.pz[ k ] ).toBe( j );
          }
        }
      }
    );

    it(
      "keeps every node inside the jitter budget",
      () => {
        const sheet = buildSheet( cfg );
        const budget = jitterBudget( cfg );

        expect( budget.x ).toBeLessThan( 0.3 );

        for ( let j = 0; j < sheet.rows; j++ ) {
          for ( let i = 0; i < sheet.columns; i++ ) {
            const k = j * sheet.columns + i;

            expect( Math.abs( sheet.px[ k ] - i ) ).toBeLessThanOrEqual( budget.x + 1e-6 );
            expect( Math.abs( sheet.pz[ k ] - j ) ).toBeLessThanOrEqual( budget.z + 1e-6 );
          }
        }
      }
    );

    it(
      "staggers a hex lattice by a quarter cell per row parity and packs its rows",
      () => {
        const sheet = buildSheet( {
          ...cfg,
          layout: "hex",
          jitter: 0
        } );

        expect( sheet.rowScale ).toBeCloseTo(
          HEX_ROW_SCALE,
          9
        );

        for ( let j = 0; j < sheet.rows; j++ ) {
          for ( let i = 0; i < sheet.columns; i++ ) {
            const k = j * sheet.columns + i;

            expect( sheet.px[ k ] ).toBeCloseTo(
              i + ( j % 2 === 1 ? HEX_OFFSET : -HEX_OFFSET ),
              9
            );
            // Float32 storage: 5 places is the honest precision.
            expect( sheet.pz[ k ] ).toBeCloseTo(
              j * HEX_ROW_SCALE,
              5
            );
          }
        }

        // Six neighbours at distance 1: east, and the two lower ones.
        const k = 1 * sheet.columns + 3; // odd row
        const east = k + 1;
        const south = k + sheet.columns;
        const southEast = k + sheet.columns + 1;
        const dist = (
          a: number, b: number
        ) => Math.hypot(
          sheet.px[ a ] - sheet.px[ b ],
          sheet.pz[ a ] - sheet.pz[ b ]
        );

        expect( dist(
          k,
          east
        ) ).toBeCloseTo(
          1,
          5
        );
        expect( dist(
          k,
          south
        ) ).toBeCloseTo(
          1,
          5
        );
        expect( dist(
          k,
          southEast
        ) ).toBeCloseTo(
          1,
          5
        );
      }
    );

    it(
      "is memoised on its parameters",
      () => {
        expect( getSheet( cfg ) ).toBe( getSheet( {
          ...cfg
        } ) );
        expect( getSheet( cfg ) ).not.toBe( getSheet( {
          ...cfg,
          seed: 9
        } ) );
      }
    );
  }
);

describe(
  "sheetDriftAt",
  () => {
    const cfg = {
      amplitude: 0.1,
      cycles: 2,
      scale: 0.25,
      seed: 3
    };

    it(
      "closes on the loop and stays inside its amplitude",
      () => {
        const start = sheetDriftAt(
          4,
          5,
          0,
          cfg
        );
        const end = sheetDriftAt(
          4,
          5,
          1,
          cfg
        );

        expect( start[ 0 ] ).toBeCloseTo(
          end[ 0 ],
          9
        );
        expect( start[ 1 ] ).toBeCloseTo(
          end[ 1 ],
          9
        );

        for ( let t = 0; t < 1; t += 0.05 ) {
          const d = sheetDriftAt(
            4,
            5,
            t,
            cfg
          );

          expect( Math.abs( d[ 0 ] ) ).toBeLessThanOrEqual( 0.1 );
          expect( Math.abs( d[ 1 ] ) ).toBeLessThanOrEqual( 0.1 );
        }
      }
    );

    it(
      "is nothing at amplitude 0",
      () => {
        expect( sheetDriftAt(
          1,
          1,
          0.3,
          {
            ...cfg,
            amplitude: 0
          }
        ) ).toEqual( [
          0,
          0
        ] );
      }
    );
  }
);

describe(
  "rateFor",
  () => {
    it(
      "covers 95% of the distance in the given seconds, whatever the frame step",
      () => {
        expect( rateFor(
          0.016,
          0
        ) ).toBe( 1 );
        expect( rateFor(
          0.5,
          0.5
        ) ).toBeCloseTo(
          0.95,
          2
        );

        const settle = ( dt: number ) => {
          let h = 0;

          for ( let t = 0; t < 1 - 1e-9; t += dt ) {
            h += ( 1 - h ) * rateFor(
              dt,
              0.4
            );
          }

          return h;
        };

        expect( Math.abs( settle( 1 / 30 ) - settle( 1 / 60 ) ) ).toBeLessThan( 1e-3 );
      }
    );
  }
);

describe(
  "integrateHeights",
  () => {
    it(
      "rises toward the target, holds, then falls",
      () => {
        const st = createHeightState( 1 );
        const cfg = {
          rise: 0.2,
          fall: 0.4,
          hold: 0.3
        };
        const dt = 1 / 60;

        st.targets[ 0 ] = 1;

        for ( let t = 0; t < 0.4; t += dt ) {
          integrateHeights(
            st,
            dt,
            cfg
          );
        }

        expect( st.heights[ 0 ] ).toBeGreaterThan( 0.95 );

        const peak = st.heights[ 0 ];

        st.targets[ 0 ] = 0;

        for ( let t = 0; t < 0.25; t += dt ) {
          integrateHeights(
            st,
            dt,
            cfg
          );
        }

        // Still on hold.
        expect( st.heights[ 0 ] ).toBe( peak );

        for ( let t = 0; t < 0.6; t += dt ) {
          integrateHeights(
            st,
            dt,
            cfg
          );
        }

        expect( st.heights[ 0 ] ).toBeLessThan( 0.05 );

        for ( let t = 0; t < 2; t += dt ) {
          integrateHeights(
            st,
            dt,
            cfg
          );
        }

        // Snaps to exactly 0 once it is below a step of the texture.
        expect( st.heights[ 0 ] ).toBe( 0 );
      }
    );
  }
);

describe(
  "computeTargets",
  () => {
    it(
      "delays a node by its rank's share of the stagger, and forgets it when the presence goes",
      () => {
        const st = createHeightState( 2 );
        const ranks = new Float32Array( [
          0,
          1
        ] );

        st.presence.fill( 0.8 );

        computeTargets(
          st,
          ranks,
          0.1,
          0.5
        );
        expect( st.targets[ 0 ] ).toBeCloseTo(
          0.8,
          6
        );
        expect( st.targets[ 1 ] ).toBe( 0 );

        for ( let i = 0; i < 4; i++ ) {
          computeTargets(
            st,
            ranks,
            0.1,
            0.5
          );
        }

        expect( st.targets[ 1 ] ).toBeCloseTo(
          0.8,
          6
        );

        st.presence[ 1 ] = 0;
        computeTargets(
          st,
          ranks,
          0.1,
          0.5
        );
        expect( st.age[ 1 ] ).toBe( 0 );
        expect( st.targets[ 1 ] ).toBe( 0 );
      }
    );
  }
);

describe(
  "spreadTargets",
  () => {
    it(
      "lifts the neighbours of a lifted node, less with distance, never above the source",
      () => {
        const sheet = buildSheet( {
          columns: 5,
          rows: 5,
          layout: "square",
          jitter: 0,
          seed: 1,
          maxRadius: 0
        } );
        const targets = new Float32Array( 25 );
        const out = new Float32Array( 25 );

        targets[ 12 ] = 1; // centre

        spreadTargets(
          sheet,
          targets,
          out,
          1,
          0.5
        );

        expect( out[ 12 ] ).toBe( 1 );
        expect( out[ 11 ] ).toBeCloseTo(
          0.25,
          6
        ); // d = 1 → 0.5 × (1 - 1/2)
        expect( out[ 6 ] ).toBe( 0 ); // diagonal, d = √2 > 1
        expect( out[ 10 ] ).toBe( 0 ); // two away

        spreadTargets(
          sheet,
          targets,
          out,
          2,
          1
        );
        expect( out[ 11 ] ).toBeCloseTo(
          2 / 3,
          6
        );
        expect( out[ 10 ] ).toBeCloseTo(
          1 / 3,
          6
        );
      }
    );

    it(
      "is a copy at radius 0",
      () => {
        const sheet = buildSheet( {
          columns: 3,
          rows: 3,
          layout: "square",
          jitter: 0,
          seed: 1,
          maxRadius: 0
        } );
        const targets = new Float32Array( [
          0,
          1,
          0,
          0.5,
          0,
          0,
          0,
          0,
          0.2
        ] );
        const out = new Float32Array( 9 );

        spreadTargets(
          sheet,
          targets,
          out,
          0,
          1
        );
        expect( Array.from( out ) ).toEqual( Array.from( targets ) );
      }
    );
  }
);

describe(
  "packSheet",
  () => {
    it(
      "round-trips a height through 16 bits and centres the jitter channels",
      () => {
        const sheet = buildSheet( {
          columns: 2,
          rows: 2,
          layout: "square",
          jitter: 0,
          seed: 1,
          maxRadius: 0
        } );
        const heights = new Float32Array( [
          0,
          0.5,
          1,
          0.123456
        ] );
        const packed = packSheet(
          sheet,
          heights,
          new Uint8Array( 16 )
        );

        heights.forEach( (
          h, k
        ) => {
          expect( Math.abs( unpackHeight(
            packed,
            k
          ) - h ) ).toBeLessThanOrEqual( 1 / 65535 );
          expect( packed[ k * 4 + 2 ] ).toBe( 128 );
          expect( packed[ k * 4 + 3 ] ).toBe( 128 );
        } );

        expect( packed[ 2 * 4 ] ).toBe( 255 );
        expect( packed[ 2 * 4 + 1 ] ).toBe( 255 );
      }
    );

    it(
      "adds a drift to the jitter channels",
      () => {
        const sheet = buildSheet( {
          columns: 1,
          rows: 1,
          layout: "square",
          jitter: 0,
          seed: 1,
          maxRadius: 0
        } );
        const packed = packSheet(
          sheet,
          new Float32Array( [
            0
          ] ),
          new Uint8Array( 4 ),
          new Float32Array( [
            0.25
          ] ),
          new Float32Array( [
            -0.5
          ] )
        );

        expect( packed[ 2 ] ).toBe( Math.round( 0.75 * 255 ) );
        expect( packed[ 3 ] ).toBe( 0 );
      }
    );
  }
);

describe(
  "liftRank",
  () => {
    const entity = {
      cx: 5,
      cz: 5,
      radius: 2,
      minX: 3,
      maxX: 7,
      minZ: 3,
      maxZ: 7
    };

    it(
      "starts at the silhouette's centre for radial and at its edges for the sweeps",
      () => {
        expect( liftRank(
          "radial",
          5,
          5,
          entity
        ) ).toBe( 0 );
        expect( liftRank(
          "radial",
          7,
          5,
          entity
        ) ).toBe( 1 );
        expect( liftRank(
          "radial",
          50,
          5,
          entity
        ) ).toBe( 1 );
        expect( liftRank(
          "sweep-x",
          3,
          5,
          entity
        ) ).toBe( 0 );
        expect( liftRank(
          "sweep-x",
          7,
          5,
          entity
        ) ).toBe( 1 );
        expect( liftRank(
          "sweep-y",
          5,
          5,
          entity
        ) ).toBeCloseTo(
          0.5,
          9
        );
        expect( liftRank(
          "instant",
          7,
          7,
          entity
        ) ).toBe( 0 );
      }
    );

    it(
      "keeps noise in [0, 1] and answers 0 without an entity",
      () => {
        for ( let i = 0; i < 20; i++ ) {
          const r = liftRank(
            "noise",
            i * 1.3,
            i * 0.7,
            entity,
            4
          );

          expect( r ).toBeGreaterThanOrEqual( 0 );
          expect( r ).toBeLessThanOrEqual( 1 );
        }

        expect( liftRank(
          "radial",
          1,
          1,
          null
        ) ).toBe( 0 );
      }
    );
  }
);

describe(
  "linkGate",
  () => {
    it(
      "needs both ends by default and either under `any`",
      () => {
        expect( linkGate(
          0.5,
          0.1,
          0.2,
          "both"
        ) ).toBe( false );
        expect( linkGate(
          0.5,
          0.1,
          0.2,
          "any"
        ) ).toBe( true );
        expect( linkGate(
          0.5,
          0.4,
          0.2,
          "both"
        ) ).toBe( true );
      }
    );
  }
);

describe(
  "packTops",
  () => {
    const sheet = buildSheet( {
      columns: 12,
      rows: 9,
      layout: "hex",
      jitter: 0.1,
      seed: 4,
      maxRadius: 0.2
    } );
    const n = sheet.columns * sheet.rows;

    function blockMax(
      heights: Float32Array, k: number, reach: number
    ) {
      const i = k % sheet.columns;
      const j = Math.floor( k / sheet.columns );
      let best = 0;

      for ( let dj = -reach; dj <= reach; dj++ ) {
        for ( let di = -reach; di <= reach; di++ ) {
          const ii = i + di;
          const jj = j + dj;

          if ( ii >= 0 && jj >= 0 && ii < sheet.columns && jj < sheet.rows ) {
            best = Math.max(
              best,
              Math.min(
                1,
                heights[ jj * sheet.columns + ii ]
              )
            );
          }
        }
      }

      return best;
    }

    it(
      "packs a ceiling at or above the 5 × 5 max, within one byte, and reports the sheet's max",
      () => {
        const heights = new Float32Array( n );

        for ( let k = 0; k < n; k++ ) {
          heights[ k ] = ( ( k * 37 ) % 101 ) / 100;
        }
        heights[ 5 ] = 1.4;

        const out = new Uint8Array( n );
        const {
          max
        } = packTops(
          sheet,
          heights,
          out
        );

        expect( max ).toBe( 1 );

        for ( let k = 0; k < n; k++ ) {
          const top = out[ k ] / 255;
          const trueTop = blockMax(
            heights,
            k,
            2
          );

          expect( top ).toBeGreaterThanOrEqual( trueTop - 1e-6 );
          expect( top ).toBeLessThanOrEqual( trueTop + 1 / 255 + 1e-6 );
        }
      }
    );

    it(
      "is all zero on a resting sheet",
      () => {
        const out = new Uint8Array( n ).fill( 9 );
        const {
          max
        } = packTops(
          sheet,
          new Float32Array( n ),
          out
        );

        expect( max ).toBe( 0 );
        expect( out.every( ( v ) => v === 0 ) ).toBe( true );
      }
    );
  }
);
