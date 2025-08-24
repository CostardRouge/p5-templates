"use client";

import React from "react";

import TemplateAssetsContext from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/contexts/TemplateAssetsContext";
import type {
  TemplateAssetsContextType
} from "@/components/ClientProcessingSketch/components/TemplateOptions/components/TemplateAssetsProvider/types/TemplateAssetsProviderTypes";

export default function TemplateAssetsProvider( {
  children,
  assetsName,
  scope,
  jobId,
}: React.PropsWithChildren<TemplateAssetsContextType> ) {
  return (
    <TemplateAssetsContext.Provider
      value={{
        scope,
        assetsName,
        jobId
      }}
    >
      { children }
    </TemplateAssetsContext.Provider>
  );
}
