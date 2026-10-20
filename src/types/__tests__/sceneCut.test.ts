/**
 * Guards the scene cut — a slide's (or the document's) entrance and exit out
 * of and into a colour plate, through the sequence item's transition
 * catalogue. The block is optional and heals in whole when switched on.
 */

import {
  OptionsSchema, SceneCutSchema, SlideSchema
} from "@/types/sketch.types";
import {
  resolveSceneCut
} from "@/p5/utils/sequence/timeline.js";
import {
  sceneCutFieldConfigs
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

describe(
  "SceneCutSchema",
  () => {
    it(
      "is off by default and fills both sides and the plate",
      () => {
        const cut = SceneCutSchema.parse( {} );

        expect( cut.enabled ).toBe( false );
        expect( cut.in.duration ).toBeGreaterThan( 0 );
        expect( cut.out.duration ).toBeGreaterThan( 0 );
        expect( cut.in.effect.kind ).toBe( "wipe" );
        expect( cut.plate.gradient ).toBe( "linear" );
      }
    );

    it(
      "is absent from a slide and from the root until asked for",
      () => {
        expect( SlideSchema.parse( {} ).cut ).toBeUndefined();
        expect( OptionsSchema.parse( {} ).cut ).toBeUndefined();

        const slide = SlideSchema.parse( {
          cut: {
            enabled: true
          }
        } );

        expect( slide.cut?.enabled ).toBe( true );
        expect( slide.cut?.in.effect.kind ).toBe( "wipe" );
      }
    );

    it(
      "has a form config for every block the panel edits",
      () => {
        for ( const key of Object.keys( SceneCutSchema.shape ).filter( ( name ) => name !== "enabled" ) ) {
          expect( sceneCutFieldConfigs ).toHaveProperty( key );
        }
      }
    );
  }
);

describe(
  "resolveSceneCut",
  () => {
    const cut = SceneCutSchema.parse( {
      enabled: true,
      in: {
        duration: 2,
        easing: "linear"
      },
      out: {
        duration: 1,
        easing: "linear"
      }
    } );

    it(
      "plays the entrance first, the exit last, nothing in between",
      () => {
        expect( resolveSceneCut(
          cut,
          0.5,
          10
        ) ).toMatchObject( {
          side: "in",
          raw: 0.25,
          mix: 0.25
        } );
        expect( resolveSceneCut(
          cut,
          5,
          10
        ) ).toBeNull();
        expect( resolveSceneCut(
          cut,
          9.5,
          10
        ) ).toMatchObject( {
          side: "out",
          raw: 0.5,
          mix: 0.5
        } );
      }
    );

    it(
      "caps each side at half the loop so they never overlap",
      () => {
        const long = SceneCutSchema.parse( {
          enabled: true,
          in: {
            duration: 10
          },
          out: {
            duration: 10
          }
        } );

        expect( resolveSceneCut(
          long,
          0.99,
          2
        )?.side ).toBe( "in" );
        expect( resolveSceneCut(
          long,
          1,
          2
        )?.side ).toBe( "out" );
      }
    );

    it(
      "is silent when disabled or without a loop",
      () => {
        expect( resolveSceneCut(
          {
            ...cut,
            enabled: false
          },
          0.5,
          10
        ) ).toBeNull();
        expect( resolveSceneCut(
          cut,
          0.5,
          0
        ) ).toBeNull();
      }
    );
  }
);
