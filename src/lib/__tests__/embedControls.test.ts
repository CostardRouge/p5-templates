import {
  resolveEmbedControls
} from "@/lib/embedControls";
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";

const formConfiguration = {
  backgroundColor: {
    component: "color",
    label: "Background"
  },
  noise: {
    component: "nested-object",
    label: "Noise",
    fields: {
      seed: {
        component: "slider",
        min: 0,
        max: 100
      },
      falloff: {
        component: "slider",
        min: 0,
        max: 1
      }
    }
  }
} as unknown as Record<string, FieldConfig>;

describe(
  "resolveEmbedControls",
  () => {
    it(
      "resolves a nested leaf path under the sketch base path",
      () => {
        const [
          control
        ] = resolveEmbedControls(
          formConfiguration,
          [
            "noise.seed"
          ]
        );

        expect( control ).toMatchObject( {
          path: "noise.seed",
          fieldBasePath: "sketch.noise",
          fieldName: "seed"
        } );
        expect( control.config ).toBe( ( formConfiguration.noise as { fields: Record<string, FieldConfig> } ).fields.seed );
      }
    );

    it(
      "resolves a top-level leaf directly under sketch",
      () => {
        const [
          control
        ] = resolveEmbedControls(
          formConfiguration,
          [
            "backgroundColor"
          ]
        );

        expect( control ).toMatchObject( {
          fieldBasePath: "sketch",
          fieldName: "backgroundColor"
        } );
      }
    );

    it(
      "resolves a whole group when the path points at a nested-object",
      () => {
        const [
          control
        ] = resolveEmbedControls(
          formConfiguration,
          [
            "noise"
          ]
        );

        expect( control.config ).toBe( formConfiguration.noise );
        expect( control.fieldBasePath ).toBe( "sketch" );
        expect( control.fieldName ).toBe( "noise" );
      }
    );

    it(
      "expands the '*' token to every top-level field",
      () => {
        const resolved = resolveEmbedControls(
          formConfiguration,
          [
            "*"
          ]
        );

        expect( resolved.map( ( control ) => control.fieldName ) ).toEqual( [
          "backgroundColor",
          "noise"
        ] );
      }
    );

    it(
      "skips unknown paths and de-duplicates",
      () => {
        const resolved = resolveEmbedControls(
          formConfiguration,
          [
            "noise.seed",
            "noise.seed",
            "does.not.exist",
            "noise.missing"
          ]
        );

        expect( resolved ).toHaveLength( 1 );
        expect( resolved[ 0 ].path ).toBe( "noise.seed" );
      }
    );

    it(
      "returns nothing when there is no config or no whitelist",
      () => {
        expect( resolveEmbedControls(
          undefined,
          [
            "noise.seed"
          ]
        ) ).toEqual( [] );
        expect( resolveEmbedControls(
          formConfiguration,
          null
        ) ).toEqual( [] );
        expect( resolveEmbedControls(
          formConfiguration,
          []
        ) ).toEqual( [] );
      }
    );
  }
);
