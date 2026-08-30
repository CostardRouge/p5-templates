/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  __resetDevActions,
  getDevActionsPreference,
  setDevActionsPreference,
  subscribeDevActions,
  useDevActions
} from "../useDevActions";

const STORAGE_KEY = "sketchbook:dev-actions";

describe(
  "useDevActions",
  () => {
    beforeEach( () => {
      localStorage.clear();
      __resetDevActions();
    } );

    it(
      "keeps the dev actions hidden until they are asked for",
      () => {
        // The whole point: a fresh studio looks like the shipped product, so a
        // demo screenshot needs no cropping.
        const {
          result
        } = renderHook( () => useDevActions() );

        expect( result.current.devActionsVisible ).toBe( false );
      }
    );

    it(
      "remembers the choice across mounts",
      () => {
        setDevActionsPreference( true );
        expect( localStorage.getItem( STORAGE_KEY ) ).toBe( "true" );

        __resetDevActions();

        expect( getDevActionsPreference() ).toBe( true );
      }
    );

    it(
      "notifies every consumer, since the flag is read by separate React trees",
      () => {
        const seen: boolean[] = [];
        const unsubscribe = subscribeDevActions( () => seen.push( getDevActionsPreference() ) );

        act( () => setDevActionsPreference( true ) );
        unsubscribe();
        act( () => setDevActionsPreference( false ) );

        expect( seen ).toEqual( [
          true
        ] );
      }
    );

    it(
      "survives unreadable storage rather than throwing",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          "{ not json"
        );

        expect( getDevActionsPreference() ).toBe( false );
      }
    );

    it(
      "ignores a stored value that is not a boolean",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify( "yes" )
        );

        expect( getDevActionsPreference() ).toBe( false );
      }
    );

    it(
      "pins the flag false where the affordances were never compiled in",
      () => {
        // Jest runs with NODE_ENV=test, which is not "development". Even with
        // the preference stored true, the hook must report hidden — that is the
        // production guarantee, and the reason the build gate lives on the read
        // rather than on the store.
        setDevActionsPreference( true );

        const {
          result
        } = renderHook( () => useDevActions() );

        expect( getDevActionsPreference() ).toBe( true );
        expect( result.current.devActionsVisible ).toBe( false );
        expect( result.current.devActionsAvailable ).toBe( false );
      }
    );
  }
);
