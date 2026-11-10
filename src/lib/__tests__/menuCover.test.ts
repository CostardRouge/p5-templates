import {
  coverMenu, isMenuCovered, subscribeMenuCover
} from "../menuCover";

describe(
  "the menu cover",
  () => {
    it(
      "holds while any cover is held, and a release counts once",
      () => {
        const seen: boolean[] = [];
        const stop = subscribeMenuCover( () => seen.push( isMenuCovered() ) );

        expect( isMenuCovered() ).toBe( false );

        const first = coverMenu();
        const second = coverMenu();

        first();
        first();
        expect( isMenuCovered() ).toBe( true );

        second();
        expect( isMenuCovered() ).toBe( false );
        expect( seen ).toEqual( [
          true,
          true,
          true,
          false
        ] );
        stop();
      }
    );
  }
);
