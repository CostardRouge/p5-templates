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
          values: null
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
