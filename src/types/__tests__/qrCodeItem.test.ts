/**
 * Guards the "qrcode" content item wiring.
 *
 * A QR item, like every other content item, is spread across four places that
 * must stay in agreement: the Zod schema (source of truth), the discriminated
 * union, the makeDefaultItem factory, and the form field-config. If any of
 * them drifts the item either fails to parse, can't be added from the palette,
 * or renders a form with missing/orphan fields (GenericItemForm warns at
 * runtime). These tests catch that drift at build time instead.
 */

import {
  ContentItemSchema, QrCodeItemSchema
} from "@/types/sketch.types";
import makeDefaultItem
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/components/AddItemControls/utils/makeDefaultItem";
import {
  formConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

describe(
  "qrcode content item",
  () => {
    it(
      "applies sensible defaults",
      () => {
        const item = QrCodeItemSchema.parse( {
          type: "qrcode"
        } );

        expect( item ).toMatchObject( {
          type: "qrcode",
          domainOverride: "",
          size: 0.22,
          quietZone: 4,
          errorCorrection: "M",
          showUrl: true,
          urlFont: "spaceMonoRegular"
        } );
        expect( item.position ).toEqual( {
          x: 0.5,
          y: 0.82
        } );
        expect( item.foreground ).toEqual( [
          0,
          0,
          0
        ] );
        expect( item.background ).toEqual( [
          255,
          255,
          255,
          255
        ] );
      }
    );

    it(
      "is accepted by the ContentItem discriminated union",
      () => {
        const parsed = ContentItemSchema.parse( {
          type: "qrcode",
          domainOverride: "https://example.com"
        } );

        expect( parsed.type ).toBe( "qrcode" );

        if ( parsed.type === "qrcode" ) {
          expect( parsed.domainOverride ).toBe( "https://example.com" );
        }
      }
    );

    it(
      "makeDefaultItem('qrcode') round-trips through the schema",
      () => {
        const item = makeDefaultItem( "qrcode" );

        expect( item.type ).toBe( "qrcode" );
        expect( () => ContentItemSchema.parse( item ) ).not.toThrow();
      }
    );

    it(
      "has a form-config entry for every schema field (no orphan fields)",
      () => {
        const schemaFields = Object.keys( QrCodeItemSchema.shape ).filter( ( field ) => field !== "type" );
        const configFields = Object.keys( formConfig.qrcode );

        for ( const field of schemaFields ) {
          expect( configFields ).toContain( field );
        }
      }
    );

    it(
      "rejects error-correction levels outside L/M/Q/H",
      () => {
        expect( () =>
          QrCodeItemSchema.parse( {
            type: "qrcode",
            errorCorrection: "Z"
          } ) ).toThrow();
      }
    );
  }
);
