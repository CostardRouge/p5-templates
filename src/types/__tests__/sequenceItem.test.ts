/**
 * Guards the "sequence" content item — a reel of whole sketches, splash and
 * loading screens cut together with GL transitions.
 *
 * Like every content item it is spread across places that must agree: the Zod
 * schema, the discriminated union, `makeDefaultItem`, the palette and the form
 * field-config. The scenes are a discriminated union of their own, rendered by
 * a conditional-group inside an item-list, so every branch's fields need a
 * config too — and the GLSL catalogue must know every transition kind the
 * schema offers.
 */

import {
  ContentItemSchema,
  SEQUENCE_SCENE_KINDS,
  SEQUENCE_TRANSITION_KINDS,
  SequenceEffectSchema,
  SequenceItemSchema,
  SequenceSceneSchema
} from "@/types/sketch.types";
import makeDefaultItem
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/utils/makeDefaultItem";
import {
  ITEM_GROUPS, ITEM_META, ITEM_ORDER
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/constants/item-kinds";
import {
  formConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import describeContentItem
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/utils/describeContentItem";
import {
  sequenceSeedFor
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/components/AddItemControls/components/ItemPalette/AddLayerPopover";
import {
  TRANSITION_BODIES, effectUniforms, fragmentSourceFor
} from "@/p5/utils/sequence/transitionGlsl.js";

type Branch = Record<string, unknown>;

const scenesConfig = formConfig.sequence.scenes as {
  component: "item-list";
  itemConfig: {
    component: "conditional-group";
    conditionalOn: string;
    configs: Record<string, Branch>;
    typeSelector: { options: Array<{ value: string | number }> };
  };
};

const effectConfig = ( scenesConfig.itemConfig.configs.sketch.transition as {
  fields: { effect: { configs: Record<string, Branch>;
    typeSelector: { options: Array<{ value: string | number }> }; }; };
} ).fields.effect;

describe(
  "sequence content item",
  () => {
    it(
      "applies defaults that make a whole-frame reel",
      () => {
        const item = SequenceItemSchema.parse( {
          type: "sequence"
        } );

        expect( item ).toMatchObject( {
          type: "sequence",
          enabled: true,
          scenes: [],
          loop: "cyclic",
          scale: 1,
          aspectRatio: "canvas",
          opacity: 1,
          blend: "source-over",
          resolution: 1
        } );
        // The grade is neutral and the sound off: a fresh reel changes nothing
        // about its scenes until asked.
        expect( item.grade ).toMatchObject( {
          letterbox: 0,
          vignette: 0,
          grain: 0,
          aberration: 0,
          saturation: 1,
          contrast: 1,
          tintAmount: 0,
          scanlines: 0
        } );
        expect( item.sound.enabled ).toBe( false );
      }
    );

    it(
      "fills a scene of every kind from its kind alone",
      () => {
        for ( const kind of SEQUENCE_SCENE_KINDS ) {
          const scene = SequenceSceneSchema.parse( {
            kind
          } );

          expect( scene.kind ).toBe( kind );
          expect( scene.weight ).toBe( 1 );
          expect( scene.transition.duration ).toBeGreaterThan( 0 );
          expect( scene.transition.effect.kind ).toBe( "wipe" );
          expect( scene.camera.move ).toBe( "none" );
        }

        const sketch = SequenceSceneSchema.parse( {
          kind: "sketch"
        } );

        // A scene is the whole picture, so unlike a layer it paints its own
        // background and plays one loop of itself over its slot.
        expect( sketch ).toMatchObject( {
          drawBackground: true,
          loops: 1,
          settings: {}
        } );
      }
    );

    it(
      "fills every transition effect from its kind alone",
      () => {
        for ( const kind of SEQUENCE_TRANSITION_KINDS ) {
          const effect = SequenceEffectSchema.parse( {
            kind
          } );

          expect( effect.kind ).toBe( kind );
        }
      }
    );

    it(
      "rejects an unknown transition kind and scene kind",
      () => {
        expect( SequenceEffectSchema.safeParse( {
          kind: "teleport"
        } ).success ).toBe( false );
        expect( SequenceSceneSchema.safeParse( {
          kind: "video"
        } ).success ).toBe( false );
      }
    );

    it(
      "round-trips through the content union with the picker's seed",
      () => {
        const seed = sequenceSeedFor(
          "background/background-grid",
          {
            columns: 9
          }
        );
        const item = makeDefaultItem(
          "sequence",
          seed
        );

        expect( item.type ).toBe( "sequence" );
        expect( () => ContentItemSchema.parse( item ) ).not.toThrow();

        if ( item.type === "sequence" ) {
          expect( item.scenes.map( ( scene ) => scene.kind ) ).toEqual( [
            "splash",
            "sketch"
          ] );
          expect( item.scenes[ 1 ] ).toMatchObject( {
            kind: "sketch",
            sketch: "background/background-grid",
            settings: {
              columns: 9
            }
          } );
          expect( item.scenes[ 0 ] ).toMatchObject( {
            kind: "splash",
            title: "BACKGROUND\nGRID"
          } );
        }
      }
    );

    it(
      "has a form-config entry for every schema field",
      () => {
        const schemaFields = Object.keys( SequenceItemSchema.shape ).filter( ( field ) => field !== "type" );
        const configFields = Object.keys( formConfig.sequence );

        for ( const field of schemaFields ) {
          expect( configFields ).toContain( field );
        }
      }
    );

    it(
      "has a form-config branch, with every field, for every scene kind",
      () => {
        const offered = scenesConfig.itemConfig.typeSelector.options.map( ( option ) => String( option.value ) );

        expect( offered.sort() ).toEqual( [
          ...SEQUENCE_SCENE_KINDS
        ].sort() );

        for ( const option of SequenceSceneSchema.options ) {
          const kind = option.shape.kind.value;
          const branch = scenesConfig.itemConfig.configs[ kind ];

          expect( branch ).toBeDefined();

          for ( const field of Object.keys( option.shape ).filter( ( name ) => name !== "kind" ) ) {
            expect( Object.keys( branch ) ).toContain( field );
          }
        }
      }
    );

    it(
      "has a form-config branch, with every field, for every transition kind",
      () => {
        const offered = effectConfig.typeSelector.options.map( ( option ) => String( option.value ) );

        expect( offered.sort() ).toEqual( [
          ...SEQUENCE_TRANSITION_KINDS
        ].sort() );

        for ( const option of SequenceEffectSchema.unwrap().options ) {
          const kind = option.shape.kind.value;
          const branch = effectConfig.configs[ kind ];

          expect( branch ).toBeDefined();

          for ( const field of Object.keys( option.shape ).filter( ( name ) => name !== "kind" ) ) {
            expect( Object.keys( branch ) ).toContain( field );
            // A branch switch rebuilds the object from these.
            expect( ( branch[ field ] as { default?: unknown } ).default ).toBeDefined();
          }
        }
      }
    );

    it(
      "has a fragment program for every transition kind",
      () => {
        for ( const kind of SEQUENCE_TRANSITION_KINDS ) {
          expect( TRANSITION_BODIES[ kind ] ).toBeDefined();

          const source = fragmentSourceFor( kind );

          expect( source ).toContain( "vec4 transition( vec2 uv )" );
          expect( source ).toContain( "void main()" );
        }

        // And nothing the schema does not know.
        expect( Object.keys( TRANSITION_BODIES ).sort() ).toEqual( [
          ...SEQUENCE_TRANSITION_KINDS
        ].sort() );
      }
    );

    it(
      "maps every effect's fields onto the generic uniforms",
      () => {
        const wipe = effectUniforms( SequenceEffectSchema.parse( {
          kind: "wipe",
          angle: 90,
          softness: 0.2
        } ) );

        expect( wipe.uAngle ).toBeCloseTo(
          Math.PI / 2,
          6
        );
        expect( wipe.uSoftness ).toBe( 0.2 );

        const iris = effectUniforms( SequenceEffectSchema.parse( {
          kind: "iris",
          shape: "star",
          center: {
            x: 0.2,
            y: 0.8
          }
        } ) );

        expect( iris.uMode ).toBe( 3 );
        expect( iris.uCenter ).toEqual( [
          0.2,
          0.8
        ] );

        // Every uniform is present whatever the kind.
        for ( const kind of SEQUENCE_TRANSITION_KINDS ) {
          const uniforms = effectUniforms( SequenceEffectSchema.parse( {
            kind
          } ) );

          expect( Object.keys( uniforms ).sort() ).toEqual( [
            "uAmount",
            "uAngle",
            "uCenter",
            "uCount",
            "uCount2",
            "uMode",
            "uSeed",
            "uSoftness"
          ] );
        }
      }
    );

    it(
      "is offered by the palette, in the Content group, and names itself by its sketches",
      () => {
        expect( ITEM_ORDER ).toContain( "sequence" );
        expect( ITEM_META.sequence.label ).toBe( "Sequence" );
        expect( ITEM_GROUPS.find( ( group ) => group.kinds.includes( "sequence" ) )?.label ).toBe( "Content" );

        expect( describeContentItem( {
          type: "sequence",
          scenes: [
            {
              kind: "splash"
            },
            {
              kind: "sketch",
              sketch: "flip/flip-v1"
            },
            {
              kind: "sketch",
              sketch: "braid/braid-v1"
            }
          ]
        } ) ).toMatchObject( {
          label: "Sequence",
          preview: "flip-v1 → braid-v1"
        } );

        expect( describeContentItem( {
          type: "sequence",
          scenes: [
            {
              kind: "plate"
            }
          ]
        } ).preview ).toBe( "1 scene" );
      }
    );
  }
);
