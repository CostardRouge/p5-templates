/**
 * Guards the "breakdown" content item wiring.
 *
 * Like every other content item, the breakdown is spread across four places
 * that must stay in agreement: the Zod schema (source of truth), the
 * discriminated union, the makeDefaultItem factory, and the form
 * field-config. If any of them drifts the item either fails to parse, can't
 * be added from the palette, or renders a form with missing/orphan fields.
 * Also locks in the strip-healing of persisted v2 items (the discarded
 * construction-animation iteration that shipped to dev decks).
 */

import {
  BreakdownBuildSchema,
  BreakdownItemSchema,
  ContentItemSchema
} from "@/types/sketch.types";
import makeDefaultItem
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/utils/makeDefaultItem";
import {
  formConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  ITEM_META,
  ITEM_ORDER
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/constants/item-kinds";

describe(
  "breakdown content item",
  () => {
    it(
      "applies the v3 defaults (specs look, visible panel)",
      () => {
        const item = BreakdownItemSchema.parse( {
          type: "breakdown"
        } );

        expect( item ).toMatchObject( {
          type: "breakdown",
          placement: "fixed",
          showHeader: true,
          showCounter: true,
          showTitle: true,
          counterMode: "numeric",
          typewriter: false,
          valueStyle: "bar",
          font: "spaceMonoRegular",
          size: 16,
          lineHeight: 1.4,
          backgroundRadius: 0
        } );
        expect( item.fill ).toEqual( [
          0,
          255,
          120
        ] );
        expect( item.backgroundColor ).toEqual( [
          0,
          0,
          0,
          128
        ] );
        expect( item.backgroundStroke ).toEqual( [
          0,
          255,
          120,
          255
        ] );
        expect( item.position ).toEqual( {
          x: 0.06,
          y: 0.08
        } );
        expect( item.build ).toMatchObject( {
          selection: "changed",
          departure: 1,
          introRatio: 0,
          outroRatio: 0.1,
          holdRatio: 0.15,
          easing: "easeInOutCubic",
          lineStagger: 0,
          snapKeys: [
            "seed"
          ],
          excludeKeys: []
        } );
      }
    );

    it(
      "is accepted by the ContentItem discriminated union",
      () => {
        const parsed = ContentItemSchema.parse( {
          type: "breakdown",
          placement: "roaming",
          build: {
            departure: 0.5
          }
        } );

        expect( parsed.type ).toBe( "breakdown" );

        if ( parsed.type === "breakdown" ) {
          expect( parsed.placement ).toBe( "roaming" );
          expect( parsed.build.departure ).toBe( 0.5 );
          expect( parsed.build.selection ).toBe( "changed" );
        }
      }
    );

    it(
      "makeDefaultItem('breakdown') round-trips through the schema",
      () => {
        const item = makeDefaultItem( "breakdown" );

        expect( item.type ).toBe( "breakdown" );
        expect( () => ContentItemSchema.parse( item ) ).not.toThrow();
      }
    );

    it(
      "is wired into the palette",
      () => {
        expect( ITEM_ORDER ).toContain( "breakdown" );
        expect( ITEM_META.breakdown ).toMatchObject( {
          label: "Breakdown"
        } );
      }
    );

    it(
      "has a form-config entry for every schema field (no orphan fields)",
      () => {
        const schemaFields = Object.keys( BreakdownItemSchema.shape ).filter( ( field ) => field !== "type" );
        const configFields = Object.keys( formConfig.breakdown );

        for ( const field of schemaFields ) {
          expect( configFields ).toContain( field );
        }

        const buildConfig = formConfig.breakdown.build as {
          fields: Record<string, unknown>;
        };
        const buildFields = Object.keys( buildConfig.fields );

        for ( const field of Object.keys( BreakdownBuildSchema.unwrap().shape ) ) {
          expect( buildFields ).toContain( field );
        }
      }
    );

    it(
      "strip-heals a persisted v2 (construction animation) item",
      () => {
        const v2Item = {
          type: "breakdown",
          intro: "how it's made",
          title: "",
          cta: "follow for more",
          build: {
            animate: true,
            startMode: "random",
            seed: 3,
            randomSpread: 1,
            concurrency: 2,
            grouped: true,
            ordering: "type",
            typeOrder: [
              "colors",
              "numbers"
            ],
            reverse: false,
            introRatio: 0.08,
            outroRatio: 0.12,
            holdRatio: 0.15,
            easing: "easeInOutCubic",
            snapKeys: [
              "seed"
            ],
            excludeKeys: []
          },
          font: "spaceMonoRegular",
          size: 22,
          lineHeight: 1.5,
          fill: [
            235,
            235,
            235
          ],
          accent: [
            0,
            255,
            120
          ],
          blend: "source-over",
          position: {
            x: 0.06,
            y: 0.08
          },
          panel: {
            enabled: true,
            background: [
              10,
              10,
              10,
              190
            ],
            padding: 1,
            radius: 12
          }
        };

        const healed = ContentItemSchema.parse( v2Item );

        expect( healed.type ).toBe( "breakdown" );

        if ( healed.type === "breakdown" ) {
          // v2-only keys stripped, v3 defaults filled in
          expect( healed ).not.toHaveProperty( "intro" );
          expect( healed ).not.toHaveProperty( "cta" );
          expect( healed ).not.toHaveProperty( "accent" );
          expect( healed ).not.toHaveProperty( "panel" );
          expect( healed.build ).not.toHaveProperty( "startMode" );
          expect( healed.build ).not.toHaveProperty( "concurrency" );
          expect( healed.build.selection ).toBe( "changed" );
          expect( healed.build.departure ).toBe( 1 );

          // shared, shape-compatible fields survive
          expect( healed.build.holdRatio ).toBe( 0.15 );
          expect( healed.size ).toBe( 22 );
        }
      }
    );

    it(
      "rejects unknown placement / selection / counter modes",
      () => {
        expect( () =>
          BreakdownItemSchema.parse( {
            type: "breakdown",
            placement: "orbiting"
          } ) ).toThrow();

        expect( () =>
          BreakdownItemSchema.parse( {
            type: "breakdown",
            build: {
              selection: "everything"
            }
          } ) ).toThrow();

        expect( () =>
          BreakdownItemSchema.parse( {
            type: "breakdown",
            counterMode: "roman"
          } ) ).toThrow();

        expect( () =>
          BreakdownItemSchema.parse( {
            type: "breakdown",
            valueStyle: "confetti"
          } ) ).toThrow();
      }
    );
  }
);
