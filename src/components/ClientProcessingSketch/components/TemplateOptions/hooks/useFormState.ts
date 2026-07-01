import {
  zodResolver
} from "@hookform/resolvers/zod";
import {
  useEffect, useRef, useState
} from "react";
import {
  UseFormReturn, useForm
} from "react-hook-form";
import initOptions from "@/utils/initOptions";
import {
  playValueChange
} from "@/lib/uiSound";
import {
  useInterval
} from "@/hooks/useInterval";
import {
  OptionsSchema,
  type SketchOption,
  type SketchOptionInput
} from "@/types/sketch.types";
import type {
  CaptureActionsRef
} from "../components/CaptureActions";

type UseFormStateProps = {
  initialOptions: SketchOption;
  canAutoSave: boolean;
  onOptionsChange: (
    nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void )
  ) => void;
  captureActionsRef: React.RefObject<CaptureActionsRef>;
};

export function useFormState( {
  initialOptions,
  canAutoSave,
  onOptionsChange,
  captureActionsRef
}: UseFormStateProps ) {
  const methods = useForm<SketchOptionInput>( {
    mode: "onChange",
    defaultValues: initOptions( initialOptions ),
    resolver: zodResolver( OptionsSchema )
  } );

  const {
    watch
  } = methods;

  const jobId = methods.watch( "id" ) as string | undefined;

  // Store initial values to detect actual changes
  const initialValuesRef = useRef<SketchOptionInput>( initOptions( initialOptions ) );

  // Watch for changes and propagate to parent (throttled to ~60 Hz via rAF)
  const rafRef = useRef<number | null>( null );
  const latestValueRef = useRef<SketchOption | null>( null );

  useEffect(
    () => {
      const subscription = watch( (
        value, info
      ) => {
        // Audible tick on real value edits (sliders, inputs, action buttons).
        // Form-level events (reset, initial populate) carry no field name and
        // stay silent. Muting/throttling lives inside the sound module.
        if ( info?.name ) {
          playValueChange( info.name );
        }

        latestValueRef.current = value as SketchOption;

        if ( rafRef.current === null ) {
          rafRef.current = requestAnimationFrame( () => {
            rafRef.current = null;

            if ( latestValueRef.current !== null ) {
              onOptionsChange( latestValueRef.current );
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
      watch,
      onOptionsChange
    ]
  );

  // Auto-save every 10 seconds when allowed by the lifecycle (draft state)
  useInterval( {
    callback: async() => {
      if ( captureActionsRef.current && !captureActionsRef.current.isSaving ) {
        await captureActionsRef.current.saveAsDraft();
      }
    },
    enabled: !!jobId && canAutoSave,
    intervalMs: 10000 // 10 seconds
  } );

  return {
    methods
  };
}
