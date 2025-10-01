"use client";

import React from "react";
import {
  useFormContext
} from "react-hook-form";

import deepClone from "@/utils/deepClone";

import FormUndoRedoContext from "./contexts/FormUndoRedoContext";

import type {
  FormUndoRedoAutoCaptureMode, FormUndoRedoStacks, FormUndoRedoContextType
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/FormUndoRedo/types/FormUndoRedo.types";

export type FormUndoRedoProps = {
  maxHistory?: number; // default 50
  hotkeys?: boolean; // Cmd/Ctrl+Z (+Shift)/Ctrl+Y. default true
  captureInitial?: boolean; // push initial state as first undo step. default false
  autoCapture?: FormUndoRedoAutoCaptureMode; // "off" | "debounced". default "off"
  debounceMs?: number; // for "debounced" mode. default 400
  watchPaths?: string[]; // e.g., ["slides", "content"] to limit tracking
  resetOptions?: Parameters<ReturnType<typeof useFormContext>["reset"]>[1];
  children?: React.ReactNode; // optional UI (buttons, etc.)
};
export default function FormUndoRedo( {
  maxHistory = 50,
  hotkeys = true,
  captureInitial = false,
  autoCapture = "off",
  debounceMs = 400,
  watchPaths,
  resetOptions,
  children,
}: FormUndoRedoProps ) {
  const {
    watch, getValues, reset
  } = useFormContext();

  const stacksRef = React.useRef<FormUndoRedoStacks>( {
    past: [
    ],
    future: [
    ]
  } );

  const [
    canUndo,
    setCanUndo
  ] = React.useState( false );
  const [
    canRedo,
    setCanRedo
  ] = React.useState( false );

  const lastCommittedRef = React.useRef<any | null>( null );
  const lastCommittedHashRef = React.useRef<string | null>( null );

  const inReplayRef = React.useRef( false ); // true while undo/redo reset is happening
  const pauseCountRef = React.useRef( 0 ); // >=1 => paused
  const debounceTimerRef = React.useRef<number | null>( null );

  const paused = () => pauseCountRef.current > 0;

  const stableHash = ( obj: any ) => {
    try {
      // @ts-ignore
      return typeof structuredClone === "function"
        ? JSON.stringify( obj ) // stringify is fine for plain form data
        : JSON.stringify( obj );
    } catch {
      return JSON.stringify( obj );
    }
  };

  const snapshot = React.useCallback(
    () => deepClone( getValues() ),
    [
      getValues
    ]
  );

  const syncFlags = React.useCallback(
    () => {
      const {
        past, future
      } = stacksRef.current;

      setCanUndo( past.length > 0 );
      setCanRedo( future.length > 0 );
    },
    [
    ]
  );

  const pushPreviousCommitted = React.useCallback(
    () => {
    // Push the last committed snapshot (the state before the current change)
      if ( lastCommittedRef.current == null ) return;
      const stacks = stacksRef.current;

      stacks.past.push( deepClone( lastCommittedRef.current ) );
      if ( stacks.past.length > maxHistory ) stacks.past.shift();
      stacks.future = [
      ]; // new edits clear redo chain
      syncFlags();
    },
    [
      maxHistory,
      syncFlags
    ]
  );

  const setCommitted = React.useCallback(
    ( state: any ) => {
      lastCommittedRef.current = deepClone( state );
      lastCommittedHashRef.current = stableHash( state );
    },
    [
    ]
  );

  const undo = React.useCallback(
    () => {
      const stacks = stacksRef.current;

      if ( !stacks.past.length ) {
        return;
      }

      inReplayRef.current = true;

      try {
        const prev = stacks.past.pop()!;
        // Save current as redo target
        const current = snapshot();

        stacks.future.push( current );
        reset(
          prev,
          resetOptions
        );
        setCommitted( prev ); // update last committed to the state we just reset to
        syncFlags();
      } finally {
      // allow a microtask so RHF finishes notify; then re-enable capture
        queueMicrotask( () => { inReplayRef.current = false; } );
      }
    },
    [
      reset,
      resetOptions,
      snapshot,
      setCommitted,
      syncFlags
    ]
  );

  const redo = React.useCallback(
    () => {
      const stacks = stacksRef.current;

      if ( !stacks.future.length ) return;

      inReplayRef.current = true;
      try {
        const next = stacks.future.pop()!;
        // Save current into past so we can undo the redo
        const current = snapshot();

        stacks.past.push( current );
        reset(
          next,
          resetOptions
        );
        setCommitted( next );
        syncFlags();
      } finally {
        queueMicrotask( () => { inReplayRef.current = false; } );
      }
    },
    [
      reset,
      resetOptions,
      snapshot,
      setCommitted,
      syncFlags
    ]
  );

  const clear = React.useCallback(
    () => {
      stacksRef.current = {
        past: [
        ],
        future: [
        ]
      };
      syncFlags();
    },
    [
      syncFlags
    ]
  );

  const pause = React.useCallback(
    () => {
      pauseCountRef.current += 1;
    },
    [
    ]
  );
  const resume = React.useCallback(
    () => {
      pauseCountRef.current = Math.max(
        0,
        pauseCountRef.current - 1
      );
    },
    [
    ]
  );
  const runSilently = React.useCallback(
    ( fn: () => void ) => {
      pause();
      try {
        fn();
      } finally {
        resume();
      }
    },
    [
      pause,
      resume
    ]
  );

  // Initialize last committed snapshot (and optionally capture as first undo step)
  React.useEffect(
    () => {
      const initial = snapshot();

      setCommitted( initial );
      if ( captureInitial ) {
        stacksRef.current.past.push( deepClone( initial ) );
        syncFlags();
      }
    },
    [
    ]
  );

  // Hotkeys
  React.useEffect(
    () => {
      if ( !hotkeys ) return;

      const isTextEditingTarget = ( el: EventTarget | null ) => {
        const node = el as HTMLElement | null;

        if ( !node ) return false;
        const tag = node.tagName;

        if ( tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ) return true;
        if ( node.isContentEditable ) return true;
        return false;
      };

      const onKeyDown = ( e: KeyboardEvent ) => {
        if ( !( e.metaKey || e.ctrlKey ) ) return;
        if ( isTextEditingTarget( e.target ) ) return;
        const key = e.key.toLowerCase();

        if ( key === "z" ) {
          e.preventDefault();
          if ( e.shiftKey ) redo();
          else undo();
        } else if ( key === "y" ) {
          e.preventDefault();
          redo();
        }
      };

      window.addEventListener(
        "keydown",
        onKeyDown
      );
      return () => window.removeEventListener(
        "keydown",
        onKeyDown
      );
    },
    [
      hotkeys,
      undo,
      redo
    ]
  );

  // Auto-capture via RHF watch subscription
  React.useEffect(
    () => {
      if ( autoCapture === "off" ) return;

      const shouldTrack = ( name?: string ) => {
        if ( !watchPaths || watchPaths.length === 0 ) return true;
        if ( !name ) return true; // some ops may not report a specific field name
        return watchPaths.some( ( p ) => name === p || name.startsWith( p + "." ) );
      };

      // Subscribe without causing re-renders
      const sub = watch( (
        _, info
      ) => {
        if ( inReplayRef.current || paused() ) return;
        if ( !shouldTrack( info?.name ) ) return;

        // Debounce capture
        if ( debounceTimerRef.current ) {
          window.clearTimeout( debounceTimerRef.current );
        }
        debounceTimerRef.current = window.setTimeout(
          () => {
            if ( inReplayRef.current || paused() ) return;

            const next = snapshot();
            const nextHash = stableHash( next );

            if ( nextHash !== lastCommittedHashRef.current ) {
              // State changed => record previous committed state, then commit the new one
              pushPreviousCommitted();
              setCommitted( next );
            }
          },
          debounceMs
        );
      } );

      return () => {
        if ( debounceTimerRef.current ) window.clearTimeout( debounceTimerRef.current );
        sub.unsubscribe();
      };
    },
    [
      autoCapture,
      debounceMs,
      watch,
      watchPaths,
      pushPreviousCommitted,
      setCommitted
    ]
  );

  const value = React.useMemo<FormUndoRedoContextType>(
    () => ( {
      undo,
      redo,
      clear,
      canUndo,
      canRedo,
      pause,
      resume,
      runSilently
    } ),
    [
      undo,
      redo,
      clear,
      canUndo,
      canRedo,
      pause,
      resume,
      runSilently
    ]
  );

  return <FormUndoRedoContext.Provider value={value}>{children ?? null}</FormUndoRedoContext.Provider>;
}
