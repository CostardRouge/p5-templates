"use client";
import React, {
  createContext, useContext
} from "react";
import type {
  JobId
} from "@/types/recording.types";

export type Scope = "global" | {
 slide: number
};

type Ctx = {
  scope: Scope;
  assetsName: string; // e.g. "assets" | `slides.${slide}.assets`
  jobId?: JobId;
};

const TemplateAssetsContext = createContext<Ctx | null>( null );

export function TemplateAssetsProvider( {
  children,
  scope,
  assetsName,
  jobId,
}: React.PropsWithChildren<Ctx> ) {
  return (
    <TemplateAssetsContext.Provider value={{
      scope,
      assetsName,
      jobId
    }}>
      {children}
    </TemplateAssetsContext.Provider>
  );
}

export function useTemplateAssets() {
  const ctx = useContext( TemplateAssetsContext );

  if ( !ctx ) {
    // Safe defaults if someone forgets to wrap (won’t crash)
    return {
      scope: "global" as const,
      assetsName: "assets",
      jobId: undefined
    };
  }

  return ctx;
}
