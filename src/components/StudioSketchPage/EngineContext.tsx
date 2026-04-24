"use client";

import React, { createContext, useContext } from "react";
import type { SketchEngine } from "@/engines/types";

const EngineContext = createContext<SketchEngine | null>( null );

export function EngineProvider( {
  engine,
  children,
}: {
  engine: SketchEngine | null;
  children: React.ReactNode;
} ) {
  return (
    <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
  );
}

export function useEngine(): SketchEngine | null {
  return useContext( EngineContext );
}
