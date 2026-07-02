/**
 * Guards the specs "sound on change" option group.
 *
 * Same drift-protection idea as qrCodeItem.test.ts: the Zod schema, the specs
 * item, and the form field-config must stay in agreement, and pre-existing
 * decks (persisted before the sound group existed) must heal to a silent
 * default instead of failing to parse.
 */

import {
  SPECS_SOUND_PRESETS,
  SpecsItemSchema,
  SpecsSoundRepeatSchema,
  SpecsSoundSchema
} from "@/types/sketch.types";
import {
  CLICK_PRESET_NAMES
} from "@/lib/clickSynth";
import {
  formConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

describe(
  "specs sound option group",
  () => {
    it(
      "defaults to disabled with a single pleasing click",
      () => {
        const sound = SpecsSoundSchema.parse( undefined );

        expect( sound ).toEqual( {
          enabled: false,
          preset: "click",
          volume: 0.5,
          pitch: 1,
          pitchVariation: 0.1,
          linePitchSpread: 0,
          minInterval: 0.05,
          lineCooldown: 0.15,
          maxBurst: 12,
          repeat: {
            mode: "once"
          }
        } );
      }
    );

    it(
      "heals pre-sound specs items to the silent default",
      () => {
        const item = SpecsItemSchema.parse( {
          type: "specs"
        } );

        expect( item.sound.enabled ).toBe( false );
        expect( item.sound.repeat ).toEqual( {
          mode: "once"
        } );
      }
    );

    it(
      "fills per-mode repeat defaults",
      () => {
        expect( SpecsSoundRepeatSchema.parse( {
          mode: "count"
        } ) ).toEqual( {
          mode: "count",
          times: 3,
          interval: 0.08,
          pitchStep: 0.08
        } );

        expect( SpecsSoundRepeatSchema.parse( {
          mode: "while-highlighted"
        } ) ).toEqual( {
          mode: "while-highlighted",
          interval: 0.12
        } );
      }
    );

    it(
      "keeps the schema presets aligned with the click synth",
      () => {
        expect( [
          ...SPECS_SOUND_PRESETS
        ] ).toEqual( [
          ...CLICK_PRESET_NAMES
        ] );
      }
    );

    it(
      "exposes every schema field in the specs form config",
      () => {
        const soundConfig = formConfig.specs.sound;

        expect( soundConfig ).toBeDefined();

        if ( soundConfig?.component !== "nested-object" ) {
          throw new Error( "specs.sound should be a nested-object group" );
        }

        const schemaKeys = Object.keys( SpecsSoundSchema.removeDefault().shape );
        const configKeys = Object.keys( soundConfig.fields );

        expect( configKeys.sort() ).toEqual( schemaKeys.sort() );
      }
    );
  }
);
