import {
  randomizeField, randomizeFields, type RandomizeFormAccess
} from "../randomizeFields";
import type {
  FieldConfig
} from "../../components/ContentItems/constants/field-config";

// A minimal RHF stand-in: getValues reads a plain tree, setValue records every
// write so the walk can be asserted without mounting a form.
function makeForm( tree: Record<string, unknown> = {} ) {
  const writes: Array<{ path: string;
    value: unknown; }> = [];

  const form: RandomizeFormAccess = {
    getValues: ( path: string ) => path.split( "." ).reduce<any>(
      (
        node, key
      ) => node?.[ key ],
      tree
    ),
    setValue: (
      path: string, value: unknown
    ) => {
      writes.push( {
        path,
        value
      } );
    }
  };

  return {
    ...form,
    writes,
    valueAt: ( path: string ) =>
      writes.filter( ( write ) => write.path === path ).at( -1 )?.value
  };
}

const vectorConfig = {
  label: "Orientation",
  component: "vector2d",
  min: -1,
  max: 1,
  step: 0.01
} as FieldConfig;

describe(
  "randomizeField",
  () => {
    it(
      "writes a vector2d as one { x, y } inside the pad's own bounds",
      () => {
        const form = makeForm();

        randomizeField(
          vectorConfig,
          "sketch.orientation",
          form
        );

        expect( form.writes ).toHaveLength( 1 );
        expect( form.writes[ 0 ].path ).toBe( "sketch.orientation" );

        const value = form.writes[ 0 ].value as { x: number;
          y: number; };

        expect( value.x ).toBeGreaterThanOrEqual( -1 );
        expect( value.x ).toBeLessThanOrEqual( 1 );
        expect( value.y ).toBeGreaterThanOrEqual( -1 );
        expect( value.y ).toBeLessThanOrEqual( 1 );
      }
    );

    it(
      "keeps the sibling keys stored alongside a vector2d's x/y",
      () => {
        const form = makeForm( {
          sketch: {
            point: {
              x: 0.1,
              y: 0.2,
              locked: true
            }
          }
        } );

        randomizeField(
          {
            label: "Point",
            component: "vector2d",
            allowNegative: false,
            min: 0,
            max: 1,
            step: 0.01
          } as FieldConfig,
          "sketch.point",
          form
        );

        expect( form.writes[ 0 ].value ).toMatchObject( {
          locked: true
        } );
      }
    );

    it(
      "leaves a kind it cannot draw from untouched",
      () => {
        const form = makeForm();

        randomizeField(
          {
            label: "Title",
            component: "text"
          } as FieldConfig,
          "sketch.title",
          form
        );
        randomizeField(
          {
            label: "Fill",
            component: "color"
          } as FieldConfig,
          "sketch.fill",
          form
        );

        expect( form.writes ).toHaveLength( 0 );
      }
    );

    it(
      "snaps a slider to its step and stays within its range",
      () => {
        const form = makeForm();

        for ( let run = 0; run < 20; run++ ) {
          randomizeField(
            {
              label: "Count",
              component: "slider",
              min: 2,
              max: 8,
              step: 1
            } as FieldConfig,
            "sketch.count",
            form
          );
        }

        for ( const write of form.writes ) {
          expect( write.value ).toBeGreaterThanOrEqual( 2 );
          expect( write.value ).toBeLessThanOrEqual( 8 );
          expect( Number.isInteger( write.value ) ).toBe( true );
        }
      }
    );
  }
);

describe(
  "randomizeFields",
  () => {
    it(
      "walks nested objects, prefixing each field with its path",
      () => {
        const form = makeForm();

        randomizeFields(
          {
            orientation: vectorConfig,
            camera: {
              label: "Camera",
              component: "nested-object",
              fields: {
                distance: {
                  label: "Distance",
                  component: "slider",
                  min: 0,
                  max: 10,
                  step: 1
                }
              }
            }
          } as Record<string, FieldConfig>,
          "sketch",
          form
        );

        expect( form.writes.map( ( write ) => write.path ) ).toEqual( [
          "sketch.orientation",
          "sketch.camera.distance"
        ] );
      }
    );

    it(
      "mounts at the root when there is no base path",
      () => {
        const form = makeForm();

        randomizeFields(
          {
            orientation: vectorConfig
          } as Record<string, FieldConfig>,
          "",
          form
        );

        expect( form.writes[ 0 ].path ).toBe( "orientation" );
      }
    );

    it(
      "picks a branch of a conditional group and randomizes only that branch",
      () => {
        const form = makeForm();

        randomizeFields(
          {
            visibility: {
              label: "Visibility",
              component: "conditional-group",
              conditionalOn: "mode",
              typeSelector: {
                label: "Mode",
                options: [
                  {
                    value: "always",
                    label: "Always"
                  }
                ]
              },
              configs: {
                always: {
                  fade: {
                    label: "Fade",
                    component: "slider",
                    min: 0,
                    max: 1,
                    step: 0.1
                  }
                }
              }
            }
          } as unknown as Record<string, FieldConfig>,
          "sketch",
          form
        );

        expect( form.valueAt( "sketch.visibility.mode" ) ).toBe( "always" );
        expect( form.valueAt( "sketch.visibility.fade" ) ).toBeDefined();
      }
    );
  }
);
