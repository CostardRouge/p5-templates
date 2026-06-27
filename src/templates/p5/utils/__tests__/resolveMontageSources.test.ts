import resolveMontageSourcesImpl from "@/p5/utils/slides/morph/resolveMontageSources.js";

// The util is untyped JS; give it a call signature for the assertions below.
const resolveMontageSources = resolveMontageSourcesImpl as (
  montageSlide: any,
  allSlides: any[]
) => Array<{ id: string }>;

const slide = (
  id: string, extra: Record<string, unknown> = {}
) => ( {
  id,
  ...extra
} );

describe(
  "resolveMontageSources",
  () => {
    test(
      "\"all\" returns every other non-montage slide in deck order",
      () => {
        const montage = slide(
          "m",
          {
            transition: {
              enabled: true,
              sources: "all"
            }
          }
        );
        const all = [
          slide( "a" ),
          montage,
          slide( "b" ),
          slide(
            "other-montage",
            {
              transition: {
                enabled: true
              }
            }
          )
        ];

        const result = resolveMontageSources(
          montage,
          all
        );

        expect( result.map( ( s ) => s.id ) ).toEqual( [
          "a",
          "b"
        ] );
      }
    );

    test(
      "\"selected\" returns the listed ids in order, dropping unknown and self",
      () => {
        const montage = slide(
          "m",
          {
            transition: {
              enabled: true,
              sources: "selected",
              slideIds: [
                "b",
                "missing",
                "m",
                "a"
              ]
            }
          }
        );
        const all = [
          slide( "a" ),
          slide( "b" ),
          montage
        ];

        const result = resolveMontageSources(
          montage,
          all
        );

        expect( result.map( ( s ) => s.id ) ).toEqual( [
          "b",
          "a"
        ] );
      }
    );

    test(
      "returns an empty list when there are no other slides",
      () => {
        const montage = slide(
          "m",
          {
            transition: {
              enabled: true,
              sources: "all"
            }
          }
        );

        expect( resolveMontageSources(
          montage,
          [
            montage
          ]
        ) ).toEqual( [] );
      }
    );

    test(
      "returns a single source when only one other slide qualifies",
      () => {
        const montage = slide(
          "m",
          {
            transition: {
              enabled: true,
              sources: "selected",
              slideIds: [
                "a"
              ]
            }
          }
        );
        const all = [
          slide( "a" ),
          montage
        ];

        expect( resolveMontageSources(
          montage,
          all
        ).map( ( s ) => s.id ) ).toEqual( [
          "a"
        ] );
      }
    );
  }
);
