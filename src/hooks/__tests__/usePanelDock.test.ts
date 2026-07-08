/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  __resetPanelDock, usePanelDock
} from "../usePanelDock";

const STORAGE_KEY = "sketchbook:docked-workspace";
const LEGACY_STORAGE_KEY = "p5-templates:docked-workspace";

describe(
  "usePanelDock",
  () => {
    beforeEach( () => {
      localStorage.clear();
      __resetPanelDock();
    } );

    it(
      "defaults to the floating layout",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toBe( false );
      }
    );

    it(
      "toggles the docked layout",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        act( () => result.current.toggleDocked() );
        expect( result.current.docked ).toBe( true );

        act( () => result.current.toggleDocked() );
        expect( result.current.docked ).toBe( false );
      }
    );

    it(
      "sets the docked layout explicitly",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        act( () => result.current.setDocked( true ) );
        expect( result.current.docked ).toBe( true );
      }
    );

    it(
      "shares state between separate hook instances",
      () => {
        const first = renderHook( () => usePanelDock() );
        const second = renderHook( () => usePanelDock() );

        act( () => first.result.current.setDocked( true ) );

        expect( second.result.current.docked ).toBe( true );
      }
    );

    it(
      "persists the docked flag to localStorage",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        act( () => result.current.setDocked( true ) );

        expect( localStorage.getItem( STORAGE_KEY ) ).toBe( "true" );
      }
    );

    it(
      "restores the persisted flag on mount",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          "true"
        );

        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toBe( true );
      }
    );

    it(
      "ignores malformed persisted values and falls back to the default",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          "\"yes\""
        );

        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toBe( false );
      }
    );

    it(
      "migrates the pre-rename p5-templates key forward on first read",
      () => {
        localStorage.setItem(
          LEGACY_STORAGE_KEY,
          "true"
        );

        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toBe( true );
        expect( localStorage.getItem( STORAGE_KEY ) ).toBe( "true" );
        expect( localStorage.getItem( LEGACY_STORAGE_KEY ) ).toBeNull();
      }
    );

    it(
      "prefers the new key over a stale legacy value",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          "false"
        );
        localStorage.setItem(
          LEGACY_STORAGE_KEY,
          "true"
        );

        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toBe( false );
      }
    );
  }
);
