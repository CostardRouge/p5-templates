import {
  framerateOptionsFor,
  hasMixedSlideSizes,
  resolveRunSize,
  resolveSlideIndices,
  variantFileName,
  type ExportVariant
} from "../variants";
import type {
  SketchOption
} from "@/types/sketch.types";

function makeVariant( patch: Partial<ExportVariant> = {} ): ExportVariant {
  return {
    id: "v1",
    name: "Reel",
    kind: "video",
    size: null,
    framerate: null,
    format: "mp4",
    frameCount: 10,
    slides: "current",
    delivery: "separate",
    sizeStrategy: "smallest",
    ...patch
  };
}

const DECK = {
  size: {
    width: 1080,
    height: 1350
  },
  animation: {
    duration: 12,
    framerate: 60
  },
  slides: [
    {
      id: "a",
      size: {
        width: 1080,
        height: 1080
      }
    },
    {
      id: "b",
      size: {
        width: 1080,
        height: 1920
      }
    },
    {
      id: "c"
    }
  ]
} as unknown as SketchOption;

describe(
  "framerateOptionsFor",
  () => {
    it(
      "never offers a rate above the sketch's own — an export is a resample, not an interpolation",
      () => {
        expect( framerateOptionsFor( 30 ) ).toEqual( [
          1,
          5,
          10,
          24,
          25,
          30
        ] );
      }
    );

    it(
      "keeps a native rate that is not on the ladder reachable",
      () => {
        expect( framerateOptionsFor( 45 ) ).toContain( 45 );
      }
    );
  }
);

describe(
  "resolveSlideIndices",
  () => {
    it(
      "collapses to a single unslided run when the sketch has no slides",
      () => {
        expect( resolveSlideIndices(
          makeVariant( {
            slides: "all"
          } ),
          0,
          undefined
        ) ).toEqual( [
          undefined
        ] );
      }
    );

    it(
      "walks every slide for an all-slides variant",
      () => {
        expect( resolveSlideIndices(
          makeVariant( {
            slides: "all"
          } ),
          3,
          1
        ) ).toEqual( [
          0,
          1,
          2
        ] );
      }
    );

    it(
      "falls back to the active slide when a hand-picked list has gone stale",
      () => {
        expect( resolveSlideIndices(
          makeVariant( {
            slides: [
              7,
              9
            ]
          } ),
          3,
          2
        ) ).toEqual( [
          2
        ] );
      }
    );
  }
);

describe(
  "resolveRunSize",
  () => {
    it(
      "lets an explicit variant size win over every per-slide override",
      () => {
        expect( resolveRunSize(
          makeVariant( {
            size: {
              width: 1080,
              height: 1920
            }
          } ),
          DECK,
          [
            0,
            1,
            2
          ]
        ) ).toEqual( {
          width: 1080,
          height: 1920
        } );
      }
    );

    it(
      "reconciles differing slide sizes by the chosen strategy",
      () => {
        const slides = [
          0,
          1,
          2
        ];

        expect( resolveRunSize(
          makeVariant( {
            sizeStrategy: "smallest"
          } ),
          DECK,
          slides
        ) ).toEqual( {
          width: 1080,
          height: 1080
        } );

        expect( resolveRunSize(
          makeVariant( {
            sizeStrategy: "biggest"
          } ),
          DECK,
          slides
        ) ).toEqual( {
          width: 1080,
          height: 1920
        } );

        expect( resolveRunSize(
          makeVariant( {
            sizeStrategy: "root"
          } ),
          DECK,
          slides
        ) ).toEqual( {
          width: 1080,
          height: 1350
        } );
      }
    );
  }
);

describe(
  "hasMixedSlideSizes",
  () => {
    it(
      "is false once the variant pins a resolution — there is nothing left to reconcile",
      () => {
        expect( hasMixedSlideSizes(
          makeVariant( {
            size: {
              width: 1080,
              height: 1920
            }
          } ),
          DECK,
          [
            0,
            1
          ]
        ) ).toBe( false );
      }
    );

    it(
      "is true when the slides disagree and the variant follows them",
      () => {
        expect( hasMixedSlideSizes(
          makeVariant(),
          DECK,
          [
            0,
            1
          ]
        ) ).toBe( true );
      }
    );
  }
);

describe(
  "variantFileName",
  () => {
    it(
      "carries the sketch, the variant and the real output dimensions",
      () => {
        expect( variantFileName(
          makeVariant( {
            name: "Instagram Reel"
          } ),
          "churros-v11",
          {
            width: 1080,
            height: 1920
          }
        ) ).toBe( "churros-v11-instagram-reel-1080x1920.mp4" );
      }
    );

    it(
      "numbers per-slide files and zips a bundle",
      () => {
        expect( variantFileName(
          makeVariant(),
          "churros",
          {
            width: 1080,
            height: 1080
          },
          {
            slideIndex: 2
          }
        ) ).toBe( "churros-reel-1080x1080-slide-3.mp4" );

        expect( variantFileName(
          makeVariant(),
          "churros",
          {
            width: 1080,
            height: 1080
          },
          {
            bundled: true
          }
        ) ).toBe( "churros-reel-1080x1080.zip" );
      }
    );
  }
);
