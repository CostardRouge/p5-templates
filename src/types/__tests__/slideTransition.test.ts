import {
  SlideSchema, SlideTransitionSchema
} from "@/types/sketch.types";

describe(
  "SlideSchema id backfill",
  () => {
    test(
      "mints a non-empty id when none is provided",
      () => {
        const a = SlideSchema.parse( {} );
        const b = SlideSchema.parse( {} );

        expect( typeof a.id ).toBe( "string" );
        expect( a.id.length ).toBeGreaterThan( 0 );
        // Each parse mints a distinct id.
        expect( a.id ).not.toBe( b.id );
      }
    );

    test(
      "preserves an existing id",
      () => {
        expect( SlideSchema.parse( {
          id: "keep-me"
        } ).id ).toBe( "keep-me" );
      }
    );
  }
);

describe(
  "SlideTransitionSchema",
  () => {
    test(
      "applies sensible defaults",
      () => {
        const t = SlideTransitionSchema.parse( {} );

        expect( t.enabled ).toBe( false );
        expect( t.sources ).toBe( "all" );
        expect( t.slideIds ).toEqual( [] );
        expect( t.style ).toBe( "morph" );
        expect( t.loop ).toBe( "cyclic" );
        expect( t.holdRatio ).toBeGreaterThanOrEqual( 0 );
        expect( t.stagger ).toBe( 0 );
        expect( t.snapKeys ).toEqual( [
          "seed"
        ] );
        expect( t.dipColor ).toEqual( [
          0,
          0,
          0
        ] );
      }
    );

    test(
      "rejects out-of-range holdRatio",
      () => {
        expect( SlideTransitionSchema.safeParse( {
          holdRatio: 2
        } ).success ).toBe( false );
      }
    );

    test(
      "rejects invalid loop / sources enums",
      () => {
        expect( SlideTransitionSchema.safeParse( {
          loop: "spin"
        } ).success ).toBe( false );
        expect( SlideTransitionSchema.safeParse( {
          sources: "everything"
        } ).success ).toBe( false );
      }
    );
  }
);
