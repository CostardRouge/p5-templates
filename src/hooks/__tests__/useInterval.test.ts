/**
 * @jest-environment jsdom
 */

import {
  renderHook
} from "@testing-library/react";

import {
  useInterval
} from "@/hooks/useInterval";

describe(
  "useInterval",
  () => {
    beforeEach( () => {
      jest.useFakeTimers();
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    it(
      "keeps its schedule while the caller re-renders with a new inline callback every frame",
      () => {
        const calls: number[] = [];
        const {
          rerender
        } = renderHook(
          ( {
            tick
          } ) => useInterval( {
            callback: () => {
              calls.push( tick );
            },
            enabled: true,
            intervalMs: 10_000
          } ),
          {
            initialProps: {
              tick: 0
            }
          }
        );

        // 12 s of edits at ~60 fps, each one a re-render with a fresh callback.
        for ( let frame = 1; frame <= 720; frame++ ) {
          jest.advanceTimersByTime( 1000 / 60 );
          rerender( {
            tick: frame
          } );
        }

        // It fired at the 10 s mark, with the callback current at that moment.
        expect( calls ).toHaveLength( 1 );
        expect( calls[ 0 ] ).toBeGreaterThanOrEqual( 590 );
      }
    );

    it(
      "stops when disabled",
      () => {
        const callback = jest.fn();
        const {
          rerender
        } = renderHook(
          ( {
            enabled
          } ) => useInterval( {
            callback,
            enabled,
            intervalMs: 1000
          } ),
          {
            initialProps: {
              enabled: true
            }
          }
        );

        jest.advanceTimersByTime( 1000 );
        rerender( {
          enabled: false
        } );
        jest.advanceTimersByTime( 5000 );

        expect( callback ).toHaveBeenCalledTimes( 1 );
      }
    );
  }
);
