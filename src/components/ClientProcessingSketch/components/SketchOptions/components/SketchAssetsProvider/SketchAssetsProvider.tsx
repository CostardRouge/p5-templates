"use client";

import React from "react";

import SketchAssetsContext from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/contexts/SketchAssetsContext";
import type {
  SketchAssetsContextType
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/SketchAssetsProvider/types/SketchAssetsProviderTypes";

export default function SketchAssetsProvider( {
  children,
  assetsName,
  scope,
  jobId
}: React.PropsWithChildren<SketchAssetsContextType> ) {
  return (
    <SketchAssetsContext.Provider
      value={ {
        scope,
        assetsName,
        jobId
      } }
    >
      {children}
    </SketchAssetsContext.Provider>
  );
}
