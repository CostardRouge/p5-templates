/**
 * What the catalogue tells a caption about a sketch.
 */

import {
  publishFacts, rankIn, versionOf
} from "../facts";

describe(
  "a sketch's facts",
  () => {
    it(
      "reads the version and the place in the series, v2 before v10",
      () => {
        expect( versionOf( "churros-v11-perspective" ) ).toBe( 11 );
        expect( versionOf( "voronoi-cells" ) ).toBeNull();
        expect( rankIn(
          "churros-v10-tracer",
          [
            "churros-v10-tracer",
            "churros-v2-string",
            "churros-v1-circle"
          ]
        ) ).toEqual( {
          rank: 3,
          of: 3
        } );
      }
    );

    it(
      "gives a catalogued sketch its category, rank and date",
      () => {
        const f = publishFacts(
          "iridescent-v7-peaks-shell",
          "p5",
          {
            duration: 12,
            framerate: 30
          }
        );

        expect( f ).toMatchObject( {
          title: "Iridescent · Peaks shell",
          category: "Iridescent",
          categorySlug: "iridescent",
          version: 7,
          fps: "30",
          slides: 1
        } );
        expect( f.rank ).toBeGreaterThan( 0 );
        expect( f.of ).toBeGreaterThanOrEqual( f.rank as number );
        expect( f.created ).toMatch( /^2026-/ );
      }
    );
  }
);
