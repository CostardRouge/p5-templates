import {
  injectSketchSchemas
} from "../injectSketchSchemas";
import {
  interactionFormConfiguration
} from "@/p5/utils/interaction/defaults.js";
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentItems/constants/field-config";

describe(
  "injectSketchSchemas — interaction panel",
  () => {
    it(
      "adds the shared Interaction config when the sketch has none",
      () => {
        const config = {
          radius: {
            component: "slider",
            label: "Radius",
            min: 0,
            max: 100
          }
        } as unknown as Record<string, FieldConfig>;

        const result = injectSketchSchemas(
          "some-plain-sketch",
          config
        );

        expect( result.interaction ).toBeDefined();
        expect( result.interaction ).toEqual( interactionFormConfiguration );
        // The sketch's own fields are preserved.
        expect( result.radius ).toBeDefined();
      }
    );

    it(
      "leaves a sketch's own Interaction config untouched",
      () => {
        const config = {
          interaction: {
            component: "nested-object",
            label: "Custom interaction",
            fields: {
              enabled: {
                component: "checkbox",
                label: "Enabled"
              }
            }
          }
        } as unknown as Record<string, FieldConfig>;

        const result = injectSketchSchemas(
          "interaction-test",
          config
        );

        expect( ( result.interaction as any ).label ).toBe( "Custom interaction" );
        expect( result.interaction ).not.toEqual( interactionFormConfiguration );
      }
    );

    it(
      "does not mutate the input config object",
      () => {
        const config = {
          radius: {
            component: "slider",
            label: "Radius"
          }
        } as unknown as Record<string, FieldConfig>;

        injectSketchSchemas(
          "some-plain-sketch",
          config
        );

        expect( config.interaction ).toBeUndefined();
      }
    );
  }
);
