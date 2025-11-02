"use client";

import React from "react";
import SketchContext from "./contexts/SketchContext";
import {
  SketchContextType
} from "@/components/ClientProcessingSketch/components/SketchProvider/types/SketchContextType";

export default function SketchContextProvider( {
  children,
  ...props
}: React.PropsWithChildren<SketchContextType> ) {
  return (
    <SketchContext.Provider
      value={props}
    >
      { children }
    </SketchContext.Provider>
  );
}
