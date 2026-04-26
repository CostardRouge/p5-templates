"use client";

import React, {
  useEffect, useMemo, useReducer
} from "react";
import SketchContext from "./contexts/SketchContext";
import type {
  SketchState, SketchAction, SketchContextProviderProps
} from "./types/SketchContextType";
import {
  setSketchOptions,
  subscribeSketchOptions,
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
      return {
        ...state,
        activeSlideIndex: action.payload
      };
    case "SET_ENGINE":
      return {
        ...state,
        engine: action.payload
      };
    case "SET_CAPTURING":
      return {
        ...state,
        capturing: action.payload
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
  };

  const [
    state,
    dispatch
  ] = useReducer(
    sketchReducer,
    initialState
  );

  /* ---- React → p5 sync ------------------------------------------ */
  useEffect(
    () => {
      setSketchOptions(
        state.options,
        "react"
      );
    },
    [
      state.options
    ],
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
    [
    ],
  );

  const value = useMemo<[SketchState, React.Dispatch<SketchAction>]>(
    () => [
      state,
      dispatch
    ],
    [
      state
    ],
  );

  return (
    <SketchContext.Provider value={value}>{children}</SketchContext.Provider>
  );
}
