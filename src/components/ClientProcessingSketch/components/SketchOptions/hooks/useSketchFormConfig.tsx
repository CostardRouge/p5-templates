"use client";

import React, {
  createContext, useContext
} from "react";
import type {
  FieldConfig
} from "../components/ContentItems/constants/field-config";

/**
 * The sketch's own form configuration, made reachable from any field.
 *
 * A field normally knows only its own config. A button is the exception: its
 * effect targets ANOTHER field by path, and `randomize` / `reset` need that
 * field's config (its range, its declared default). Rather than thread the
 * root config through every renderer prop, it rides a context the options
 * form provides once — the same shape as `CollapsibleProvider`.
 *
 * Null outside the provider (the embed panel, tests), which every consumer
 * treats as "no target can be resolved" and the effect is a no-op.
 */
const SketchFormConfigContext = createContext<Record<string, FieldConfig> | null>( null );

export function SketchFormConfigProvider( {
  config,
  children
}: {
  config: Record<string, FieldConfig> | undefined;
  children: React.ReactNode;
} ) {
  return (
    <SketchFormConfigContext.Provider value={ config ?? null }>
      {children}
    </SketchFormConfigContext.Provider>
  );
}

export function useSketchFormConfig(): Record<string, FieldConfig> | null {
  return useContext( SketchFormConfigContext );
}
