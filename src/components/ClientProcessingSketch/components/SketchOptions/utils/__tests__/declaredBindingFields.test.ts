/**
 * Tests for the walk that turns a sketch's declared controls into binding
 * descriptors. Pure over a plain config object — no form, no engine, no MIDI.
 */
import type {
  FieldConfig
} from "../../components/ContentItems/constants/field-config";
import {
  collectDeclaredBindings
} from "../declaredBindingFields";

const noValues = () => undefined;

describe(
  "collectDeclaredBindings",
  () => {
    it(
      "returns nothing for a config that declares no control",
      () => {
        const config = {
          speed: {
            component: "slider",
            min: 0,
            max: 1
          }
        } as unknown as Record<string, FieldConfig>;

        expect( collectDeclaredBindings(
          config,
          noValues
        ) ).toEqual( [] );
      }
    );

    it(
      "carries the control through and derives the mapping from the field itself",
      () => {
        const config = {
          speed: {
            component: "slider",
            min: 2,
            max: 40,
            binding: {
              control: "knob.1"
            }
          }
        } as unknown as Record<string, FieldConfig>;

        const [
          declared
        ] = collectDeclaredBindings(
          config,
          noValues
        );

        expect( declared.target ).toBe( "speed" );
        expect( declared.control ).toBe( "knob.1" );
        expect( declared.kind ).toBe( "continuous" );
        // The range comes from the slider, which is the point of reusing
        // makeDefaultBinding rather than inventing a 0..1 default.
        expect( declared.mapping ).toMatchObject( {
          min: 2,
          max: 40
        } );
      }
    );

    it(
      "names a nested field by its dotted, sketch-relative path",
      () => {
        const config = {
          noise: {
            component: "nested-object",
            fields: {
              speed: {
                component: "slider",
                min: 0,
                max: 1,
                binding: {
                  control: "knob.3"
                }
              }
            }
          }
        } as unknown as Record<string, FieldConfig>;

        expect( collectDeclaredBindings(
          config,
          noValues
        )[ 0 ].target ).toBe( "noise.speed" );
      }
    );

    it(
      "skips a component nothing knows how to modulate",
      () => {
        const config = {
          caption: {
            component: "text",
            binding: {
              control: "knob.1"
            }
          }
        } as unknown as Record<string, FieldConfig>;

        expect( collectDeclaredBindings(
          config,
          noValues
        ) ).toEqual( [] );
      }
    );

    it(
      "follows only the LIVE branch of a conditional group",
      () => {
        // Walking every branch would let two of them claim the same knob.
        const config = {
          shape: {
            component: "conditional-group",
            conditionalOn: "type",
            typeSelector: {
              options: [
                {
                  value: "ring"
                },
                {
                  value: "grid"
                }
              ]
            },
            configs: {
              ring: {
                radius: {
                  component: "slider",
                  min: 0,
                  max: 10,
                  binding: {
                    control: "knob.1"
                  }
                }
              },
              grid: {
                cells: {
                  component: "slider",
                  min: 0,
                  max: 10,
                  binding: {
                    control: "knob.1"
                  }
                }
              }
            }
          }
        } as unknown as Record<string, FieldConfig>;

        const onGrid = collectDeclaredBindings(
          config,
          ( path ) => ( path === "shape.type" ? "grid" : undefined )
        );

        expect( onGrid ).toHaveLength( 1 );
        expect( onGrid[ 0 ].target ).toBe( "shape.cells" );

        // With no value to read, no branch is live and nothing is claimed.
        expect( collectDeclaredBindings(
          config,
          noValues
        ) ).toEqual( [] );
      }
    );

    it(
      "handles an absent config",
      () => {
        expect( collectDeclaredBindings(
          undefined,
          noValues
        ) ).toEqual( [] );
      }
    );

    it(
      "declares nothing for a select laid out as buttons, or for a button — the pads own those",
      () => {
        // An enum binding folds ONE continuous channel onto the option list;
        // a pad row is many channels, one per option, driven elsewhere.
        const config = {
          effect: {
            component: "select",
            display: "buttons",
            options: [
              {
                label: "A",
                value: "a"
              },
              {
                label: "B",
                value: "b"
              }
            ],
            binding: {
              control: "pad.1"
            }
          },
          reset: {
            component: "button",
            effect: {
              kind: "reset",
              target: "effect"
            },
            binding: {
              control: "pad.9"
            }
          },
          picker: {
            component: "select",
            options: [
              {
                label: "A",
                value: "a"
              }
            ],
            binding: {
              control: "knob.1"
            }
          }
        } as unknown as Record<string, FieldConfig>;

        const declared = collectDeclaredBindings(
          config,
          noValues
        );

        expect( declared.map( ( entry ) => entry.target ) ).toEqual( [
          "picker"
        ] );
      }
    );
  }
);
