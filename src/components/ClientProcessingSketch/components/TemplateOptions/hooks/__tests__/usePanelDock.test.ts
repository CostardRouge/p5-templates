/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  usePanelDock
} from "../usePanelDock";

const STORAGE_KEY = "p5-templates:panel-dock";

describe(
  "usePanelDock",
  () => {
    beforeEach( () => {
      localStorage.clear();
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
