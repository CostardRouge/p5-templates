/**
 * Guards the two non-numeric telemetry items — "hud-readout" (a live text
 * value) and "hud-vector" (a point on a mini x/y map).
 *
 * Like every content item they are spread across four places that must stay in
 * agreement: the Zod schema (source of truth), the discriminated union,
 * `makeDefaultItem`, and the form field-config. Drift there means an item that
 * cannot be added from the palette, or renders a form with orphan fields
 * (GenericItemForm warns at runtime). The palette meta and the layers-list
 * label are checked here too; the vector map's own maths lives in
 * `hud/__tests__/vectorMap.test.ts`, away from p5.
 */

import {
  ContentItemSchema, HudReadoutItemSchema, HudVectorItemSchema
} from "@/types/sketch.types";
import makeDefaultItem
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/utils/makeDefaultItem";
import {
  formConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  ITEM_GROUPS, ITEM_META, ITEM_ORDER
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/constants/item-kinds";
import describeContentItem
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/utils/describeContentItem";

const KINDS = [
  "hud-readout",
  "hud-vector"
] as const;

describe(
  "hud-readout content item",
  () => {
    it(
      "applies sensible defaults",
      () => {
        expect( HudReadoutItemSchema.parse( {
          type: "hud-readout"
        } ) ).toMatchObject( {
          type: "hud-readout",
          enabled: true,
          // A fresh readout must print something, so it binds to the sketch
          // name rather than to an empty source.
          source: "name",
          layout: "stacked",
          uppercase: false,
          label: ""
        } );
      }
    );

    it(
      "is accepted by the ContentItem discriminated union",
      () => {
        const parsed = ContentItemSchema.parse( {
          type: "hud-readout",
          source: "font",
          layout: "inline"
        } );

        expect( parsed.type ).toBe( "hud-readout" );

        if ( parsed.type === "hud-readout" ) {
          expect( parsed.source ).toBe( "font" );
          expect( parsed.layout ).toBe( "inline" );
        }
      }
    );

    it(
      "rejects a layout it cannot draw",
      () => {
        expect( () =>
          HudReadoutItemSchema.parse( {
            type: "hud-readout",
            layout: "diagonal"
          } ) ).toThrow();
      }
    );
  }
);

describe(
  "hud-vector content item",
  () => {
    it(
      "applies sensible defaults",
      () => {
        const item = HudVectorItemSchema.parse( {
          type: "hud-vector"
        } );

        expect( item ).toMatchObject( {
          type: "hud-vector",
          enabled: true,
          // Tracks the pointer out of the box, which is in canvas pixels.
          source: "mouse",
          space: "canvas",
          coordinates: "relative",
          yDown: true,
          decimals: 2
        } );
        expect( item.offset ).toEqual( {
          x: 0.95,
          y: 0.75
        } );
      }
    );

    it(
      "keeps a negative domain, which a direction vector needs",
      () => {
        expect( HudVectorItemSchema.parse( {
          type: "hud-vector",
          space: "value",
          min: -1,
          max: 1
        } ) ).toMatchObject( {
          space: "value",
          min: -1,
          max: 1
        } );
      }
    );

    it(
      "rejects a coordinate mode it cannot print",
      () => {
        expect( () =>
          HudVectorItemSchema.parse( {
            type: "hud-vector",
            coordinates: "polar"
          } ) ).toThrow();
      }
    );
  }
);

describe(
  "the two items' wiring",
  () => {
    const schemas = {
      "hud-readout": HudReadoutItemSchema,
      "hud-vector": HudVectorItemSchema
    };

    it.each( KINDS )(
      "makeDefaultItem('%s') round-trips through the union",
      ( kind ) => {
        const item = makeDefaultItem( kind );

        expect( item.type ).toBe( kind );
        expect( () => ContentItemSchema.parse( item ) ).not.toThrow();
      }
    );

    it.each( KINDS )(
      "%s has a form-config entry for every schema field",
      ( kind ) => {
        const schemaFields = Object.keys( schemas[ kind ].shape ).filter( ( field ) => field !== "type" );
        const configFields = Object.keys( formConfig[ kind ] );

        for ( const field of schemaFields ) {
          expect( configFields ).toContain( field );
        }
      }
    );

    it.each( KINDS )(
      "%s is offered by the palette, in the HUD group",
      ( kind ) => {
        expect( ITEM_ORDER ).toContain( kind );
        expect( ITEM_META[ kind ].label ).toBeTruthy();
        expect( ITEM_GROUPS.find( ( group ) => group.kinds.includes( kind ) )?.label )
          .toBe( "HUD / telemetry" );
      }
    );

    it.each( KINDS )(
      "%s names itself in the layers list by what it watches",
      ( kind ) => {
        expect( describeContentItem( {
          type: kind,
          source: "colors.text",
          label: ""
        } ) ).toMatchObject( {
          preview: "colors.text"
        } );
      }
    );
  }
);
