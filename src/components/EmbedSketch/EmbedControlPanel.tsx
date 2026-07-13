"use client";

import {
  ChevronDown, SlidersHorizontal
} from "lucide-react";
import clsx from "clsx";
import {
  useEffect, useMemo, useRef, useState
} from "react";
import {
  FormProvider, useForm
} from "react-hook-form";
import FieldRenderer
  from "@/components/ClientProcessingSketch/components/SketchOptions/components/FieldRenderer";
import {
  CollapsibleProvider
} from "@/components/ClientProcessingSketch/components/SketchOptions/hooks/useCollapsibleStates";
import type {
  FieldConfig
} from "@/components/ClientProcessingSketch/components/SketchOptions/components/ContentItems/constants/field-config";
import {
  resolveEmbedControls
} from "@/lib/embedControls";
import {
  setSketchOptions
} from "@/lib/syncSketchOptions";
import type {
  SketchOption
} from "@/types/sketch.types";

type EmbedControlPanelProps = {
  /** Mount options (defaults + URL-fragment delta) — the form's initial state. */
  mountOptions: SketchOption;
  formConfiguration?: Record<string, FieldConfig>;
  /** Parsed `#c=` whitelist (may contain the "*" all-token). */
  controls: string[];
};

/**
 * The in-embed control strip: renders the whitelisted subset of a sketch's
 * form fields with the SAME `FieldRenderer` the studio uses, wired to the live
 * options store. Mounted only when `#c=` is present, and loaded as its own
 * chunk (dynamic import from the client), so a control-less embed never pays
 * for the form machinery.
 */
export default function EmbedControlPanel( {
  mountOptions,
  formConfiguration,
  controls
}: EmbedControlPanelProps ) {
  const resolved = useMemo(
    () => resolveEmbedControls(
      formConfiguration,
      controls
    ),
    [
      formConfiguration,
      controls
    ]
  );

  const methods = useForm<SketchOption>( {
    mode: "onChange",
    defaultValues: mountOptions
  } );

  const {
    watch
  } = methods;

  const [
    open,
    setOpen
  ] = useState( true );

  // Push form edits into the global options store (rAF-throttled, same cadence
  // as the studio). The running sketch reads that store live, so a slider drag
  // re-parameterises the canvas on the next frame.
  const rafRef = useRef<number | null>( null );
  const latestRef = useRef<SketchOption | null>( null );

  useEffect(
    () => {
      const subscription = watch( ( value ) => {
        latestRef.current = value as SketchOption;

        if ( rafRef.current === null ) {
          rafRef.current = requestAnimationFrame( () => {
            rafRef.current = null;

            const sketch = latestRef.current?.sketch;

            if ( sketch ) {
              setSketchOptions(
                {
                  sketch
                },
                "embed"
              );
            }
          } );
        }
      } );

      return () => {
        subscription.unsubscribe();

        if ( rafRef.current !== null ) {
          cancelAnimationFrame( rafRef.current );
          rafRef.current = null;
        }
      };
    },
    [
      watch
    ]
  );

  if ( resolved.length === 0 ) {
    return null;
  }

  return (
    <FormProvider { ...methods }>
      <CollapsibleProvider>
        <div className="embed-controls glass">
          <button
            type="button"
            onClick={ () => setOpen( ( value ) => !value ) }
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-foreground"
            aria-expanded={ open }
          >
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Controls
            </span>
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform"
              style={ {
                transform: open ? "rotate(0deg)" : "rotate(-90deg)"
              } }
            />
          </button>

          <div
            className={ clsx(
              "overflow-y-auto overscroll-contain px-3 transition-all",
              open ? "max-h-[55vh] pb-3" : "max-h-0"
            ) }
          >
            <div className="flex flex-col gap-2">
              {resolved.map( ( control ) => (
                <FieldRenderer
                  key={ control.path }
                  fieldBasePath={ control.fieldBasePath }
                  fieldName={ control.fieldName }
                  config={ control.config }
                />
              ) )}
            </div>
          </div>
        </div>
      </CollapsibleProvider>
    </FormProvider>
  );
}
