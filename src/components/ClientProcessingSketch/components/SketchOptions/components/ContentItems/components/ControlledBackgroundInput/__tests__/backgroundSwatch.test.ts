import {
  backgroundSwatch
} from "../backgroundSwatch";

describe(
  "background swatch",
  () => {
    it(
      "paints a stored colour flat",
      () => {
        expect( backgroundSwatch( [
          10,
          20,
          30
        ] ) ).toBe( "rgba(10,20,30,1.000)" );
      }
    );

    it(
      "draws a linear value at its own angle, from its first colour to its second",
      () => {
        const swatch = backgroundSwatch( {
          kind: "linear",
          angle: 135,
          from: [
            0,
            0,
            0
          ],
          to: [
            255,
            0,
            0
          ]
        } );

        expect( swatch.startsWith( "linear-gradient(135deg, rgba(0,0,0,1.000) 0.0%" ) ).toBe( true );
        expect( swatch.endsWith( "rgba(255,0,0,1.000) 100.0%)" ) ).toBe( true );
      }
    );

    it(
      "swaps in the palette's paper when the colours come from it",
      () => {
        const swatch = backgroundSwatch(
          {
            kind: "radial",
            source: "palette",
            from: [
              0,
              0,
              0
            ],
            to: [
              0,
              0,
              0
            ]
          },
          {
            top: [
              245,
              240,
              230
            ],
            bottom: [
              234,
              227,
              212
            ]
          }
        );

        expect( swatch.startsWith( "radial-gradient(circle" ) ).toBe( true );
        expect( swatch ).toContain( "rgba(245,240,230,1.000) 0.0%" );
        expect( swatch ).toContain( "rgba(234,227,212,1.000) 100.0%" );
      }
    );
  }
);
