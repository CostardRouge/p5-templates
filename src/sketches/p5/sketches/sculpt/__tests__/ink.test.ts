/**
 * The INK's logic (`_ink.js`): what a grid of points reads off a rasterised
 * glyph — the area under a cell, the signed distance to the ink and the way a
 * stroke runs — and the contraction of the grid onto it. All pure functions
 * over a synthetic mask (no canvas, no font), so every claim the typographic
 * sculpts make about their pinch, their halftone and their dashes is checked
 * here against brute force.
 */

import {
  MAX_OFFSET,
  buildGrid,
  morphProgress,
  squeezeAt
} from "../_mesh.js";
import {
  coverageAt,
  distanceAt,
  distanceField,
  fieldOf,
  gradientAt,
  inkAt,
  lerpOrientation,
  orientationAt,
  pinchOffsets,
  sampleField
} from "../_ink.js";
import {
  cellBoundFor,
  packProps,
  unpackAngle
} from "../_trace.js";

type Mask = { data: Uint8Array;
  w: number;
  h: number;
  field?: Float32Array };

// A mask from a predicate over ( u, v ) sheet coordinates.
function maskFrom(
  w: number, h: number, ink: ( u: number, v: number ) => boolean
): Mask {
  const data = new Uint8Array( w * h );

  for ( let y = 0; y < h; y++ ) {
    for ( let x = 0; x < w; x++ ) {
      data[ y * w + x ] = ink(
        ( x + 0.5 ) / w,
        ( y + 0.5 ) / h
      ) ? 255 : 0;
    }
  }

  return {
    data,
    w,
    h
  };
}

// A vertical bar: ink where u is between the two edges.
const BAR = maskFrom(
  64,
  64,
  ( u ) => u > 0.4 && u < 0.6
);

// A disc.
const DISC = maskFrom(
  64,
  64,
  (
    u, v
  ) => Math.hypot(
    u - 0.5,
    v - 0.5
  ) < 0.25
);

// Brute-force signed distance in pixels, for a small mask.
function bruteDistance(
  mask: Mask, x: number, y: number
): number {
  const lit = mask.data[ y * mask.w + x ] > 127;
  let best = Infinity;

  for ( let yy = 0; yy < mask.h; yy++ ) {
    for ( let xx = 0; xx < mask.w; xx++ ) {
      const other = mask.data[ yy * mask.w + xx ] > 127;

      if ( other !== lit ) {
        best = Math.min(
          best,
          Math.hypot(
            xx - x,
            yy - y
          )
        );
      }
    }
  }

  return lit ? -best : best;
}

describe(
  "inkAt / coverageAt",
  () => {
    it(
      "reads a bit under the centre and an area under a box",
      () => {
        expect( inkAt(
          BAR,
          0.5,
          0.5
        ) ).toBe( 1 );
        expect( inkAt(
          BAR,
          0.1,
          0.5
        ) ).toBe( 0 );
        expect( inkAt(
          BAR,
          -0.1,
          0.5
        ) ).toBe( 0 );

        // Deep inside: full; well outside: none; astride the edge at 0.4:
        // about half.
        expect( coverageAt(
          BAR,
          0.5,
          0.5,
          0.02,
          0.02,
          4
        ) ).toBe( 1 );
        expect( coverageAt(
          BAR,
          0.1,
          0.5,
          0.02,
          0.02,
          4
        ) ).toBe( 0 );

        const edge = coverageAt(
          BAR,
          0.4,
          0.5,
          0.04,
          0.04,
          8
        );

        expect( edge ).toBeGreaterThan( 0.3 );
        expect( edge ).toBeLessThan( 0.7 );
      }
    );
  }
);

describe(
  "distanceField",
  () => {
    it(
      "matches brute force on every pixel of a disc and a bar",
      () => {
        for ( const mask of [
          DISC,
          BAR
        ] ) {
          const field = distanceField( mask );

          for ( let y = 0; y < mask.h; y += 3 ) {
            for ( let x = 0; x < mask.w; x += 3 ) {
              expect( field[ y * mask.w + x ] ).toBeCloseTo(
                bruteDistance(
                  mask,
                  x,
                  y
                ),
                5
              );
            }
          }
        }
      }
    );

    it(
      "is negative inside, positive outside, and memoised on the mask",
      () => {
        const mask = {
          ...DISC
        };
        const field = fieldOf( mask );

        expect( fieldOf( mask ) ).toBe( field );
        expect( sampleField(
          field,
          mask,
          0.5,
          0.5
        ) ).toBeLessThan( 0 );
        expect( sampleField(
          field,
          mask,
          0.05,
          0.05
        ) ).toBeGreaterThan( 0 );

        // The centre of the disc is its radius deep: 0.25 × 64 px.
        expect( sampleField(
          field,
          mask,
          0.5,
          0.5
        ) ).toBeCloseTo(
          -16,
          0
        );
      }
    );

    it(
      "handles an empty mask and a full one without dividing by zero",
      () => {
        const empty = maskFrom(
          8,
          8,
          () => false
        );
        const full = maskFrom(
          8,
          8,
          () => true
        );

        expect( distanceField( empty )[ 0 ] ).toBeGreaterThan( 1e6 );
        expect( distanceField( full )[ 0 ] ).toBeLessThan( -1e6 );
      }
    );

    it(
      "reports distances in cells of a grid",
      () => {
        const grid = buildGrid( {
          cols: 16,
          aspect: 1,
          jitter: 0
        } );

        // 64 px / 16 cols = 4 px per cell; the bar's edge at u = 0.4 is 0.3
        // sheet = 19.2 px = 4.8 cells from u = 0.1.
        expect( distanceAt(
          BAR,
          grid,
          0.1,
          0.5
        ) ).toBeCloseTo(
          4.8,
          0
        );
      }
    );
  }
);

describe(
  "gradientAt / orientationAt",
  () => {
    it(
      "points away from the ink outside it and toward the outline inside",
      () => {
        const field = fieldOf( BAR );
        const g = new Float32Array( 2 );

        gradientAt(
          field,
          BAR,
          0.2,
          0.5,
          g
        );
        // Left of the bar: the ink is to the right, the distance grows to the left.
        expect( g[ 0 ] ).toBeLessThan( -0.9 );
        expect( Math.abs( g[ 1 ] ) ).toBeLessThan( 0.05 );

        gradientAt(
          field,
          BAR,
          0.45,
          0.5,
          g
        );
        // Inside, left of the axis: the outline is to the left.
        expect( g[ 0 ] ).toBeLessThan( -0.9 );

        gradientAt(
          field,
          BAR,
          0.5,
          0.5,
          g
        );
        // On the axis the two sides cancel.
        expect( Math.abs( g[ 0 ] ) ).toBeLessThan( 0.2 );
      }
    );

    it(
      "finds a vertical bar running along v, with full strength on the stroke",
      () => {
        const field = fieldOf( BAR );
        const on = orientationAt(
          field,
          BAR,
          0.45,
          0.5,
          0.03,
          1
        );

        expect( on.angle ).toBeCloseTo(
          Math.PI / 2,
          1
        );
        expect( on.strength ).toBeGreaterThan( 0.9 );

        // Beside the bar the iso-lines still run along it.
        const beside = orientationAt(
          field,
          BAR,
          0.3,
          0.5,
          0.03,
          1
        );

        expect( beside.angle ).toBeCloseTo(
          Math.PI / 2,
          1
        );
      }
    );

    it(
      "gives a disc's rim its tangent, whichever side the sample sits",
      () => {
        const field = fieldOf( DISC );
        const right = orientationAt(
          field,
          DISC,
          0.72,
          0.5,
          0.03,
          1
        );
        const top = orientationAt(
          field,
          DISC,
          0.5,
          0.28,
          0.03,
          1
        );

        // At the right of the disc the rim runs up-down; at the top, left-right.
        expect( right.angle ).toBeCloseTo(
          Math.PI / 2,
          1
        );
        expect( Math.min(
          top.angle,
          Math.PI - top.angle
        ) ).toBeLessThan( 0.15 );
      }
    );
  }
);

describe(
  "lerpOrientation",
  () => {
    it(
      "takes the shorter way round between two undirected angles",
      () => {
        expect( lerpOrientation(
          0.1,
          Math.PI - 0.1,
          0.5
        ) ).toBeCloseTo(
          0,
          6
        );
        expect( lerpOrientation(
          0,
          1,
          0.5
        ) ).toBeCloseTo(
          0.5,
          6
        );
        expect( lerpOrientation(
          1,
          1,
          0.3
        ) ).toBeCloseTo(
          1,
          6
        );
      }
    );
  }
);

describe(
  "pinchOffsets",
  () => {
    const grid = buildGrid( {
      cols: 32,
      aspect: 1,
      jitter: 0
    } );

    it(
      "slides points toward the ink from outside, toward the axis from inside, and leaves the rest",
      () => {
        const outX = new Float32Array( grid.count );
        const outZ = new Float32Array( grid.count );
        const moved = new Float32Array( grid.count );

        pinchOffsets(
          grid,
          BAR,
          {
            pull: 0.4,
            reach: 3,
            inside: 1
          },
          outX,
          outZ,
          moved
        );

        const row = 16;
        const at = ( i: number ) => row * grid.cols + i;

        // Column 11 (u ≈ 0.36) is one cell outside the left edge (u = 0.4):
        // it moves right, by less than the pull and never past the edge.
        expect( outX[ at( 11 ) ] ).toBeGreaterThan( 0.05 );
        expect( outX[ at( 11 ) ] ).toBeLessThanOrEqual( 0.4 );
        expect( moved[ at( 11 ) ] ).toBeGreaterThan( 0 );

        // Column 20 (u ≈ 0.64) is just outside the right edge: it moves left.
        expect( outX[ at( 20 ) ] ).toBeLessThan( -0.05 );

        // Column 13 (u ≈ 0.42) is inside, left of the axis: toward the axis (right).
        expect( outX[ at( 13 ) ] ).toBeGreaterThan( 0.05 );

        // Column 2 is far away: untouched.
        expect( outX[ at( 2 ) ] ).toBe( 0 );
        expect( moved[ at( 2 ) ] ).toBe( 0 );

        // Nothing moves across rows for a vertical bar, and nothing leaves its cell.
        for ( let n = 0; n < grid.count; n++ ) {
          expect( Math.abs( outZ[ n ] ) ).toBeLessThan( 0.05 );
          expect( Math.abs( outX[ n ] ) ).toBeLessThanOrEqual( MAX_OFFSET );
        }
      }
    );

    it(
      "contracts the spacing on the ink: neighbours end up closer than a cell",
      () => {
        const outX = new Float32Array( grid.count );
        const outZ = new Float32Array( grid.count );

        pinchOffsets(
          grid,
          BAR,
          {
            pull: 0.45,
            reach: 3,
            inside: 1
          },
          outX,
          outZ
        );

        const row = 16;
        const at = ( i: number ) => row * grid.cols + i;
        // Across the bar (columns 12 … 19), the span between the outermost
        // pinched points is shorter than at rest.
        const restSpan = 19 - 12;
        const pinchedSpan = ( 19 + outX[ at( 19 ) ] ) - ( 12 + outX[ at( 12 ) ] );

        expect( pinchedSpan ).toBeLessThan( restSpan - 0.5 );
      }
    );

    it(
      "is the plain jitter with no pull",
      () => {
        const jittered = buildGrid( {
          cols: 16,
          aspect: 1,
          jitter: 0.5,
          seed: 3
        } );
        const outX = new Float32Array( jittered.count );
        const outZ = new Float32Array( jittered.count );

        pinchOffsets(
          jittered,
          BAR,
          {
            pull: 0,
            reach: 3
          },
          outX,
          outZ
        );

        expect( Array.from( outX ) ).toEqual( Array.from( jittered.jx ) );
        expect( Array.from( outZ ) ).toEqual( Array.from( jittered.jz ) );
      }
    );
  }
);

describe(
  "morphProgress / squeezeAt",
  () => {
    const linear = ( x: number ) => x;

    it(
      "is 0 through the hold, follows the rise order into the next unit and the fall order out of the current",
      () => {
        const a = {
          target: new Float32Array( [
            1,
            1,
            0,
            0
          ] ),
          order: new Float32Array( [
            0,
            1,
            0,
            0
          ] )
        };
        const b = {
          target: new Float32Array( [
            0,
            0,
            1,
            1
          ] ),
          order: new Float32Array( [
            0,
            0,
            0,
            1
          ] )
        };
        const out = new Float32Array( 4 );
        const rhythm = {
          hold: 0.5,
          rise: {
            spread: 0.9,
            ease: linear
          },
          fall: {
            spread: 0.9,
            ease: linear,
            mirror: true
          }
        };

        expect( morphProgress(
          [
            a,
            b
          ],
          0.25,
          rhythm,
          out
        ).q ).toBe( 0 );
        expect( Array.from( out ) ).toEqual( [
          0,
          0,
          0,
          0
        ] );

        // Half way through the handover: in B, point 2 (order 0) leads
        // point 3 (order 1); leaving A, the mirrored order sends point 1
        // (rise order 1 → fall order 0) first.
        const stage = morphProgress(
          [
            a,
            b
          ],
          0.75,
          rhythm,
          out
        );

        expect( stage.q ).toBeCloseTo(
          0.5,
          6
        );
        expect( out[ 2 ] ).toBeGreaterThan( out[ 3 ] );
        expect( out[ 1 ] ).toBeGreaterThan( out[ 0 ] );

        // The end of the beat: everything has arrived.
        morphProgress(
          [
            a,
            b
          ],
          0.999999,
          rhythm,
          out
        );
        expect( out[ 2 ] ).toBeCloseTo(
          1,
          3
        );
        expect( out[ 0 ] ).toBeCloseTo(
          1,
          3
        );
      }
    );

    it(
      "squeezes to a dip at the middle, pops in the second half and is 1 at both ends",
      () => {
        expect( squeezeAt(
          0,
          0.6,
          0.3
        ) ).toBe( 1 );
        expect( squeezeAt(
          1,
          0.6,
          0.3
        ) ).toBe( 1 );
        expect( squeezeAt(
          0.3,
          0.6,
          0.3
        ) ).toBeCloseTo(
          0.4,
          6
        );
        expect( squeezeAt(
          0.8,
          0.6,
          0.3
        ) ).toBeCloseTo(
          1.3,
          6
        );
        expect( squeezeAt(
          0.5,
          0,
          0
        ) ).toBe( 1 );
      }
    );
  }
);

describe(
  "_trace packing and bounds",
  () => {
    it(
      "packs radius, angle (mod π) and length to bytes the shader decodes",
      () => {
        const grid = buildGrid( {
          cols: 4,
          aspect: 1,
          jitter: 0
        } );
        const radius = new Float32Array( grid.count ).fill( 0.5 );
        const angle = new Float32Array( grid.count );
        const length = new Float32Array( grid.count ).fill( 1.2 );
        const out = new Uint8Array( grid.count * 4 );

        angle[ 0 ] = Math.PI / 2;
        angle[ 1 ] = Math.PI / 2 + Math.PI;
        angle[ 2 ] = -Math.PI / 2;

        packProps(
          grid,
          radius,
          angle,
          length,
          out
        );

        expect( out[ 0 ] ).toBe( 128 );
        expect( out[ 2 ] ).toBe( 255 );
        // Within half a byte step (π / 255) of the angle packed.
        expect( Math.abs( unpackAngle( out[ 1 ] ) - Math.PI / 2 ) ).toBeLessThan( Math.PI / 255 );
        // Turned by π, or negated: the same dash — to within a byte, since
        // the angles travel as float32 and -π / 2 + π rounds the other way.
        expect( Math.abs( out[ 5 ] - out[ 1 ] ) ).toBeLessThanOrEqual( 1 );
        expect( Math.abs( out[ 9 ] - out[ 1 ] ) ).toBeLessThanOrEqual( 1 );
      }
    );

    it(
      "shortens the cell bound as the primitives widen, and never below the floor",
      () => {
        expect( cellBoundFor(
          0.05,
          "links"
        ) ).toBe( 1 );
        // Links: 2 − 0.45 − 0.5 − reach.
        expect( cellBoundFor(
          0.4,
          "links"
        ) ).toBeCloseTo(
          0.65,
          6
        );
        expect( cellBoundFor(
          3,
          "links"
        ) ).toBe( 0.35 );
        // Oriented primitives: one cell more room, 3 − 0.45 − 0.5 − reach.
        expect( cellBoundFor(
          1.2,
          "oriented"
        ) ).toBeCloseTo(
          0.85,
          6
        );
      }
    );
  }
);
