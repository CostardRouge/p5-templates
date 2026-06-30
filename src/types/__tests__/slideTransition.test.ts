import {
  SlideSchema, SlideTitleSchema, SlideTransitionSchema
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
        // The title overlay is always materialised (its own switch gates it).
        expect( t.title.enabled ).toBe( false );
        expect( t.title.mode ).toBe( "name" );
        expect( t.title.prefix ).toBe( "variante" );
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

describe(
  "SlideTitleSchema",
  () => {
    test(
      "applies sensible defaults mirroring the specs overlay",
      () => {
        const title = SlideTitleSchema.parse( {} );

        expect( title.enabled ).toBe( false );
        expect( title.mode ).toBe( "name" );
        expect( title.uppercase ).toBe( true );
        expect( title.showPrefix ).toBe( true );
        expect( title.prefix ).toBe( "variante" );
        expect( title.align ).toBe( "right" );
        expect( title.font ).toBe( "spaceMonoRegular" );
        expect( title.size ).toBe( 22 );
        expect( title.fill ).toEqual( [
          0,
          255,
          120
        ] );
        expect( title.style ).toBe( "plain" );
        expect( title.changeAnimation ).toBe( "fade" );
        // Defaults to the top-right corner.
        expect( title.position.x ).toBeGreaterThan( 0.5 );
        expect( title.position.y ).toBeLessThan( 0.5 );
      }
    );

    test(
      "rejects unknown mode / change-animation enums",
      () => {
        expect( SlideTitleSchema.safeParse( {
          mode: "roman"
        } ).success ).toBe( false );
        expect( SlideTitleSchema.safeParse( {
          changeAnimation: "explode"
        } ).success ).toBe( false );
      }
    );
  }
);
