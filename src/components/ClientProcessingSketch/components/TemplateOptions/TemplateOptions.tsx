import type React from "react";
import { useEffect, useRef } from "react";
import { FormProvider, useFieldArray, useWatch } from "react-hook-form";
import UnsavedChangesModal from "@/components/UnsavedChangesModal";
import initOptions from "@/components/utils/initOptions";
import type { JobModel } from "@/types/recording.types";
import type { SketchOption, SlideOption } from "@/types/sketch.types";
import useSketch from "../SketchProvider/hooks/useSketch";
import CaptureActions, {
  type CaptureActionsRef,
} from "./components/CaptureActions";
import useBrowserRecordingSupported from "./components/CaptureActions/hooks/useBrowserRecordingSupported";
import OptionsPanel from "./components/OptionsPanel";
import SketchSettings from "./components/SketchSettings/SketchSettings";
import TemplateAssetsProvider from "./components/TemplateAssetsProvider/TemplateAssetsProvider";
import { useFormState } from "./hooks/useFormState";
import { useSlideManagement } from "./hooks/useSlideManagement";
import { useThumbnails } from "./hooks/useThumbnails";

type TemplateOptionsProps = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: (
    nextOptions: SketchOption | ((existingOptions: SketchOption) => void)
  ) => void;
  onActiveSlideChange?: (index: number | undefined) => void;
  enableThumbnails?: boolean;
};

export default function TemplateOptions({
  name,
  persistedJob,
  onOptionsChange,
  onActiveSlideChange,
  options: initialOptions,
  enableThumbnails = true, // Enable by default now
}: TemplateOptionsProps) {
  const browserRecordingSupported = useBrowserRecordingSupported();
  const captureActionsRef = useRef<CaptureActionsRef>(null);
  const pendingPeriodicThumbnailCaptureRef = useRef<{
    slideId: string;
    slideIndex: number;
  } | null>(null);
  const periodicCaptureInFlightRef = useRef(false);

  // Form state management
  const {
    methods,
    setHasUnsavedChanges,
    showModal,
    handleStay,
    handleSaveAsDraft,
    handleLeaveWithoutSaving,
  } = useFormState({
    initialOptions,
    persistedJob,
    onOptionsChange,
    captureActionsRef: captureActionsRef as React.RefObject<CaptureActionsRef>,
  });

  const { control, getValues, setValue, reset } = methods;

  const {
    fields: slideFields,
    append: appendSlide,
    insert: insertSlide,
    move: moveSlide,
    remove: removeSlide,
  } = useFieldArray({
    control,
    name: "slides",
  });

  const slides = useWatch({
    control,
    name: "slides",
  }) as SlideOption[] | undefined;
  const jobId = useWatch({
    control,
    name: "id",
  }) as string | undefined;

  const { backendRecording, sketchFormValues } = useSketch();

  // Thumbnail management (only when enabled)
  const {
    thumbnails,
    captureThumbnail,
    captureCurrentSlide,
    pendingThumbnailCaptureRef,
  } = useThumbnails({
    enabled: enableThumbnails,
    persistedJob,
    slideFields,
  });

  // Slide management
  const {
    activeSlideIndex,
    isAdding,
    handleSlideSelect,
    handleAddSlide,
    handleDuplicateSlide,
    handleDeleteSlide,
    handleReorderSlides,
    handleRenameSlide,
  } = useSlideManagement({
    slideFields,
    appendSlide,
    insertSlide,
    moveSlide,
    removeSlide,
    getValues,
    setValue,
    sketchFormValues,
    onActiveSlideChange,
    captureThumbnail: enableThumbnails ? captureThumbnail : undefined,
    enableThumbnails,
    pendingThumbnailCaptureRef,
  });

  // Mark the active slide thumbnail as stale on any form change.
  // A periodic task below refreshes it at most every 5s.
  useEffect(() => {
    if (!enableThumbnails) {
      return;
    }

    const subscription = methods.watch(() => {
      if (activeSlideIndex === undefined) {
        return;
      }

      const slideId = slideFields[activeSlideIndex]?.id;

      if (!slideId) {
        return;
      }

      pendingPeriodicThumbnailCaptureRef.current = {
        slideId,
        slideIndex: activeSlideIndex,
      };
    });

    return () => subscription.unsubscribe();
  }, [enableThumbnails, methods, activeSlideIndex, slideFields]);

  // Refresh thumbnails periodically (best-effort), so changes in sketch settings
  // are reflected even if the user doesn't switch slides.
  useEffect(() => {
    if (!enableThumbnails) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const pending = pendingPeriodicThumbnailCaptureRef.current;

      if (!pending || periodicCaptureInFlightRef.current) {
        return;
      }

      periodicCaptureInFlightRef.current = true;

      try {
        await captureCurrentSlide(pending.slideId, pending.slideIndex);
      } finally {
        pendingPeriodicThumbnailCaptureRef.current = null;
        periodicCaptureInFlightRef.current = false;
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [enableThumbnails, captureCurrentSlide]);

  // Lazy-capture a thumbnail when visiting a slide that lacks one
  useEffect(() => {
    if (!enableThumbnails || activeSlideIndex === undefined) {
      return;
    }

    const slideId = slideFields[activeSlideIndex]?.id;

    if (!slideId || thumbnails[slideId]) {
      return;
    }

    const timeoutId = setTimeout(() => {
      captureCurrentSlide(slideId, activeSlideIndex);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [
    enableThumbnails,
    activeSlideIndex,
    slideFields,
    thumbnails,
    captureCurrentSlide,
  ]);

  // Capture thumbnail for newly added slides
  useEffect(() => {
    if (!enableThumbnails || pendingThumbnailCaptureRef.current === null) {
      return;
    }

    const slideIndex = pendingThumbnailCaptureRef.current;
    const slideId = slideFields[slideIndex]?.id;

    if (!slideId) {
      pendingThumbnailCaptureRef.current = null;
      return;
    }

    // Give the sketch time to render the newly selected slide
    const timeoutId = setTimeout(() => {
      captureThumbnail(slideId, slideIndex);
      pendingThumbnailCaptureRef.current = null;
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    slideFields,
    captureThumbnail,
    enableThumbnails,
    pendingThumbnailCaptureRef,
  ]);

  const handleImportOptions = (importedOptions: SketchOption) => {
    const processedOptions = initOptions(importedOptions);

    reset(processedOptions);
    setHasUnsavedChanges(true);
  };

  return (
    <FormProvider {...methods}>
      <UnsavedChangesModal
        isOpen={showModal}
        onStay={handleStay}
        onSaveAsDraft={handleSaveAsDraft}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        isSaving={captureActionsRef.current?.isSaving}
      />

      <div
        className="w-64 absolute right-2 bottom-2 space-y-2"
        style={{
          maxWidth: "calc(50% - 0.75rem)",
        }}
      >
        <OptionsPanel
          methods={methods}
          name={name}
          persistedJob={persistedJob}
          activeSlideIndex={activeSlideIndex}
          slideFields={slideFields}
          thumbnails={thumbnails}
          slides={slides}
          jobStatus={captureActionsRef.current?.currentStatus}
          isAdding={isAdding}
          onAddSlide={handleAddSlide}
          onSelectSlide={handleSlideSelect}
          onReorderSlides={handleReorderSlides}
          onDuplicateSlide={handleDuplicateSlide}
          onDeleteSlide={handleDeleteSlide}
          onRenameSlide={handleRenameSlide}
          onImportOptions={handleImportOptions}
          enableThumbnails={enableThumbnails}
        />

        {(backendRecording || browserRecordingSupported) && (
          <CaptureActions
            ref={captureActionsRef}
            name={name}
            options={methods.watch()}
            persistedJob={persistedJob}
            activeSlideIndex={activeSlideIndex}
            backendRecording={backendRecording}
            browserRecordingSupported={browserRecordingSupported}
            thumbnails={enableThumbnails ? thumbnails : {}}
          />
        )}
      </div>

      <TemplateAssetsProvider scope="global" assetsName="assets" jobId={jobId}>
        <SketchSettings activeSlideIndex={activeSlideIndex} />
      </TemplateAssetsProvider>
    </FormProvider>
  );
}
