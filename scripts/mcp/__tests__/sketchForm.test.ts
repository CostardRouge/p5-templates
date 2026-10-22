import {
  CommandError
} from "../registry.ts";
import {
  checkSketchOptions, formSchema, mergeOptions
} from "../sketchForm.ts";

// Shaped like real forms: voronoi-v1-cells (nested slider/select/colour/
// checkbox) and flip-v3-tube-cascade (conditional-group).
const CONFIG = {
  render: {
    component: "nested-object",
    fields: {
      palette: {
        component: "select",
        label: "Palette",
        options: [
          {
            label: "Rainbow",
            value: "rainbow"
          },
          {
            label: "Mono",
            value: "mono"
          }
        ]
      },
      hueSpeed: {
        component: "slider",
        label: "Hue speed",
        min: 0,
        max: 3,
        step: 0.05
      },
      edgeColor: {
        component: "color",
        label: "Edge"
      },
      showSites: {
        component: "checkbox",
        label: "Show sites"
      }
    }
  },
  light: {
    component: "vector3d",
    min: -2,
    max: 2,
    zAxis: {
      min: 0,
      max: 5
    }
  },
  layout: {
    component: "conditional-group",
    label: "Layout",
    conditionalOn: "mode",
    typeSelector: {
      label: "Board",
      options: [
        {
          label: "Sub",
          value: "subdivide"
        },
        {
          label: "Fixed",
          value: "fixed"
        }
      ]
    },
    configs: {
      subdivide: {
        depth: {
          component: "slider",
          min: 0,
          max: 6,
          step: 1,
          default: 3
        }
      },
      fixed: {
        columns: {
          component: "slider",
          min: 1,
          max: 12,
          step: 1,
          default: 4
        }
      }
    }
  },
  photo: {
    component: "image",
    label: "Photo"
  },
  secret: {
    component: "hidden"
  }
};
const VALUES = {
  render: {
    palette: "rainbow",
    hueSpeed: 0,
    edgeColor: [
      0,
      0,
      0
    ],
    showSites: false
  },
  light: {
    x: 0,
    y: 1,
    z: 2
  },
  layout: {
    mode: "subdivide",
    depth: 3
  },
  photo: "a.jpg",
  seed: 7
};

function refusal( delta: Record<string, unknown> ): string | null {
  try {
    checkSketchOptions(
      CONFIG,
      VALUES,
      delta
    );
    return null;
  } catch( error ) {
    return error instanceof CommandError ? `${ error.code }: ${ error.message }` : String( error );
  }
}

describe(
  "checkSketchOptions",
  () => {
    it(
      "accepts what the form would accept",
      () => {
        expect( refusal( {
          render: {
            palette: "mono",
            hueSpeed: 3,
            edgeColor: [
              255,
              0,
              0,
              128
            ],
            showSites: true
          },
          light: {
            z: 5
          },
          layout: {
            mode: "fixed",
            columns: 12
          },
          photo: "b.jpg",
          seed: 9
        } ) ).toBeNull();
      }
    );

    it(
      "refuses out of range, naming the dotted path and the bound",
      () => {
        expect( refusal( {
          render: {
            hueSpeed: 4
          }
        } ) ).toBe( "invalid: options.render.hueSpeed is 4, above its maximum 3" );
        expect( refusal( {
          light: {
            x: -3
          }
        } ) ).toBe( "invalid: options.light.x is -3, below its minimum -2" );
        expect( refusal( {
          light: {
            z: 6
          }
        } ) ).toBe( "invalid: options.light.z is 6, above its maximum 5" );
        expect( refusal( {
          render: {
            edgeColor: [
              0,
              300,
              0
            ]
          }
        } ) ).toBe( "invalid: options.render.edgeColor[1] is 300, above its maximum 255" );
      }
    );

    it(
      "refuses a value outside a select, a wrong type and a bad colour",
      () => {
        expect( refusal( {
          render: {
            palette: "neon"
          }
        } ) ).toBe( "invalid: options.render.palette is \"neon\" — one of \"rainbow\", \"mono\"" );
        expect( refusal( {
          render: {
            showSites: 1
          }
        } ) ).toBe( "invalid: options.render.showSites must be true or false" );
        expect( refusal( {
          render: {
            edgeColor: [
              0,
              0
            ]
          }
        } ) ).toBe( "invalid: options.render.edgeColor must be [r, g, b] or [r, g, b, a]" );
        expect( refusal( {
          light: {
            w: 0
          }
        } ) ).toBe( "invalid: options.light.w is not an axis — x, y, z" );
      }
    );

    it(
      "checks a conditional group against the branch it lands on",
      () => {
        expect( refusal( {
          layout: {
            depth: 7
          }
        } ) ).toBe( "invalid: options.layout.depth is 7, above its maximum 6" );
        expect( refusal( {
          layout: {
            mode: "fixed",
            columns: 13
          }
        } ) ).toBe( "invalid: options.layout.columns is 13, above its maximum 12" );
        expect( refusal( {
          layout: {
            mode: "spiral"
          }
        } ) ).toBe( "invalid: options.layout.mode is \"spiral\" — one of \"subdivide\", \"fixed\"" );
      }
    );

    it(
      "refuses a key the sketch does not have, naming the ones it does",
      () => {
        expect( refusal( {
          render: {
            hueSped: 1
          }
        } ) ).toBe( "invalid: options.render.hueSped is not a parameter of this sketch — known here: palette, hueSpeed, edgeColor, showSites" );
      }
    );
  }
);

describe(
  "formSchema",
  () => {
    it(
      "describes every control with its range and default, and skips hidden ones",
      () => {
        const schema = formSchema(
          CONFIG,
          VALUES
        ) as { properties: Record<string, Record<string, unknown>> };

        expect( Object.keys( schema.properties ) ).toEqual( [
          "render",
          "light",
          "layout",
          "photo"
        ] );
        expect( ( schema.properties.render.properties as Record<string, unknown> ).hueSpeed ).toEqual( {
          description: "Hue speed",
          type: "number",
          minimum: 0,
          maximum: 3,
          step: 0.05,
          default: 0
        } );
        expect( ( schema.properties.render.properties as Record<string, unknown> ).palette ).toEqual( {
          description: "Palette",
          enum: [
            "rainbow",
            "mono"
          ],
          default: "rainbow"
        } );
        expect( schema.properties.light.properties ).toEqual( {
          x: {
            type: "number",
            minimum: -2,
            maximum: 2
          },
          y: {
            type: "number",
            minimum: -2,
            maximum: 2
          },
          z: {
            type: "number",
            minimum: 0,
            maximum: 5
          }
        } );
        expect( ( schema.properties.layout.oneOf as unknown[] ).length ).toBe( 2 );
        expect( schema.properties.photo.description ).toBe( "Photo (image control — not checked here)" );
      }
    );
  }
);

describe(
  "mergeOptions",
  () => {
    it(
      "merges objects key by key and replaces arrays whole, as the option store does",
      () => {
        expect( mergeOptions(
          VALUES,
          {
            render: {
              hueSpeed: 1,
              edgeColor: [
                1,
                2,
                3
              ]
            }
          }
        ) ).toEqual( {
          ...VALUES,
          render: {
            palette: "rainbow",
            hueSpeed: 1,
            edgeColor: [
              1,
              2,
              3
            ],
            showSites: false
          }
        } );
      }
    );
  }
);
