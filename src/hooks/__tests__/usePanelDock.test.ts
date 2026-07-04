/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  __resetPanelDock, usePanelDock
} from "../usePanelDock";

const STORAGE_KEY = "p5-templates:panel-dock";

describe(
  "usePanelDock",
  () => {
    beforeEach( () => {
      localStorage.clear();
      __resetPanelDock();
    } );

    it(
      "defaults both sides to floating",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toEqual( {
          left: false,
          right: false
        } );
        expect( result.current.allDocked ).toBe( false );
      }
    );

    it(
      "toggles a single side without affecting the other",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        act( () => result.current.toggleDock( "left" ) );

        expect( result.current.docked ).toEqual( {
          left: true,
          right: false
        } );

        act( () => result.current.toggleDock( "left" ) );

        expect( result.current.docked.left ).toBe( false );
      }
    );

    it(
      "docks and floats both sides through setAllDocked",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        act( () => result.current.setAllDocked( true ) );

        expect( result.current.docked ).toEqual( {
          left: true,
          right: true
        } );
        expect( result.current.allDocked ).toBe( true );

        act( () => result.current.setAllDocked( false ) );

        expect( result.current.docked ).toEqual( {
          left: false,
          right: false
        } );
      }
    );

    it(
      "shares state between separate hook instances",
      () => {
        const first = renderHook( () => usePanelDock() );
        const second = renderHook( () => usePanelDock() );

        act( () => first.result.current.toggleDock( "right" ) );

        expect( second.result.current.docked.right ).toBe( true );
      }
    );

    it(
      "persists dock state to localStorage",
      () => {
        const {
          result
        } = renderHook( () => usePanelDock() );

        act( () => result.current.toggleDock( "right" ) );

        expect( JSON.parse( localStorage.getItem( STORAGE_KEY ) ?? "{}" ) ).toEqual( {
          left: false,
          right: true
        } );
      }
    );

    it(
      "restores persisted dock state on mount",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify( {
            left: true,
            right: false
          } )
        );

        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toEqual( {
          left: true,
          right: false
        } );
      }
    );

    it(
      "ignores malformed persisted values and falls back to the default",
      () => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify( {
            left: "yes"
          } )
        );

        const {
          result
        } = renderHook( () => usePanelDock() );

        expect( result.current.docked ).toEqual( {
          left: false,
          right: false
        } );
      }
    );
  }
);
