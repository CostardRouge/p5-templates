import {
  buildEmbedHash,
  decodeEmbedOptions,
  encodeEmbedOptions,
  parseEmbedHash
} from "@/lib/embedOptions";

describe(
  "embedOptions codec",
  () => {
    it(
      "round-trips a nested delta through encode/decode",
      () => {
        const delta = {
          noise: {
            seed: 42,
            falloff: 0.6
          },
          grid: {
            rows: 120
          },
          backgroundColor: [
            0,
            0,
            0,
            255
          ]
        };

        expect( decodeEmbedOptions( encodeEmbedOptions( delta ) ) ).toEqual( delta );
      }
    );

    it(
      "produces a URL-safe token (no +, /, or = padding)",
      () => {
        const token = encodeEmbedOptions( {
          a: "?&=/+ ",
          b: "ïüçé"
        } );

        expect( token ).not.toMatch( /[+/=]/ );
      }
    );

    it(
      "is unicode-safe",
      () => {
        const delta = {
          label: "café — naïve — 日本語 — 🎨"
        };

        expect( decodeEmbedOptions( encodeEmbedOptions( delta ) ) ).toEqual( delta );
      }
    );

    it(
      "returns null for malformed input instead of throwing",
      () => {
        expect( decodeEmbedOptions( "not-valid-base64!!!" ) ).toBeNull();
        expect( decodeEmbedOptions( encodeEmbedOptions( [
          1,
          2
        ] as unknown as Record<string, unknown> ) ) ).toBeNull(); // arrays rejected
        expect( decodeEmbedOptions( "" ) ).toBeNull();
      }
    );

    it(
      "parses a full hash into options and controls",
      () => {
        const hash = buildEmbedHash(
          {
            noise: {
              seed: 7
            }
          },
          [
            "noise.seed",
            "grid.rows"
          ]
        );

        const parsed = parseEmbedHash( hash );

        expect( parsed.options ).toEqual( {
          noise: {
            seed: 7
          }
        } );
        expect( parsed.controls ).toEqual( [
          "noise.seed",
          "grid.rows"
        ] );
      }
    );

    it(
      "tolerates a leading # and missing keys",
      () => {
        expect( parseEmbedHash( "" ) ).toEqual( {
          options: null,
          controls: null
        } );
        expect( parseEmbedHash( "#" ) ).toEqual( {
          options: null,
          controls: null
        } );

        const controlsOnly = parseEmbedHash( "#c=a.b , c.d ,," );

        expect( controlsOnly.options ).toBeNull();
        expect( controlsOnly.controls ).toEqual( [
          "a.b",
          "c.d"
        ] );
      }
    );

    it(
      "builds an empty hash when there is nothing to encode",
      () => {
        expect( buildEmbedHash( {} ) ).toBe( "" );
        expect( buildEmbedHash(
          {},
          []
        ) ).toBe( "" );
      }
    );
  }
);
