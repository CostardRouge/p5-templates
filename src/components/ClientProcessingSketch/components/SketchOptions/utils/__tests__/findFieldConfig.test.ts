/**
 * Tests for looking a field's config up by sketch-relative path.
 */
import type {
  FieldConfig
} from "../../components/ContentItems/constants/field-config";
import {
  findFieldConfig
} from "../findFieldConfig";

const CONFIG = {
  seed: {
    component: "slider",
    min: 0,
    max: 9
  },
  rack: {
    component: "nested-object",
    fields: {
      effect: {
        component: "select",
        options: []
      },
      layers: {
        component: "nested-object",
        fields: {
          tapeHiss: {
            component: "checkbox"
          }
        }
      }
    }
  },
  look: {
    component: "conditional-group",
    conditionalOn: "type",
    typeSelector: {
      options: []
    },
    configs: {
      flat: {
        tint: {
          component: "color"
        }
      },
      lit: {
        glow: {
          component: "slider",
          min: 0,
          max: 1
        }
      }
    }
  },
  raw: {
    component: "json"
  }
} as unknown as Record<string, FieldConfig>;

describe(
  "findFieldConfig",
  () => {
    it(
      "finds a top-level field and one nested two groups deep",
      () => {
        expect( findFieldConfig(
          CONFIG,
          "seed",
          () => undefined
        )?.component ).toBe( "slider" );
        expect( findFieldConfig(
          CONFIG,
          "rack.layers.tapeHiss",
          () => undefined
        )?.component ).toBe( "checkbox" );
      }
    );

    it(
      "follows the LIVE branch of a conditional group, and only that one",
      () => {
        const onLit = ( path: string ) => ( path === "look.type" ? "lit" : undefined );

        expect( findFieldConfig(
          CONFIG,
          "look.glow",
          onLit
        )?.component ).toBe( "slider" );
        // `tint` is on the other branch: it does not exist for the form.
        expect( findFieldConfig(
          CONFIG,
          "look.tint",
          onLit
        ) ).toBeNull();
      }
    );

    it(
      "returns null for a missing segment, a path into a leaf, or no config",
      () => {
        expect( findFieldConfig(
          CONFIG,
          "rack.nothing",
          () => undefined
        ) ).toBeNull();
        expect( findFieldConfig(
          CONFIG,
          "raw.inside",
          () => undefined
        ) ).toBeNull();
        expect( findFieldConfig(
          null,
          "seed",
          () => undefined
        ) ).toBeNull();
        expect( findFieldConfig(
          CONFIG,
          "",
          () => undefined
        ) ).toBeNull();
      }
    );
  }
);
