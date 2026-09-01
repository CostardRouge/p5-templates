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
    nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ),
    changedPaths?: string[]
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

  // Watch for changes and propagate to parent (throttled to ~60 Hz via rAF;
  // coarse-pointer devices flush at ~25 Hz — see below)
  const rafRef = useRef<number | null>( null );
  const latestValueRef = useRef<SketchOption | null>( null );
  // Dotted field paths edited since the last flush; null means an event
  // carried no field name (reset, initial populate) so the whole tree must
  // be treated as changed.
  const changedPathsRef = useRef<Set<string> | null>( new Set() );

  useEffect(
    () => {
      // Coarse-pointer (touch) devices have less frame budget and a tighter
      // per-tab memory ceiling; flushing every frame during a slider drag
      // buys nothing visually there, so cap them at ~25 Hz.
      const coarsePointer =
        typeof window.matchMedia === "function" &&
        window.matchMedia( "(pointer: coarse)" ).matches;
      const minFlushIntervalMs = coarsePointer ? 40 : 0;

      let lastFlushAt = 0;

      const flush = () => {
        rafRef.current = null;

        const now = performance.now();

        if ( now - lastFlushAt < minFlushIntervalMs ) {
          // Too soon — re-arm so the trailing update still lands.
          rafRef.current = requestAnimationFrame( flush );
          return;
        }

        lastFlushAt = now;

        if ( latestValueRef.current !== null ) {
          const changedPaths = changedPathsRef.current;

          changedPathsRef.current = new Set();
          onOptionsChange(
            latestValueRef.current,
            changedPaths ? Array.from( changedPaths ) : undefined
          );
        }
      };

      const subscription = watch( (
        value, info
      ) => {
        // Audible tick on real value edits (sliders, inputs, action buttons).
        // Form-level events (reset, initial populate) carry no field name and
        // stay silent. Muting/throttling lives inside the sound module.
        if ( info?.name ) {
          playValueChange( info.name );
          changedPathsRef.current?.add( info.name );
        } else {
          changedPathsRef.current = null;
        }

        latestValueRef.current = value as SketchOption;

        if ( rafRef.current === null ) {
          rafRef.current = requestAnimationFrame( flush );
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
