/**
 * Unit tests for `groupKeyPaths` — the shaping the HUD source picker relies on
 * to render `colors.text` as a "text" option inside a "colors" optgroup while
 * the stored value stays the full key-path.
 */

import {
  collectBranchPaths, groupKeyPaths
} from "../keyPaths.js";

describe(
  "groupKeyPaths",
  () => {
    it(
      "keeps dot-less keys as root options",
      () => {
        const {
          rootOptions, groups
        } = groupKeyPaths( [
          "size",
          "count"
        ] );

        expect( rootOptions ).toEqual( [
          {
            value: "size",
            label: "size"
          },
          {
            value: "count",
            label: "count"
          }
        ] );
        expect( groups ).toEqual( [] );
      }
    );

    it(
      "groups dotted keys by their parent path, keeping the full path as value",
      () => {
        const {
          rootOptions, groups
        } = groupKeyPaths( [
          "colors.text",
          "colors.background",
          "magnitude.start"
        ] );

        expect( rootOptions ).toEqual( [] );
        expect( groups ).toEqual( [
          {
            label: "colors",
            options: [
              {
                value: "colors.text",
                label: "text"
              },
              {
                value: "colors.background",
                label: "background"
              }
            ]
          },
          {
            label: "magnitude",
            options: [
              {
                value: "magnitude.start",
                label: "start"
              }
            ]
          }
        ] );
      }
    );

    it(
      "groups a nested key by its whole parent path",
      () => {
        const {
          groups
        } = groupKeyPaths( [
          "grid.cell.size"
        ] );

        expect( groups ).toEqual( [
          {
            label: "grid.cell",
            options: [
              {
                value: "grid.cell.size",
                label: "size"
              }
            ]
          }
        ] );
      }
    );

    it(
      "preserves the settings-tree order across both buckets",
      () => {
        const {
          rootOptions, groups
        } = groupKeyPaths( [
          "seed",
          "colors.text",
          "count",
          "colors.background"
        ] );

        expect( rootOptions.map( ( option ) => option.value ) ).toEqual( [
          "seed",
          "count"
        ] );
        expect( groups ).toHaveLength( 1 );
        expect( groups[ 0 ].options.map( ( option ) => option.value ) ).toEqual( [
          "colors.text",
          "colors.background"
        ] );
      }
    );
  }
);

describe(
  "collectBranchPaths",
  () => {
    it(
      "lists every distinct ancestor path, outermost first",
      () => {
        expect( collectBranchPaths( [
          "seed",
          "colors.text",
          "colors.background",
          "grid.cell.size"
        ] ) ).toEqual( [
          "colors",
          "grid",
          "grid.cell"
        ] );
      }
    );

    it(
      "returns nothing for a flat key list",
      () => {
        expect( collectBranchPaths( [
          "seed",
          "count"
        ] ) ).toEqual( [] );
      }
    );
  }
);
