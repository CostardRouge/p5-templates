import {
  describeFieldBinding
} from "../useFieldBinding";
import {
  bindingKindFor, makeDefaultBinding
} from "../bindingUtils";
import type {
  Binding
} from "../bindingUtils";

const osc = (
  target: string, min: number, max: number, extra: Partial<Binding> = {}
): Binding => ( {
  source: "oscillator",
  target,
  kind: "continuous",
  mapping: {
    min,
    max
  },
  ...extra
} );

describe(
  "describeFieldBinding",
  () => {
    it(
      "is free when nothing targets the field",
      () => {
        expect( describeFieldBinding(
          [
            osc(
              "other",
              0,
              1
            )
          ],
          "grid.rows"
        ) ).toEqual( {
          target: "grid.rows",
          bound: false,
          live: false,
          range: null,
          values: null,
          area: null,
          ramp: null,
          declared: []
        } );
      }
    );

    it(
      "spans the union of the playing layers' ranges, inverted ranges included",
      () => {
        const state = describeFieldBinding(
          [
            osc(
              "grid.rows",
              40,
              420
            ),
            osc(
              "grid.rows",
              480,
              10
            ),
            osc(
              "grid.rows",
              0,
              999,
              {
                enabled: false
              }
            )
          ],
          "grid.rows"
        );

        expect( state.live ).toBe( true );
        expect( state.range ).toEqual( {
          min: 10,
          max: 480
        } );
      }
    );

    it(
      "is bound but not live when muted, or silenced by a solo on another field",
      () => {
        expect( describeFieldBinding(
          [
            osc(
              "grid.rows",
              0,
              1,
              {
                enabled: false
              }
            )
          ],
          "grid.rows"
        ) ).toMatchObject( {
          bound: true,
          live: false,
          range: null
        } );

        expect( describeFieldBinding(
          [
            osc(
              "grid.rows",
              0,
              1
            ),
            osc(
              "grid.columns",
              0,
              1,
              {
                solo: true
              }
            )
          ],
          "grid.rows"
        ) ).toMatchObject( {
          bound: true,
          live: false
        } );
      }
    );

    it(
      "spans a pad's playing layers per axis, a missing bound reading as the resolver's default",
      () => {
        const state = describeFieldBinding(
          [
            {
              source: "orbit",
              target: "orientation",
              kind: "vector2d",
              mapping: {
                x: {
                  min: -1,
                  max: 0.5
                },
                y: {
                  min: 0.2
                }
              }
            },
            {
              source: "mouse",
              target: "orientation",
              kind: "vector2d",
              mapping: {
                x: {
                  min: 0.8,
                  max: -0.25
                },
                y: {
                  min: -0.5,
                  max: 0.6
                }
              }
            }
          ],
          "orientation"
        );

        expect( state.area ).toEqual( {
          x: {
            min: -1,
            max: 0.8
          },
          y: {
            min: -0.5,
            max: 1
          }
        } );
      }
    );

    it(
      "names the sketch-declared controls driving the field, folded like any layer",
      () => {
        const declared: Binding = {
          id: "declared:knob.1:camera.tilt",
          source: "knob.1",
          control: "knob.1",
          target: "camera.tilt",
          kind: "continuous",
          mapping: {
            min: 0,
            max: 90
          }
        };

        const alone = describeFieldBinding(
          [
            declared
          ],
          "camera.tilt"
        );

        expect( alone.live ).toBe( true );
        expect( alone.declared ).toEqual( [
          "knob.1"
        ] );
        expect( alone.range ).toEqual( {
          min: 0,
          max: 90
        } );

        // A solo on a hand-made binding elsewhere silences it, as in the
        // resolver, whose list holds both.
        expect( describeFieldBinding(
          [
            declared,
            osc(
              "camera.spin",
              0,
              1,
              {
                solo: true
              }
            )
          ],
          "camera.tilt"
        ) ).toMatchObject( {
          live: false,
          declared: []
        } );
      }
    );

    it(
      "gives a 3D vector a z span beside x and y, a 2D pad none",
      () => {
        const state = describeFieldBinding(
          [
            {
              source: "oscillator",
              target: "light",
              kind: "vector3d",
              mapping: {
                x: {
                  min: -1,
                  max: 1
                },
                y: {
                  min: 0,
                  max: 2
                },
                z: {
                  min: 4,
                  max: -4
                }
              }
            }
          ],
          "light"
        );

        expect( state.area ).toEqual( {
          x: {
            min: -1,
            max: 1
          },
          y: {
            min: 0,
            max: 2
          },
          z: {
            min: -4,
            max: 4
          }
        } );
      }
    );

    it(
      "takes a colour's ramp from the last playing layer, and none from a malformed one",
      () => {
        const ramp = (
          from: unknown, to: unknown
        ): Binding => ( {
          source: "oscillator",
          target: "tint",
          kind: "color",
          mapping: {
            from,
            to
          }
        } );

        expect( describeFieldBinding(
          [
            ramp(
              [
                0,
                0,
                0,
                255
              ],
              [
                255,
                255,
                255,
                255
              ]
            ),
            ramp(
              [
                10,
                20,
                30
              ],
              [
                200,
                100,
                0,
                128
              ]
            )
          ],
          "tint"
        ).ramp ).toEqual( {
          from: [
            10,
            20,
            30
          ],
          to: [
            200,
            100,
            0,
            128
          ]
        } );

        expect( describeFieldBinding(
          [
            ramp(
              "red",
              [
                1,
                2,
                3
              ]
            )
          ],
          "tint"
        ).ramp ).toBeNull();
      }
    );

    it(
      "takes an enum's cycle from the last playing layer, the one that wins the fold",
      () => {
        const state = describeFieldBinding(
          [
            {
              source: "ramp",
              target: "palette",
              kind: "enum",
              mapping: {
                values: [
                  "a",
                  "b"
                ]
              }
            },
            {
              source: "sequence",
              target: "palette",
              kind: "enum",
              mapping: {
                values: [
                  "a",
                  "b",
                  "c",
                  "d"
                ]
              }
            }
          ],
          "palette"
        );

        expect( state.values ).toEqual( [
          "a",
          "b",
          "c",
          "d"
        ] );
        expect( state.range ).toBeNull();
      }
    );
  }
);

describe(
  "vector3d as a bindable kind",
  () => {
    it(
      "maps the 3D control to its own kind",
      () => {
        expect( bindingKindFor( "vector3d" ) ).toBe( "vector3d" );
      }
    );

    it(
      "starts on a generator sweeping each axis' whole range, per-axis overrides first",
      () => {
        const binding = makeDefaultBinding(
          "light",
          "vector3d",
          {
            component: "vector3d",
            zAxis: {
              min: 0,
              max: 10
            }
          } as any
        );

        expect( binding.source ).toBe( "oscillator" );
        expect( binding.mapping ).toEqual( {
          x: {
            min: -1,
            max: 1
          },
          y: {
            min: -1,
            max: 1
          },
          z: {
            min: 0,
            max: 10
          },
          curve: "linear"
        } );
      }
    );
  }
);
