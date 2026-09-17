/**
 * The field context menu is assembled by conditional spreads, so its callers
 * write the separators between groups unconditionally and any group can turn
 * out to be empty. These cover what that leaves behind.
 */
import {
  withoutDanglingSeparators
} from "../FieldContextMenu";
import type {
  FieldContextMenuItem
} from "../FieldContextMenu";

const SEPARATOR: FieldContextMenuItem = {
  separator: true
};

function action( label: string ): FieldContextMenuItem {
  return {
    label,
    onClick: () => undefined
  };
}

function labels( items: FieldContextMenuItem[] ): string[] {
  return items.map( ( item ) => ( "separator" in item
    ? "—"
    : item.label ) );
}

describe(
  "withoutDanglingSeparators",
  () => {
    it(
      "keeps a separator that actually parts two groups",
      () => {
        expect( labels( withoutDanglingSeparators( [
          action( "apply" ),
          SEPARATOR,
          action( "learn" )
        ] ) ) ).toEqual( [
          "apply",
          "—",
          "learn"
        ] );
      }
    );

    it(
      "drops a leading separator — the first group was absent",
      () => {
        expect( labels( withoutDanglingSeparators( [
          SEPARATOR,
          action( "learn" )
        ] ) ) ).toEqual( [
          "learn"
        ] );
      }
    );

    it(
      "drops a trailing separator — the last group was absent",
      () => {
        expect( labels( withoutDanglingSeparators( [
          action( "apply" ),
          SEPARATOR
        ] ) ) ).toEqual( [
          "apply"
        ] );
      }
    );

    it(
      "collapses consecutive separators — a middle group was absent",
      () => {
        expect( labels( withoutDanglingSeparators( [
          action( "apply" ),
          SEPARATOR,
          SEPARATOR,
          action( "gauge" )
        ] ) ) ).toEqual( [
          "apply",
          "—",
          "gauge"
        ] );
      }
    );

    it(
      "returns nothing for a menu of separators alone",
      () => {
        expect( withoutDanglingSeparators( [
          SEPARATOR,
          SEPARATOR
        ] ) ).toEqual( [] );
        expect( withoutDanglingSeparators( [] ) ).toEqual( [] );
      }
    );
  }
);
