/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  __resetPreviewPlayback,
  CAN_HOVER_QUERY,
  getStoredPreviewPlayback,
  PREVIEW_PLAYBACK_KEY,
  resolvePreviewPlayback,
  setPreviewPlayback,
  subscribePreviewPlayback,
  usePreviewPlayback
} from "../usePreviewPlayback";

// jsdom has no matchMedia: answer the two queries the store asks.
function screen( {
  canHover,
  prefersReducedMotion = false
}: {
  canHover: boolean;
  prefersReducedMotion?: boolean;
} ) {
  window.matchMedia = ( query: string ) => ( {
    matches: query === CAN_HOVER_QUERY ? canHover : query.includes( "reduced-motion" ) && prefersReducedMotion,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  } );
}

describe(
  "resolvePreviewPlayback",
  () => {
    it(
      "plays on hover on a screen that can hover, and shows stills on a touch screen",
      () => {
        expect( resolvePreviewPlayback(
          null,
          {
            canHover: true,
            prefersReducedMotion: false
          }
        ) ).toBe( "hover" );
        // Every visible card decoding a loop at once is too much for a phone.
        expect( resolvePreviewPlayback(
          null,
          {
            canHover: false,
            prefersReducedMotion: false
          }
        ) ).toBe( "off" );
      }
    );

    it(
      "shows stills by default when the system asks for reduced motion",
      () => {
        expect( resolvePreviewPlayback(
          null,
          {
            canHover: true,
            prefersReducedMotion: true
          }
        ) ).toBe( "off" );
      }
    );

    it(
      "lets a stored choice win, reduced motion included",
      () => {
        expect( resolvePreviewPlayback(
          "inview",
          {
            canHover: false,
            prefersReducedMotion: true
          }
        ) ).toBe( "inview" );
      }
    );

    it(
      "never resolves to hover on a screen that cannot hover, where nothing would play",
      () => {
        expect( resolvePreviewPlayback(
          "hover",
          {
            canHover: false,
            prefersReducedMotion: false
          }
        ) ).toBe( "off" );
      }
    );
  }
);

describe(
  "usePreviewPlayback",
  () => {
    beforeEach( () => {
      localStorage.clear();
      __resetPreviewPlayback();
      screen( {
        canHover: true
      } );
    } );

    it(
      "remembers the choice across mounts",
      () => {
        setPreviewPlayback( "inview" );
        expect( localStorage.getItem( PREVIEW_PLAYBACK_KEY ) ).toBe( "\"inview\"" );

        __resetPreviewPlayback();

        expect( getStoredPreviewPlayback() ).toBe( "inview" );
      }
    );

    it(
      "ignores a stored value it does not know",
      () => {
        localStorage.setItem(
          PREVIEW_PLAYBACK_KEY,
          "\"always\""
        );

        expect( getStoredPreviewPlayback() ).toBeNull();
      }
    );

    it(
      "carries the old switch's off over, and drops its on to the default",
      () => {
        localStorage.setItem(
          "sketchbook:animations-enabled",
          "false"
        );
        expect( getStoredPreviewPlayback() ).toBe( "off" );
        expect( localStorage.getItem( PREVIEW_PLAYBACK_KEY ) ).toBe( "\"off\"" );
        expect( localStorage.getItem( "sketchbook:animations-enabled" ) ).toBeNull();

        localStorage.clear();
        __resetPreviewPlayback();
        localStorage.setItem(
          "templates-animations-enabled",
          "true"
        );
        expect( getStoredPreviewPlayback() ).toBeNull();
        expect( localStorage.getItem( "templates-animations-enabled" ) ).toBeNull();
      }
    );

    it(
      "hands every consumer the new mode, since each card reads it",
      () => {
        const {
          result
        } = renderHook( () => usePreviewPlayback() );

        expect( result.current.mode ).toBe( "hover" );

        const seen: ( string | null )[] = [];
        const unsubscribe = subscribePreviewPlayback( () => seen.push( getStoredPreviewPlayback() ) );

        act( () => result.current.setMode( "off" ) );
        unsubscribe();

        expect( result.current.mode ).toBe( "off" );
        expect( seen ).toEqual( [
          "off"
        ] );
      }
    );
  }
);
