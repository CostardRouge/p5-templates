/**
 * The matching rule behind `snapKeys` / `excludeKeys`, shared by the breakdown
 * and the montage's lerpParams.
 */

import {
  matchesKeyList
} from "../keyMatch.js";

describe(
  "matchesKeyList",
  () => {
    it(
      "matches the full dotted path",
      () => {
        expect( matchesKeyList(
          "colors.text",
          [
            "colors.text"
          ]
        ) ).toBe( true );
      }
    );

    it(
      "matches the bare leaf name anywhere in the tree",
      () => {
        expect( matchesKeyList(
          "sites.seed",
          [
            "seed"
          ]
        ) ).toBe( true );
      }
    );

    it(
      "matches an ancestor path, covering the whole group",
      () => {
        expect( matchesKeyList(
          "colors.text",
          [
            "colors"
          ]
        ) ).toBe( true );
        expect( matchesKeyList(
          "grid.cell.size",
          [
            "grid"
          ]
        ) ).toBe( true );
      }
    );

    it(
      "does not match a mid-path segment used on its own",
      () => {
        expect( matchesKeyList(
          "grid.cell.size",
          [
            "cell"
          ]
        ) ).toBe( false );
      }
    );

    it(
      "does not match a sibling sharing a prefix",
      () => {
        expect( matchesKeyList(
          "colorsX.text",
          [
            "colors"
          ]
        ) ).toBe( false );
      }
    );

    it(
      "is false for an empty or missing key list",
      () => {
        expect( matchesKeyList(
          "colors.text",
          []
        ) ).toBe( false );
        expect( matchesKeyList(
          "colors.text",
          undefined
        ) ).toBe( false );
      }
    );
  }
);
