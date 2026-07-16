import type {
  FieldValues, UseFormGetValues, UseFormSetValue
} from "react-hook-form";
import {
  applyToAllSlides,
  canApplyToAllSlides,
  countSlides,
  parseSlidePath
} from "../applyToAllSlides";

/* ------------------------------------------------------------------ */
/*  Minimal in-memory stand-in for the RHF getValues/setValue pair.     */
/* ------------------------------------------------------------------ */

function makeForm( initial: Record<string, unknown> ): {
  store: Record<string, unknown>;
  getValues: UseFormGetValues<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
} {
  const store = structuredClone( initial );

  const getValues = ( ( path?: string ) => {
    if ( path === undefined ) {
      return store;
    }

    return path
      .split( "." )
      .reduce<any>(
        (
          acc, key
        ) => ( acc == null ? acc : acc[ key ] ),
        store
      );
  } ) as UseFormGetValues<FieldValues>;

  const setValue = ( (
    path: string, value: unknown
  ) => {
    const keys = path.split( "." );
    const last = keys.pop() as string;
    const parent = keys.reduce<any>(
      (
        acc, key
      ) => acc[ key ],
      store
    );

    parent[ last ] = value;
  } ) as UseFormSetValue<FieldValues>;

  return {
    store,
    getValues,
    setValue
  };
}

function makeSlides() {
  return {
    slides: [
      {
        sketch: {
          colors: {
            primary: [
              10,
              10,
              10
            ]
          },
          backgroundColor: [
            0,
            0,
            0
          ]
        }
      },
      {
        sketch: {
          colors: {
            primary: [
              20,
              20,
              20
            ]
          },
          backgroundColor: [
            1,
            1,
            1
          ]
        }
      },
      {
        sketch: {
          colors: {
            primary: [
              30,
              30,
              30
            ]
          },
          backgroundColor: [
            2,
            2,
            2
          ]
        }
      }
    ]
  };
}

describe(
  "parseSlidePath",
  () => {
    it(
      "parses a nested block path",
      () => {
        expect( parseSlidePath( "slides.2.sketch.colors" ) ).toEqual( {
          index: 2,
          suffix: ".colors"
        } );
      }
    );

    it(
      "parses a deep field path",
      () => {
        expect( parseSlidePath( "slides.0.sketch.colors.primary" ) ).toEqual( {
          index: 0,
          suffix: ".colors.primary"
        } );
      }
    );

    it(
      "parses a whole-sketch path with an empty suffix",
      () => {
        expect( parseSlidePath( "slides.1.sketch" ) ).toEqual( {
          index: 1,
          suffix: ""
        } );
      }
    );

    it(
      "returns null for the global sketch path",
      () => {
        expect( parseSlidePath( "sketch.colors" ) ).toBeNull();
      }
    );
  }
);

describe(
  "countSlides / canApplyToAllSlides",
  () => {
    it(
      "counts slides",
      () => {
        const {
          getValues
        } = makeForm( makeSlides() );

        expect( countSlides( getValues ) ).toBe( 3 );
      }
    );

    it(
      "is enabled for a slide path when more than one slide exists",
      () => {
        const {
          getValues
        } = makeForm( makeSlides() );

        expect( canApplyToAllSlides(
          getValues,
          "slides.0.sketch.colors"
        ) ).toBe( true );
      }
    );

    it(
      "is disabled with a single slide",
      () => {
        const {
          getValues
        } = makeForm( {
          slides: [
            makeSlides().slides[ 0 ]
          ]
        } );

        expect( canApplyToAllSlides(
          getValues,
          "slides.0.sketch.colors"
        ) ).toBe( false );
      }
    );

    it(
      "is disabled for a global (non-slide) path",
      () => {
        const {
          getValues
        } = makeForm( makeSlides() );

        expect( canApplyToAllSlides(
          getValues,
          "sketch.colors"
        ) ).toBe( false );
      }
    );
  }
);

describe(
  "applyToAllSlides",
  () => {
    it(
      "copies a block onto every other slide and returns the count",
      () => {
        const {
          store, getValues, setValue
        } = makeForm( makeSlides() );

        const applied = applyToAllSlides(
          getValues,
          setValue,
          "slides.0.sketch.colors"
        );

        expect( applied ).toBe( 2 );

        const slides = ( store.slides as any[] );

        expect( slides[ 1 ].sketch.colors.primary ).toEqual( [
          10,
          10,
          10
        ] );
        expect( slides[ 2 ].sketch.colors.primary ).toEqual( [
          10,
          10,
          10
        ] );
        // The source slide is untouched.
        expect( slides[ 0 ].sketch.colors.primary ).toEqual( [
          10,
          10,
          10
        ] );
        // Unrelated fields on other slides are preserved.
        expect( slides[ 1 ].sketch.backgroundColor ).toEqual( [
          1,
          1,
          1
        ] );
      }
    );

    it(
      "propagates a single global field only",
      () => {
        const {
          store, getValues, setValue
        } = makeForm( makeSlides() );

        applyToAllSlides(
          getValues,
          setValue,
          "slides.1.sketch.backgroundColor"
        );

        const slides = ( store.slides as any[] );

        expect( slides[ 0 ].sketch.backgroundColor ).toEqual( [
          1,
          1,
          1
        ] );
        expect( slides[ 2 ].sketch.backgroundColor ).toEqual( [
          1,
          1,
          1
        ] );
        // colors blocks stay per-slide.
        expect( slides[ 0 ].sketch.colors.primary ).toEqual( [
          10,
          10,
          10
        ] );
        expect( slides[ 2 ].sketch.colors.primary ).toEqual( [
          30,
          30,
          30
        ] );
      }
    );

    it(
      "deep-clones so slides don't share references",
      () => {
        const {
          store, getValues, setValue
        } = makeForm( makeSlides() );

        applyToAllSlides(
          getValues,
          setValue,
          "slides.0.sketch.colors"
        );

        const slides = ( store.slides as any[] );

        expect( slides[ 1 ].sketch.colors ).not.toBe( slides[ 0 ].sketch.colors );

        // Mutating slide 1 must not bleed into slide 2.
        slides[ 1 ].sketch.colors.primary[ 0 ] = 999;
        expect( slides[ 2 ].sketch.colors.primary[ 0 ] ).toBe( 10 );
      }
    );

    it(
      "does nothing for a non-slide path",
      () => {
        const {
          getValues, setValue
        } = makeForm( makeSlides() );

        expect( applyToAllSlides(
          getValues,
          setValue,
          "sketch.colors"
        ) ).toBe( 0 );
      }
    );

    it(
      "does nothing with a single slide",
      () => {
        const {
          getValues, setValue
        } = makeForm( {
          slides: [
            makeSlides().slides[ 0 ]
          ]
        } );

        expect( applyToAllSlides(
          getValues,
          setValue,
          "slides.0.sketch.colors"
        ) ).toBe( 0 );
      }
    );
  }
);
