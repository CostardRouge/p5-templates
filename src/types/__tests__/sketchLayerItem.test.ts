/**
 * Guards the "sketch" content item — a whole other sketch, embedded as a layer.
 *
 * Like every content item it is spread across places that must agree: the Zod
 * schema, the discriminated union, `makeDefaultItem`, and the form field-config.
 * This one has one deliberate exception the drift test has to encode: `settings`
 * has NO field-config entry, because the embedded sketch's parameters have no
 * fixed shape — they are rendered from whichever sketch the layer runs (see
 * EmbeddedSketchFields). An orphan-field check that did not know that would
 * either fail here or, worse, be "fixed" by inventing a static config for it.
 */

import {
  ContentItemSchema, SketchLayerItemSchema
} from "@/types/sketch.types";
import makeDefaultItem
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/utils/makeDefaultItem";
import {
  formConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

describe(
  "sketch content item",
  () => {
    it(
      "applies defaults that composite rather than cover",
      () => {
        const item = SketchLayerItemSchema.parse( {
          type: "sketch"
        } );

        expect( item ).toMatchObject( {
          type: "sketch",
          sketch: "",
          enabled: true,
          scale: 1,
          rotation: 0,
          aspectRatio: "canvas",
          // The historical meaning of `scale`: the layer's box IS the embedded
          // sketch's canvas, so the sketch re-lays itself out for it.
          sizing: "reflow",
          resolution: 1,
          framerate: 0,
          opacity: 1,
          blend: "source-over",
          // A layer runs in step with the page until it is told otherwise:
          // freezing and offsetting are both opt-in, and their defaults are
          // what every layer written before them keeps.
          play: true,
          progression: 0,
          // The two that decide whether a layer reads as a layer at all: an
          // embedded sketch must not paint its own background over what is
          // below it, and must start each frame from a clean buffer.
          drawBackground: false,
          clearEachFrame: true
        } );
        expect( item.position ).toEqual( {
          x: 0.5,
          y: 0.5
        } );
        expect( item.settings ).toEqual( {} );
      }
    );

    it(
      "carries the embedded sketch's own settings through untouched",
      () => {
        const settings = {
          grid: {
            rows: 12
          },
          backgroundColor: [
            10,
            20,
            30
          ]
        };
        const parsed = ContentItemSchema.parse( {
          type: "sketch",
          sketch: "background/background-grid",
          settings
        } );

        expect( parsed.type ).toBe( "sketch" );

        if ( parsed.type === "sketch" ) {
          expect( parsed.sketch ).toBe( "background/background-grid" );
          expect( parsed.settings ).toEqual( settings );
        }
      }
    );

    it(
      "makeDefaultItem('sketch') accepts the picker's seed",
      () => {
        const item = makeDefaultItem(
          "sketch",
          {
            sketch: "background/background-grid",
            settings: {
              columns: 9
            }
          }
        );

        expect( item ).toMatchObject( {
          type: "sketch",
          sketch: "background/background-grid"
        } );
        expect( () => ContentItemSchema.parse( item ) ).not.toThrow();
      }
    );

    it(
      "has a form-config entry for every schema field except `settings`",
      () => {
        const schemaFields = Object.keys( SketchLayerItemSchema.shape )
          .filter( ( field ) => field !== "type" && field !== "settings" );
        const configFields = Object.keys( formConfig.sketch );

        for ( const field of schemaFields ) {
          expect( configFields ).toContain( field );
        }

        expect( configFields ).not.toContain( "settings" );
      }
    );

    it(
      "rejects an unknown aspect ratio",
      () => {
        expect( () =>
          SketchLayerItemSchema.parse( {
            type: "sketch",
            aspectRatio: "21:9"
          } ) ).toThrow();
      }
    );
  }
);
