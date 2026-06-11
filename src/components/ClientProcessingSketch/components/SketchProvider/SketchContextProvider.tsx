"use client";

import React, {
  useEffect, useMemo, useReducer, useRef
} from "react";
import SketchContext from "./contexts/SketchContext";
import type {
  SketchState, SketchAction, SketchContextProviderProps
} from "./types/SketchContextType";
import {
  setSketchOptions,
  subscribeSketchOptions
} from "@/lib/syncSketchOptions";
import type {
  SketchOption
} from "@/types/sketch.types";

function sketchReducer(
  state: SketchState, action: SketchAction
): SketchState {
  switch ( action.type ) {
    case "SET_OPTIONS":
      return {
        ...state,
        options: action.payload
      };
    case "SET_LOADED":
      return {
        ...state,
        sketchLoaded: action.payload
      };
    case "SET_ACTIVE_SLIDE":
      if ( state.activeSlideIndex === action.payload ) {
        return state;
      }

      return {
        ...state,
        activeSlideIndex: action.payload
      };
    case "SET_ENGINE":
      return {
        ...state,
        engine: action.payload
      };
    case "SET_LOOPING":
      return {
        ...state,
        looping: action.payload
      };
    case "SET_CAPTURING":
      return {
        ...state,
        capturing: action.payload
      };
    case "SET_BROWSER_RECORDING":
      return {
        ...state,
        browserRecording: action.payload
      };
    default:
      return state;
  }
}

export default function SketchContextProvider( {
  children,
  ...props
}: React.PropsWithChildren<SketchContextProviderProps> ) {
  const initialState: SketchState = {
    ...props,
    sketchLoaded: false,
    engine: null,
    looping: true,
    browserRecording: false
  };

  const [
    state,
    dispatch
  ] = useReducer(
    sketchReducer,
    initialState
  );

  /* ---- React → p5 sync ------------------------------------------ */

  // Stable refs so the options effect doesn’t re-fire on engine/looping
  // changes — it only re-fires when options actually change.
  const engineRef = useRef( state.engine );
  const loopingRef = useRef( state.looping );

  engineRef.current = state.engine;
  loopingRef.current = state.looping;

  useEffect(
    () => {
      setSketchOptions(
        state.options,
        "react"
      );

      // When the loop is paused, trigger a single redraw so parameter
      // changes are visible immediately without pressing Play.
      if ( !loopingRef.current && engineRef.current ) {
        engineRef.current.redraw();
      }
    },
    [
      state.options
    ]
  );

  /* ---- p5 → React sync ------------------------------------------ */
  useEffect(
    () =>
      subscribeSketchOptions( (
        opts: Record<string, any>, origin?: string
      ) => {
        if ( origin !== "react" ) {
          dispatch( {
            type: "SET_OPTIONS",
            payload: opts as SketchOption
          } );
        }
      } ),
    []
  );

  const value = useMemo<[SketchState, React.Dispatch<SketchAction>]>(
    () => [
      state,
      dispatch
    ],
    [
      state
    ]
  );

  return (
    <SketchContext.Provider value={ value }>{children}</SketchContext.Provider>
  );
}
