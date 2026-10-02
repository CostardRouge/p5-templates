import {
  describeFieldBinding
} from "../useFieldBinding";
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
          ramp: null
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
