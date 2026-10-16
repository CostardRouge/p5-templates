import {
  deepMerge
} from "../utils.js";

describe(
  "deepMerge",
  () => {
    it(
      "merges an object delta into an object, key by key",
      () => {
        expect( deepMerge(
          {
            colors: {
              a: 1,
              b: 2
            }
          },
          {
            colors: {
              b: 3
            }
          }
        ) ).toEqual( {
          colors: {
            a: 1,
            b: 3
          }
        } );
      }
    );

    it(
      "replaces an array with an object whole — a colour that became a gradient",
      () => {
        const merged = deepMerge(
          {
            backgroundColor: [
              0,
              0,
              0
            ]
          },
          {
            backgroundColor: {
              kind: "linear",
              angle: 90
            }
          }
        );

        expect( Array.isArray( merged.backgroundColor ) ).toBe( false );
        expect( merged.backgroundColor ).toEqual( {
          kind: "linear",
          angle: 90
        } );
      }
    );
  }
);
