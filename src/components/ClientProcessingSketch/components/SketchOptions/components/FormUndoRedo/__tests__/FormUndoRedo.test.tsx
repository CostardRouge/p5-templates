/**
 * @jest-environment jsdom
 */
import React from "react";
import {
  act, renderHook
} from "@testing-library/react";
import {
  FormProvider, useForm, useFormContext
} from "react-hook-form";

import FormUndoRedo from "../FormUndoRedo";
import useFormUndoRedo from "../hooks/useFormUndoRedo";

/* ------------------------------------------------------------------ */
/*  Harness                                                             */
/* ------------------------------------------------------------------ */

// autoCapture="immediate" keeps the tests synchronous (no debounce timers);
// the debounced mode funnels into the same capture() path.
function makeWrapper( autoCapture: "immediate" | "debounced" ) {
  return function Wrapper( {
    children
  }: React.PropsWithChildren ) {
    const methods = useForm( {
      defaultValues: {
        title: "initial",
        nested: {
          count: 0
        }
      }
    } );

    return (
      <FormProvider { ...methods }>
        <FormUndoRedo autoCapture={ autoCapture } hotkeys={ false }>
          {children}
        </FormUndoRedo>
      </FormProvider>
    );
  };
}

function renderHarness( autoCapture: "immediate" | "debounced" = "immediate" ) {
  return renderHook(
    () => ( {
      history: useFormUndoRedo(),
      form: useFormContext()
    } ),
    {
      wrapper: makeWrapper( autoCapture )
    }
  );
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe(
  "FormUndoRedo",
  () => {
    it(
      "starts with no history",
      () => {
        const {
          result
        } = renderHarness();

        expect( result.current.history.canUndo ).toBe( false );
        expect( result.current.history.canRedo ).toBe( false );
      }
    );

    it(
      "a single undo restores the state before the last change",
      async() => {
        const {
          result
        } = renderHarness();

        await act( async() => {
          result.current.form.setValue(
            "title",
            "edited"
          );
        } );

        expect( result.current.history.canUndo ).toBe( true );

        await act( async() => {
          result.current.history.undo();
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "initial" );
        expect( result.current.history.canUndo ).toBe( false );
        expect( result.current.history.canRedo ).toBe( true );
      }
    );

    it(
      "redo restores the undone change",
      async() => {
        const {
          result
        } = renderHarness();

        await act( async() => {
          result.current.form.setValue(
            "title",
            "edited"
          );
        } );

        await act( async() => {
          result.current.history.undo();
        } );

        await act( async() => {
          result.current.history.redo();
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "edited" );
        expect( result.current.history.canUndo ).toBe( true );
        expect( result.current.history.canRedo ).toBe( false );
      }
    );

    it(
      "walks a multi-step history in both directions",
      async() => {
        const {
          result
        } = renderHarness();

        await act( async() => {
          result.current.form.setValue(
            "title",
            "one"
          );
        } );

        await act( async() => {
          result.current.form.setValue(
            "title",
            "two"
          );
        } );

        await act( async() => {
          result.current.history.undo();
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "one" );

        await act( async() => {
          result.current.history.undo();
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "initial" );
        expect( result.current.history.canUndo ).toBe( false );

        await act( async() => {
          result.current.history.redo();
        } );

        await act( async() => {
          result.current.history.redo();
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "two" );
        expect( result.current.history.canRedo ).toBe( false );
      }
    );

    it(
      "a new change after undo clears the redo stack",
      async() => {
        const {
          result
        } = renderHarness();

        await act( async() => {
          result.current.form.setValue(
            "title",
            "one"
          );
        } );

        await act( async() => {
          result.current.history.undo();
        } );

        expect( result.current.history.canRedo ).toBe( true );

        await act( async() => {
          result.current.form.setValue(
            "title",
            "fresh"
          );
        } );

        expect( result.current.history.canRedo ).toBe( false );

        await act( async() => {
          result.current.history.undo();
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "initial" );
      }
    );

    it(
      "tracks nested paths and restores them on undo",
      async() => {
        const {
          result
        } = renderHarness();

        await act( async() => {
          result.current.form.setValue(
            "nested.count",
            5
          );
        } );

        await act( async() => {
          result.current.history.undo();
        } );

        expect( result.current.form.getValues( "nested.count" ) ).toBe( 0 );
      }
    );

    it(
      "runSilently suppresses history capture",
      async() => {
        const {
          result
        } = renderHarness();

        await act( async() => {
          result.current.history.runSilently( () => {
            result.current.form.setValue(
              "title",
              "silent"
            );
          } );
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "silent" );
        expect( result.current.history.canUndo ).toBe( false );
      }
    );

    it(
      "jumpTo replays several past entries in one go, and back again",
      async() => {
        const {
          result
        } = renderHarness();

        for ( const title of [
          "one",
          "two",
          "three"
        ] ) {
          await act( async() => {
            result.current.form.setValue(
              "title",
              title
            );
          } );
        }

        // Jump to the middle of the past stack: undoes "three" and "two".
        await act( async() => {
          result.current.history.jumpTo(
            1,
            "past"
          );
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "one" );
        expect( result.current.history.canUndo ).toBe( true );
        expect( result.current.history.canRedo ).toBe( true );

        // Jump to the far end of the future stack: redoes both again.
        await act( async() => {
          result.current.history.jumpTo(
            0,
            "future"
          );
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "three" );
        expect( result.current.history.canRedo ).toBe( false );

        // The moved entries went back in replayable order.
        await act( async() => {
          result.current.history.undo();
        } );

        expect( result.current.form.getValues( "title" ) ).toBe( "two" );
      }
    );

    it(
      "undo commits a pending debounced edit instead of discarding it",
      async() => {
        jest.useFakeTimers();

        try {
          const {
            result
          } = renderHarness( "debounced" );

          await act( async() => {
            result.current.form.setValue(
              "title",
              "edited"
            );
          } );

          // The debounce (400 ms) has not fired — nothing committed yet.
          expect( result.current.history.canUndo ).toBe( false );

          await act( async() => {
            result.current.history.undo();
          } );

          expect( result.current.form.getValues( "title" ) ).toBe( "initial" );
          expect( result.current.history.canRedo ).toBe( true );

          await act( async() => {
            result.current.history.redo();
          } );

          expect( result.current.form.getValues( "title" ) ).toBe( "edited" );
        } finally {
          jest.useRealTimers();
        }
      }
    );

    it(
      "clear drops both stacks",
      async() => {
        const {
          result
        } = renderHarness();

        await act( async() => {
          result.current.form.setValue(
            "title",
            "one"
          );
        } );

        await act( async() => {
          result.current.history.undo();
        } );

        await act( async() => {
          result.current.history.clear();
        } );

        expect( result.current.history.canUndo ).toBe( false );
        expect( result.current.history.canRedo ).toBe( false );
      }
    );
  }
);
