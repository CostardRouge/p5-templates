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
        expect( t.title.mode ).toBe( "alphabet" );
        expect( t.title.prefix ).toBe( "VARIANT" );
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
        expect( title.mode ).toBe( "alphabet" );
        expect( title.idLength ).toBe( 8 );
        expect( title.uppercase ).toBe( true );
        expect( title.showPrefix ).toBe( true );
        expect( title.prefix ).toBe( "VARIANT" );
        expect( title.align ).toBe( "right" );
        expect( title.font ).toBe( "spaceMonoRegular" );
        expect( title.size ).toBe( 22 );
        expect( title.fill ).toEqual( [
          0,
          255,
          120
        ] );
        expect( title.style ).toBe( "bracket" );
        expect( title.changeAnimation ).toBe( "roll" );
        // Top-right corner, aligned with the specs overlay's default height.
        expect( title.position.x ).toBeGreaterThan( 0.5 );
        expect( title.position.y ).toBe( 0.06 );
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

    test(
      "heals an out-of-range position instead of failing the parse",
      () => {
        // A negative coordinate must NOT throw: initOptions wraps the whole
        // deck in a single top-level catch, so a throw here would wipe every
        // slide. The Vec2 leaf-catch snaps the bad axis back to centre.
        const parsed = SlideTitleSchema.safeParse( {
          enabled: true,
          position: {
            x: -0.4,
            y: 0.08
          }
        } );

        expect( parsed.success ).toBe( true );

        if ( parsed.success ) {
          expect( parsed.data.position.x ).toBe( 0.5 );
          expect( parsed.data.position.y ).toBe( 0.08 );
        }
      }
    );
  }
);
