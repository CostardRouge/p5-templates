import { useEffect, useRef, useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OptionsSchema, SketchOption, SketchOptionInput } from "@/types/sketch.types";
import initOptions from "@/components/utils/initOptions";
import { useInterval } from "@/hooks/useInterval";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { JobModel } from "@/types/recording.types";
import { CaptureActionsRef } from "../components/CaptureActions";

type UseFormStateProps = {
  initialOptions: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: (nextOptions: SketchOption | ((existingOptions: SketchOption) => void)) => void;
  captureActionsRef: React.RefObject<CaptureActionsRef>;
};

export function useFormState({
  initialOptions,
  persistedJob,
  onOptionsChange,
  captureActionsRef,
}: UseFormStateProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const methods = useForm<SketchOptionInput>({
    mode: "onChange",
    defaultValues: initOptions(initialOptions),
    resolver: zodResolver(OptionsSchema),
  });

  const { watch } = methods;

  const jobId = methods.watch("id") as string | undefined;

  // Watch for changes and propagate to parent
  useEffect(() => {
    const subscription = watch((value) => {
      onOptionsChange(value as SketchOption);

      // Track unsaved changes
      if (persistedJob?.status !== "completed") {
        setHasUnsavedChanges(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, onOptionsChange, jobId, persistedJob?.status]);

  // Auto-save every 10 seconds when jobId exists and status is draft
  useInterval({
    callback: async () => {
      if (captureActionsRef.current && !captureActionsRef.current.isSaving) {
        await captureActionsRef.current.saveAsDraft();
        setHasUnsavedChanges(false);
      }
    },
    enabled: !!jobId && persistedJob?.status === "draft",
    intervalMs: 10000, // 10 seconds
  });

  // Unsaved changes detection - triggers modal on navigation attempts
  const { showModal, handleStay, handleSaveAsDraft, handleLeaveWithoutSaving } = useUnsavedChanges({
    hasUnsavedChanges: hasUnsavedChanges && !captureActionsRef.current?.isRecording,
    onSaveAsDraft: async () => {
      if (captureActionsRef.current) {
        await captureActionsRef.current.saveAsDraft();
        setHasUnsavedChanges(false);
      }
    },
  });

  return {
    methods,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    showModal,
    handleStay,
    handleSaveAsDraft,
    handleLeaveWithoutSaving,
  };
}
