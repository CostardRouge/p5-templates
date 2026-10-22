/**
 * @jest-environment jsdom
 */

import {
  act, renderHook
} from "@testing-library/react";

import {
  useFormState
} from "../useFormState";
import initOptions from "@/utils/initOptions";
import type {
  CaptureActionsRef
} from "../../components/CaptureActions";

jest.mock(
  "@/lib/uiSound",
  () => ( {
    playValueChange: jest.fn()
  } )
);

beforeAll( () => {
  Object.defineProperty(
    window,
    "matchMedia",
    {
      writable: true,
      value: () => ( {
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {}
      } )
    }
  );
} );

function setup( saveAsDraft: jest.Mock ) {
  const captureActionsRef = {
    current: {
      saveAsDraft,
      cloneAsDraft: jest.fn(),
      isRecording: false,
      isSaving: false
    } as CaptureActionsRef
  };

  return renderHook( () => useFormState( {
    initialOptions: initOptions( {
      id: "3f1c2a9e-7b4d-4c1a-9e2f-0a1b2c3d4e5f"
    } ),
    canAutoSave: true,
    onOptionsChange: jest.fn(),
    captureActionsRef
  } ) );
}

function edit(
  result: ReturnType<typeof setup>[ "result" ], value: string
) {
  act( () => {
    result.current.methods.setValue(
      "name",
      value
    );
  } );
}

describe(
  "useFormState autosave",
  () => {
    beforeEach( () => {
      jest.useFakeTimers();
    } );

    afterEach( () => {
      jest.useRealTimers();
    } );

    it(
      "does not save a draft nobody touched",
      async() => {
        const saveAsDraft = jest.fn().mockResolvedValue( true );

        setup( saveAsDraft );

        await act( async() => {
          jest.advanceTimersByTime( 60_000 );
        } );

        expect( saveAsDraft ).not.toHaveBeenCalled();
      }
    );

    it(
      "saves once after an edit, then waits for the next edit",
      async() => {
        const saveAsDraft = jest.fn().mockResolvedValue( true );
        const {
          result
        } = setup( saveAsDraft );

        edit(
          result,
          "edited"
        );

        await act( async() => {
          jest.advanceTimersByTime( 10_000 );
        } );

        expect( saveAsDraft ).toHaveBeenCalledTimes( 1 );

        await act( async() => {
          jest.advanceTimersByTime( 30_000 );
        } );

        expect( saveAsDraft ).toHaveBeenCalledTimes( 1 );
      }
    );

    it(
      "retries on the next tick when a save fails",
      async() => {
        const saveAsDraft = jest.fn()
          .mockResolvedValueOnce( false )
          .mockResolvedValue( true );
        const {
          result
        } = setup( saveAsDraft );

        edit(
          result,
          "edited"
        );

        await act( async() => {
          jest.advanceTimersByTime( 10_000 );
        } );
        await act( async() => {
          jest.advanceTimersByTime( 10_000 );
        } );
        await act( async() => {
          jest.advanceTimersByTime( 10_000 );
        } );

        expect( saveAsDraft ).toHaveBeenCalledTimes( 2 );
      }
    );
  }
);
