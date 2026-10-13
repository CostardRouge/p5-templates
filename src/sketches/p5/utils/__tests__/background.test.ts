/**
 * @jest-environment jsdom
 */
import {
  resolveBackground
} from "../background.js";
import {
  PALETTES
} from "../palettes.js";

// `rainbow` is both a colors.js function (which has no paper) and a shared
// preset (which has one): which one a palette id means is the sketch's call.
describe(
  "resolveBackground and the palette's paper",
  () => {
    const value = {
      top: [
        1,
        2,
        3
      ],
      bottom: [
        4,
        5,
        6
      ],
      source: "palette"
    };
    const paper = ( PALETTES as unknown as Record<string, { paper: { top: number[];
      bottom: number[] } }> ).rainbow.paper;

    it(
      "keeps the sketch's own colours for a colors.js id, which has no paper",
      () => {
        const resolved = resolveBackground(
          value,
          {
            palette: "rainbow"
          }
        );

        expect( resolved.slice(
          0,
          3
        ) ).toEqual( [
          1,
          2,
          3
        ] );
      }
    );

    it(
      "takes the preset's paper when every id is a shared preset",
      () => {
        const resolved = resolveBackground(
          value,
          {
            palette: "rainbow",
            presetsOnly: true
          }
        );

        expect( resolved.slice(
          0,
          3
        ) ).toEqual( paper.top );
        expect( ( resolved.spec as { to: number[] } ).to.slice(
          0,
          3
        ) ).toEqual( paper.bottom );
      }
    );

    it(
      "falls back to its own colours on the custom look",
      () => {
        const resolved = resolveBackground(
          value,
          {
            palette: "custom",
            presetsOnly: true
          }
        );

        expect( ( resolved.spec as { to: number[] } ).to.slice(
          0,
          3
        ) ).toEqual( [
          4,
          5,
          6
        ] );
      }
    );
  }
);
