/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  __resetLiveSlideThumbnail,
  getLiveSlideThumbnail,
  LIVE_SLIDE_THUMBNAIL_KEY,
  setLiveSlideThumbnail,
  useLiveSlideThumbnail
} from "../useLiveSlideThumbnail";

describe(
  "useLiveSlideThumbnail",
  () => {
    beforeEach( () => {
      localStorage.clear();
      __resetLiveSlideThumbnail();
    } );

    it(
      "is on until someone turns it off",
      () => {
        const {
          result
        } = renderHook( () => useLiveSlideThumbnail() );

        expect( result.current.liveSlideThumbnail ).toBe( true );
      }
    );

    it(
      "remembers the choice across mounts",
      () => {
        setLiveSlideThumbnail( false );
        expect( localStorage.getItem( LIVE_SLIDE_THUMBNAIL_KEY ) ).toBe( "false" );

        __resetLiveSlideThumbnail();

        expect( getLiveSlideThumbnail() ).toBe( false );
      }
    );

    it(
      "toggles from the current value and re-renders its readers",
      () => {
        const {
          result
        } = renderHook( () => useLiveSlideThumbnail() );

        act( () => result.current.toggleLiveSlideThumbnail() );
        expect( result.current.liveSlideThumbnail ).toBe( false );

        act( () => result.current.toggleLiveSlideThumbnail() );
        expect( result.current.liveSlideThumbnail ).toBe( true );
      }
    );
  }
);
