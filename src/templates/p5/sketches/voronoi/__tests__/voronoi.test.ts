/**
 * Unit tests for the voronoi maths shared module.
 *
 * Covers the nearest-site query, the swappable distance metrics, and the
 * interaction → sites helpers. getP5 is mocked because the pure maths under test
 * never touch p5 (only the drift motion mode does).
 */
jest.mock(
  "@/p5/utils/sketch.js",
  () => ( {
    getP5: () => ( {
      noise: () => 0.5
    } )
  } ),
  {
    virtual: true
  }
);

import {
  METRICS,
  nearestTwo,
  pointersToSites,
  combineSites
} from "@/p5/sketches/voronoi/_voronoi.js";

describe(
  "distance metrics",
  () => {
    it(
      "euclidean returns the squared distance",
      () => {
        expect( METRICS.euclidean(
          3,
          4
        ) ).toBe( 25 );
      }
    );

    it(
      "manhattan and chebyshev use the expected norms",
      () => {
        expect( METRICS.manhattan(
          3,
          -4
        ) ).toBe( 7 );
        expect( METRICS.chebyshev(
          3,
          -4
        ) ).toBe( 4 );
      }
    );
  }
);

describe(
  "nearestTwo",
  () => {
    it(
      "finds the nearest and second-nearest sites",
      () => {
        const sites = [
          {
            x: 0,
            y: 0
          },
          {
            x: 100,
            y: 0
          },
          {
            x: 10,
            y: 0
          }
        ];
        const result = {
          i1: -1,
          d1: 0,
          i2: -1,
          d2: 0
        };

        nearestTwo(
          sites,
          2,
          0,
          METRICS.euclidean,
          3,
          result
        );

        // Closest is site 0 (d=4), second is site 2 (d=64).
        expect( result.i1 ).toBe( 0 );
        expect( result.i2 ).toBe( 2 );
        expect( result.d1 ).toBeLessThan( result.d2 );
      }
    );
  }
);

describe(
  "interaction → sites",
  () => {
    it(
      "pointersToSites positions sites and assigns distinct hues",
      () => {
        const sites = pointersToSites(
          [
            {
              x: 5,
              y: 6
            },
            {
              x: 7,
              y: 8
            }
          ],
          0
        );

        expect( sites[ 0 ].x ).toBe( 5 );
        expect( sites[ 0 ].y ).toBe( 6 );

        for ( const site of sites ) {
          expect( site.colorT ).toBeGreaterThanOrEqual( 0 );
          expect( site.colorT ).toBeLessThan( 1 );
        }

        expect( sites[ 0 ].colorT ).not.toBe( sites[ 1 ].colorT );
      }
    );

    it(
      "combineSites honours add / replace / off",
      () => {
        const proc = [
          {
            x: 0,
            y: 0,
            colorT: 0.5
          }
        ];
        const pointers = [
          {
            x: 1,
            y: 1
          }
        ];

        expect( combineSites(
          proc,
          pointers,
          "add"
        ) ).toHaveLength( 2 );
        expect( combineSites(
          proc,
          pointers,
          "replace"
        ) ).toHaveLength( 1 );
        expect( combineSites(
          proc,
          pointers,
          "off"
        ) ).toBe( proc );
        expect( combineSites(
          proc,
          [],
          "add"
        ) ).toBe( proc );
      }
    );
  }
);
