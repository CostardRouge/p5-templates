/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  useDelayedFlag
} from "../useDelayedFlag";

describe(
  "useDelayedFlag",
  () => {
    beforeEach( () => {
      jest.useFakeTimers();
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    it(
      "stays false until the delay has fully elapsed",
      () => {
        const {
          result
        } = renderHook( () => useDelayedFlag(
          true,
          150
        ) );

        expect( result.current ).toBe( false );

        act( () => {
          jest.advanceTimersByTime( 149 );
        } );
        expect( result.current ).toBe( false );

        act( () => {
          jest.advanceTimersByTime( 1 );
        } );
        expect( result.current ).toBe( true );
      }
    );

    it(
      "never fires for work that finishes inside the delay",
      () => {
        // The reason the hook exists: a cached sketch is ready within a frame
        // or two, and a loading screen for that long reads as a flicker.
        const {
          result, rerender
        } = renderHook(
          ( {
            active
          }: { active: boolean } ) => useDelayedFlag(
            active,
            150
          ),
          {
            initialProps: {
              active: true
            }
          }
        );

        act( () => {
          jest.advanceTimersByTime( 80 );
        } );
        rerender( {
          active: false
        } );

        act( () => {
          jest.advanceTimersByTime( 500 );
        } );
        expect( result.current ).toBe( false );
      }
    );

    it(
      "goes false immediately when the work ends, and re-arms the delay",
      () => {
        const {
          result, rerender
        } = renderHook(
          ( {
            active
          }: { active: boolean } ) => useDelayedFlag(
            active,
            150
          ),
          {
            initialProps: {
              active: true
            }
          }
        );

        act( () => {
          jest.advanceTimersByTime( 150 );
        } );
        expect( result.current ).toBe( true );

        rerender( {
          active: false
        } );
        expect( result.current ).toBe( false );

        // A second activation must wait the delay out again rather than
        // showing instantly off the previous run's state.
        rerender( {
          active: true
        } );
        expect( result.current ).toBe( false );

        act( () => {
          jest.advanceTimersByTime( 150 );
        } );
        expect( result.current ).toBe( true );
      }
    );

    it(
      "clears its timer on unmount",
      () => {
        const clear = jest.spyOn(
          global,
          "clearTimeout"
        );
        const {
          unmount
        } = renderHook( () => useDelayedFlag( true ) );

        unmount();

        expect( clear ).toHaveBeenCalled();
        clear.mockRestore();
      }
    );
  }
);
