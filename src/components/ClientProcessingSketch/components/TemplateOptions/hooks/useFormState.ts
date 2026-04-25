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
  useInterval
} from "@/hooks/useInterval";
import type {
  JobModel
} from "@/types/recording.types";
import {
  OptionsSchema,
  type SketchOption,
  type SketchOptionInput,
} from "@/types/sketch.types";
import type {
  CaptureActionsRef
} from "../components/CaptureActions";

type UseFormStateProps = {
  initialOptions: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: (
    nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void )
  ) => void;
  captureActionsRef: React.RefObject<CaptureActionsRef>;
};

export function useFormState( {
  initialOptions,
  persistedJob,
  onOptionsChange,
  captureActionsRef,
}: UseFormStateProps ) {
  const methods = useForm<SketchOptionInput>( {
    mode: "onChange",
    defaultValues: initOptions( initialOptions ),
    resolver: zodResolver( OptionsSchema ),
  } );

  const {
    watch
  } = methods;

  const jobId = methods.watch( "id" ) as string | undefined;

  // Store initial values to detect actual changes
  const initialValuesRef = useRef<SketchOptionInput>( initOptions( initialOptions ) );

  // Watch for changes and propagate to parent
  useEffect(
    () => {
      const subscription = watch( ( value ) => {
        onOptionsChange( value as SketchOption );
      } );

      return () => subscription.unsubscribe();
    },
    [
      watch,
      onOptionsChange
    ]
  );

  // Auto-save every 10 seconds when jobId exists and status is draft
  useInterval( {
    callback: async() => {
      if ( captureActionsRef.current && !captureActionsRef.current.isSaving ) {
        await captureActionsRef.current.saveAsDraft();
      }
    },
    enabled: !!jobId && persistedJob?.status === "draft",
    intervalMs: 10000, // 10 seconds
  } );

  return {
    methods,
  };
}
