import {
  buildEmbedHash,
  decodeEmbedOptions,
  diffSketchOptions,
  EMBED_SIZE_FILL,
  encodeEmbedOptions,
  formatEmbedSize,
  parseEmbedHash,
  parseEmbedSize,
  resolveAutoplay
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
          controls: null,
          autoplay: "on",
          size: null,
          margin: false
        } );
        expect( parseEmbedHash( "#" ) ).toEqual( {
          options: null,
          controls: null,
          autoplay: "on",
          size: null,
          margin: false
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

    it(
      "carries the autoplay policy, omitting the default 'on'",
      () => {
        expect( buildEmbedHash(
          {},
          [],
          {
            autoplay: "on"
          }
        ) ).toBe( "" );
        expect( buildEmbedHash(
          {},
          [],
          {
            autoplay: "off"
          }
        ) ).toBe( "#a=off" );
        expect( buildEmbedHash(
          {},
          [],
          {
            autoplay: "desktop"
          }
        ) ).toBe( "#a=desktop" );
      }
    );

    it(
      "round-trips autoplay through parse",
      () => {
        expect( parseEmbedHash( buildEmbedHash(
          {},
          undefined,
          {
            autoplay: "desktop"
          }
        ) ).autoplay ).toBe( "desktop" );
        expect( parseEmbedHash( "#a=bogus" ).autoplay ).toBe( "on" );
      }
    );

    it(
      "carries a fixed resolution and round-trips it",
      () => {
        const hash = buildEmbedHash(
          {},
          [],
          {
            size: {
              width: 1920,
              height: 1080
            }
          }
        );

        expect( hash ).toBe( "#s=1920x1080" );
        expect( parseEmbedHash( hash ).size ).toEqual( {
          width: 1920,
          height: 1080
        } );
      }
    );

    it(
      "carries the fill sentinel",
      () => {
        const hash = buildEmbedHash(
          {},
          [],
          {
            size: EMBED_SIZE_FILL
          }
        );

        expect( hash ).toBe( "#s=fill" );
        expect( parseEmbedHash( hash ).size ).toBe( EMBED_SIZE_FILL );
      }
    );

    it(
      "carries the margin flag, omitting the default (no margin)",
      () => {
        expect( buildEmbedHash(
          {},
          [],
          {
            margin: false
          }
        ) ).toBe( "" );

        const hash = buildEmbedHash(
          {},
          [],
          {
            margin: true
          }
        );

        expect( hash ).toBe( "#m=1" );
        expect( parseEmbedHash( hash ).margin ).toBe( true );
      }
    );
  }
);

describe(
  "parseEmbedSize",
  () => {
    it(
      "accepts the fill sentinel and a well-formed W×H",
      () => {
        expect( parseEmbedSize( EMBED_SIZE_FILL ) ).toBe( EMBED_SIZE_FILL );
        expect( parseEmbedSize( "1080x1350" ) ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );

    it(
      "rejects malformed, empty, or out-of-range values so the sketch's own size stands",
      () => {
        expect( parseEmbedSize( null ) ).toBeNull();
        expect( parseEmbedSize( "" ) ).toBeNull();
        expect( parseEmbedSize( "wide" ) ).toBeNull();
        expect( parseEmbedSize( "1080" ) ).toBeNull();
        expect( parseEmbedSize( "1080x" ) ).toBeNull();
        expect( parseEmbedSize( "-10x20" ) ).toBeNull();
        expect( parseEmbedSize( "10x10" ) ).toBeNull();
        expect( parseEmbedSize( "99999x1080" ) ).toBeNull();
      }
    );

    it(
      "round-trips through formatEmbedSize",
      () => {
        const size = {
          width: 768,
          height: 1366
        };

        expect( parseEmbedSize( formatEmbedSize( size ) ) ).toEqual( size );
        expect( formatEmbedSize( EMBED_SIZE_FILL ) ).toBe( EMBED_SIZE_FILL );
      }
    );
  }
);

describe(
  "resolveAutoplay",
  () => {
    it(
      "lets reduced-motion win over every policy",
      () => {
        for ( const policy of [
          "on",
          "off",
          "desktop"
        ] as const ) {
          expect( resolveAutoplay(
            policy,
            {
              reducedMotion: true,
              mobile: false
            }
          ) ).toBe( false );
        }
      }
    );

    it(
      "honours the explicit off policy",
      () => {
        expect( resolveAutoplay(
          "off",
          {
            reducedMotion: false,
            mobile: false
          }
        ) ).toBe( false );
      }
    );

    it(
      "runs on desktop but not mobile for the desktop policy",
      () => {
        expect( resolveAutoplay(
          "desktop",
          {
            reducedMotion: false,
            mobile: false
          }
        ) ).toBe( true );
        expect( resolveAutoplay(
          "desktop",
          {
            reducedMotion: false,
            mobile: true
          }
        ) ).toBe( false );
      }
    );

    it(
      "runs everywhere for the on policy",
      () => {
        expect( resolveAutoplay(
          "on",
          {
            reducedMotion: false,
            mobile: true
          }
        ) ).toBe( true );
      }
    );
  }
);

describe(
  "diffSketchOptions",
  () => {
    const defaults = {
      grid: {
        rows: 352,
        columns: 18
      },
      noise: {
        seed: 0,
        falloff: 0.5
      },
      backgroundColor: [
        0,
        0,
        0,
        255
      ]
    };

    it(
      "keeps only changed leaves, deeply",
      () => {
        const current = {
          grid: {
            rows: 60,
            columns: 18
          },
          noise: {
            seed: 0,
            falloff: 0.5
          },
          backgroundColor: [
            0,
            0,
            0,
            255
          ]
        };

        expect( diffSketchOptions(
          current,
          defaults
        ) ).toEqual( {
          grid: {
            rows: 60
          }
        } );
      }
    );

    it(
      "returns {} when nothing changed",
      () => {
        expect( diffSketchOptions(
          structuredCloneSafe( defaults ),
          defaults
        ) ).toEqual( {} );
      }
    );

    it(
      "ships a changed array in full",
      () => {
        const current = {
          ...defaults,
          backgroundColor: [
            10,
            20,
            30,
            255
          ]
        };

        expect( diffSketchOptions(
          current,
          defaults
        ) ).toEqual( {
          backgroundColor: [
            10,
            20,
            30,
            255
          ]
        } );
      }
    );

    it(
      "round-trips a delta back onto defaults via encode/decode",
      () => {
        const current = {
          ...defaults,
          noise: {
            seed: 7,
            falloff: 0.5
          }
        };
        const delta = diffSketchOptions(
          current,
          defaults
        );
        const decoded = decodeEmbedOptions( encodeEmbedOptions( delta ) );

        expect( decoded ).toEqual( {
          noise: {
            seed: 7
          }
        } );
      }
    );

    it(
      "treats a new key not in defaults as a change",
      () => {
        expect( diffSketchOptions(
          {
            extra: 1
          },
          {}
        ) ).toEqual( {
          extra: 1
        } );
      }
    );
  }
);

function structuredCloneSafe<T>( value: T ): T {
  return JSON.parse( JSON.stringify( value ) );
}
