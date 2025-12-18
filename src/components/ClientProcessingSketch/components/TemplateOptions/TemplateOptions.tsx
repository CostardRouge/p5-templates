import React, {
  useEffect, useRef
} from "react";
import UnsavedChangesModal from "@/components/UnsavedChangesModal";
import {
  JobModel
} from "@/types/recording.types";
import {
  SketchOption, SlideOption
} from "@/types/sketch.types";
import CaptureActions, {
  CaptureActionsRef
} from "./components/CaptureActions";
import TemplateAssetsProvider from "./components/TemplateAssetsProvider/TemplateAssetsProvider";
import {
  FormProvider, useFieldArray, useWatch
} from "react-hook-form";
import SketchSettings from "./components/SketchSettings/SketchSettings";
import useBrowserRecordingSupported from "./components/CaptureActions/hooks/useBrowserRecordingSupported";
import useSketch from "../SketchProvider/hooks/useSketch";
import initOptions from "@/components/utils/initOptions";
import {
  useThumbnails
} from "./hooks/useThumbnails";
import {
  useSlideManagement
} from "./hooks/useSlideManagement";
import {
  useFormState
} from "./hooks/useFormState";
import OptionsPanel from "./components/OptionsPanel";

type TemplateOptionsProps = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: ( nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ) ) => void;
  onActiveSlideChange?: ( index: number | undefined ) => void;
  enableThumbnails?: boolean;
}

export default function TemplateOptions( {
  name,
  persistedJob,
  onOptionsChange,
  onActiveSlideChange,
  options: initialOptions,
  enableThumbnails = true, // Enable by default now
}: TemplateOptionsProps ) {
  const browserRecordingSupported = useBrowserRecordingSupported();
  const captureActionsRef = useRef<CaptureActionsRef>( null );

  // Form state management
  const {
    methods, setHasUnsavedChanges, showModal, handleStay, handleSaveAsDraft, handleLeaveWithoutSaving
  } =
    useFormState( {
      initialOptions,
      persistedJob,
      onOptionsChange,
      captureActionsRef: captureActionsRef as React.RefObject<CaptureActionsRef>,
    } );

  const {
    control, getValues, setValue, reset
  } = methods;

  const {
    fields: slideFields, append: appendSlide, insert: insertSlide, move: moveSlide, remove: removeSlide
  } = useFieldArray( {
    control,
    name: "slides",
  } );

  const slides = useWatch( {
    control,
    name: "slides"
  } ) as SlideOption[] | undefined;
  const jobId = useWatch( {
    control,
    name: "id"
  } ) as string | undefined;

  const {
    backendRecording, sketchFormValues
  } = useSketch();

  // Thumbnail management (only when enabled)
  const {
    thumbnails, captureThumbnail, captureCurrentSlide, clearThumbnails, pendingThumbnailCaptureRef
  } = useThumbnails( {
    enabled: enableThumbnails,
    persistedJob,
    slideFields,
  } );

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
  } = useSlideManagement( {
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
  } );

  const slideIds = slideFields.map( ( field ) => field.id );

  // Capture thumbnail for newly added slides
  useEffect(
    () => {
      if ( !enableThumbnails || pendingThumbnailCaptureRef.current === null ) {
        return;
      }

      const slideIndex = pendingThumbnailCaptureRef.current;
      const slideId = slideFields[ slideIndex ]?.id;

      if ( slideId ) {
        requestAnimationFrame( () => {
          setTimeout(
            async() => {
              await captureThumbnail( slideId );
            },
            300
          );
        } );
      }

      pendingThumbnailCaptureRef.current = null;
    },
    [
      slideFields,
      captureThumbnail,
      enableThumbnails,
      pendingThumbnailCaptureRef
    ]
  );

  const handleImportOptions = ( importedOptions: SketchOption ) => {
    const processedOptions = initOptions( importedOptions );

    reset( processedOptions );
    setHasUnsavedChanges( true );
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

        {( backendRecording || browserRecordingSupported ) && (
          <CaptureActions
            ref={captureActionsRef}
            name={name}
            options={methods.watch()}
            persistedJob={persistedJob}
            activeSlideIndex={activeSlideIndex}
            backendRecording={backendRecording}
            browserRecordingSupported={browserRecordingSupported}
            thumbnails={enableThumbnails ? thumbnails : {
            }}
          />
        )}
      </div>

      <TemplateAssetsProvider scope="global" assetsName="assets" jobId={jobId}>
        <SketchSettings activeSlideIndex={activeSlideIndex} />
      </TemplateAssetsProvider>
    </FormProvider>
  );
}

