import {
  applyEmbedSize, isSameSize, resolveFillSize
} from "@/lib/embedSizing";
import {
  EMBED_SIZE_MAX, EMBED_SIZE_MIN
} from "@/lib/embedOptions";

describe(
  "resolveFillSize",
  () => {
    it(
      "matches the frame exactly with no margin",
      () => {
        expect( resolveFillSize(
          800,
          451
        ) ).toEqual( {
          width: 800,
          height: 451
        } );
      }
    );

    it(
      "insets the canvas inside the frame when a margin is asked for",
      () => {
        expect( resolveFillSize(
          1000,
          500,
          0.9
        ) ).toEqual( {
          width: 900,
          height: 450
        } );
      }
    );

    it(
      "rounds to whole pixels",
      () => {
        expect( resolveFillSize(
          333.4,
          199.6
        ) ).toEqual( {
          width: 333,
          height: 200
        } );
      }
    );

    it(
      "clamps a collapsed or oversized frame into the schema's bounds",
      () => {
        expect( resolveFillSize(
          0,
          0
        ) ).toEqual( {
          width: EMBED_SIZE_MIN,
          height: EMBED_SIZE_MIN
        } );

        expect( resolveFillSize(
          99999,
          99999
        ) ).toEqual( {
          width: EMBED_SIZE_MAX,
          height: EMBED_SIZE_MAX
        } );
      }
    );
  }
);

describe(
  "applyEmbedSize",
  () => {
    const size = {
      width: 1920,
      height: 1080
    };

    it(
      "writes the size without mutating the source options",
      () => {
        const options = {
          size: {
            width: 1080,
            height: 1350
          },
          sketch: {
            seed: 3
          }
        };
        const next = applyEmbedSize(
          options,
          size
        );

        expect( next.size ).toEqual( size );
        expect( next.sketch ).toEqual( {
          seed: 3
        } );
        expect( options.size ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );

    it(
      "rewrites slide overrides, which would otherwise mask the global size",
      () => {
        const next = applyEmbedSize(
          {
            size: {
              width: 1080,
              height: 1350
            },
            slides: [
              {
                id: "a",
                size: {
                  width: 500,
                  height: 500
                }
              },
              {
                id: "b"
              }
            ]
          },
          size
        );

        expect( next.slides[ 0 ].size ).toEqual( size );
        // No override to begin with — the slide already follows the global size.
        expect( next.slides[ 1 ].size ).toBeUndefined();
      }
    );

    it(
      "leaves a slide-less options tree alone",
      () => {
        const next = applyEmbedSize(
          {
            size: {
              width: 100,
              height: 100
            },
            slides: undefined as unknown[] | undefined
          },
          size
        );

        expect( next.slides ).toBeUndefined();
      }
    );
  }
);

describe(
  "isSameSize",
  () => {
    it(
      "compares by value and treats a missing side as different",
      () => {
        expect( isSameSize(
          {
            width: 10,
            height: 20
          },
          {
            width: 10,
            height: 20
          }
        ) ).toBe( true );

        expect( isSameSize(
          {
            width: 10,
            height: 20
          },
          {
            width: 10,
            height: 21
          }
        ) ).toBe( false );

        expect( isSameSize(
          null,
          {
            width: 10,
            height: 20
          }
        ) ).toBe( false );
      }
    );
  }
);
