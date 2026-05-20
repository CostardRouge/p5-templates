import type React from "react";
import {
  useEffect, useRef, useState
} from "react";
import {
  FormProvider, useFieldArray, useWatch
} from "react-hook-form";
import initOptions from "@/utils/initOptions";
import useRecordingStatusStream from "@/hooks/useRecordingStatusStream";
import type {
  JobModel
} from "@/types/recording.types";
import type {
  SketchOption, SlideOption
} from "@/types/sketch.types";
import useSketch from "../SketchProvider/hooks/useSketch";
import CaptureActions, {
  type CaptureActionsRef
} from "./components/CaptureActions";
import useBrowserRecordingSupported from "./components/CaptureActions/hooks/useBrowserRecordingSupported";
import OptionsPanel from "./components/OptionsPanel";
import RecordingLockBanner from "./components/RecordingLockBanner";
import SketchSettings from "./components/SketchSettings/SketchSettings";
import TemplateAssetsProvider from "./components/TemplateAssetsProvider/TemplateAssetsProvider";
import {
  useFormState
} from "./hooks/useFormState";
import {
  useRecordingLifecycle
} from "./hooks/useRecordingLifecycle";
import {
  useSlideManagement
} from "./hooks/useSlideManagement";
import {
  useThumbnails
} from "./hooks/useThumbnails";
import {
  useCollapsibleStates, CollapsibleProvider
} from "./hooks/useCollapsibleStates";

type TemplateOptionsProps = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: (
    nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void )
  ) => void;
  onActiveSlideChange?: ( index: number | undefined ) => void;
  enableThumbnails?: boolean;
};

export default function TemplateOptions( {
  name,
  persistedJob,
  onOptionsChange,
  onActiveSlideChange,
  options: initialOptions,
  enableThumbnails = true // Enable by default now
}: TemplateOptionsProps ) {
  const browserRecordingSupported = useBrowserRecordingSupported();
  const captureActionsRef = useRef<CaptureActionsRef>( null );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>( null );

  // Live recording status stream — lifted here so both the banner and
  // CaptureActions observe the same updates.
  const {
    subscribeToRecordingStatus, recordingProgress
  } = useRecordingStatusStream();

  // Single source of truth for the recording lifecycle. Derived from the
  // persisted job (server snapshot) and the live status stream.
  const lifecycle = useRecordingLifecycle( {
    persistedJob,
    recordingProgress,
    jobId: persistedJob?.id
  } );

  // Loading state for the banner's clone CTA. Kept here (not in CaptureActions)
  // because the banner is the consumer that needs to reflect it.
  const [
    bannerCloning,
    setBannerCloning
  ] = useState( false );

  const handleBannerClone = async() => {
    if ( !captureActionsRef.current ) {
      return;
    }
    setBannerCloning( true );
    try {
      await captureActionsRef.current.cloneAsDraft();
    } finally {
      setBannerCloning( false );
    }
  };

  // Form state management
  const {
    methods
  } = useFormState( {
    initialOptions,
    canAutoSave: lifecycle.canAutoSave,
    onOptionsChange,
    captureActionsRef: captureActionsRef as React.RefObject<CaptureActionsRef>
  } );

  const {
    control, getValues, setValue, reset
  } = methods;

  // Sync form with external options changes (e.g., from sketch interactions)
  // useEffect(
  //   () => {
  //     const processedOptions = initOptions( initialOptions );
  //     const currentFormValues = getValues();
  //
  //     // Only reset if the options actually changed to avoid unnecessary re-renders
  //     if ( JSON.stringify( processedOptions ) !== JSON.stringify( currentFormValues ) ) {
  //       reset( processedOptions );
  //     }
  //   },
  //   [
  //     initialOptions,
  //     reset,
  //     getValues
  //   ]
  // );

  const {
    fields: slideFields,
    append: appendSlide,
    insert: insertSlide,
    move: moveSlide,
    remove: removeSlide
  } = useFieldArray( {
    control,
    name: "slides"
  } );

  const slides = useWatch( {
    control,
    name: "slides"
  } ) as SlideOption[] | undefined;
  const jobId = useWatch( {
    control,
    name: "id"
  } ) as string | undefined;

  const [
    {
      backendRecording, sketchFormValues
    }
  ] = useSketch();

  // Thumbnail management (only when enabled)
  const {
    thumbnails,
    captureThumbnail,
    captureCurrentSlide,
    copyThumbnail,
    pendingThumbnailCaptureRef
  } = useThumbnails( {
    enabled: enableThumbnails,
    persistedJob,
    slideFields
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
    handleRenameSlide
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
    copyThumbnail: enableThumbnails ? copyThumbnail : undefined,
    enableThumbnails,
    pendingThumbnailCaptureRef
  } );

  // Collapsible section states
  const {
    states: collapsibleStates,
    toggleSection,
    setSection
  } = useCollapsibleStates();

  // Debounce thumbnail capture: refresh the active slide's thumbnail 1 second
  // after the user stops changing form values (e.g., releasing a slider).
  useEffect(
    () => {
      if ( !enableThumbnails ) {
        return;
      }

      const subscription = methods.watch( () => {
        if ( activeSlideIndex === undefined ) {
          return;
        }

        const slideId = slideFields[ activeSlideIndex ]?.id;

        if ( !slideId ) {
          return;
        }

        if ( debounceTimerRef.current !== null ) {
          clearTimeout( debounceTimerRef.current );
        }

        debounceTimerRef.current = setTimeout(
          () => {
            debounceTimerRef.current = null;
            void captureCurrentSlide(
              slideId,
              activeSlideIndex
            );
          },
          1000
        );
      } );

      return () => {
        subscription.unsubscribe();

        if ( debounceTimerRef.current !== null ) {
          clearTimeout( debounceTimerRef.current );
          debounceTimerRef.current = null;
        }
      };
    },
    [
      enableThumbnails,
      methods,
      activeSlideIndex,
      slideFields,
      captureCurrentSlide
    ]
  );

  // Lazy-capture a thumbnail when visiting a slide that lacks one
  useEffect(
    () => {
      if ( !enableThumbnails || activeSlideIndex === undefined ) {
        return;
      }

      const slideId = slideFields[ activeSlideIndex ]?.id;

      // Skip if a pending add/duplicate capture is already scheduled
      if ( !slideId || thumbnails[ slideId ] || pendingThumbnailCaptureRef.current !== null ) {
        return;
      }

      const timeoutId = setTimeout(
        () => {
          captureCurrentSlide(
            slideId,
            activeSlideIndex
          );
        },
        150
      );

      return () => clearTimeout( timeoutId );
    },
    [
      enableThumbnails,
      activeSlideIndex,
      slideFields,
      thumbnails,
      captureCurrentSlide,
      pendingThumbnailCaptureRef
    ]
  );

  // Capture thumbnail for newly added slides
  useEffect(
    () => {
      if ( !enableThumbnails || pendingThumbnailCaptureRef.current === null ) {
        return;
      }

      const slideIndex = pendingThumbnailCaptureRef.current;
      const slideId = slideFields[ slideIndex ]?.id;

      if ( !slideId ) {
        pendingThumbnailCaptureRef.current = null;
        return;
      }

      // Give the sketch enough time to initialise slide mode before capturing.
      // Use captureCurrentSlide (no slideIndex) to avoid waitForSlideRendered
      // racing against a freshly created slide that hasn't set data-slide yet.
      const timeoutId = setTimeout(
        () => {
          captureCurrentSlide( slideId );
          pendingThumbnailCaptureRef.current = null;
        },
        600
      );

      return () => clearTimeout( timeoutId );
    },
    [
      slideFields,
      captureCurrentSlide,
      enableThumbnails,
      pendingThumbnailCaptureRef
    ]
  );

  const handleImportOptions = ( importedOptions: SketchOption ) => {
    const processedOptions = initOptions( importedOptions );

    reset( processedOptions );
  };

  return (
    <FormProvider { ...methods }>
      <CollapsibleProvider>
        <div
          className="w-64 absolute right-2 bottom-2 md:right-4 md:bottom-4 space-y-2"
          style={ {
            maxWidth: "calc(50% - 0.75rem)"
          } }
        >
          {lifecycle.isLocked && (
            <RecordingLockBanner
              state={ lifecycle.state }
              onClone={ handleBannerClone }
              cloning={ bannerCloning }
            />
          )}

          <OptionsPanel
            methods={ methods }
            name={ name }
            persistedJob={ persistedJob }
            activeSlideIndex={ activeSlideIndex }
            slideFields={ slideFields }
            thumbnails={ thumbnails }
            slides={ slides }
            jobStatus={ lifecycle.currentStatus }
            isAdding={ isAdding }
            onAddSlide={ handleAddSlide }
            onSelectSlide={ handleSlideSelect }
            onReorderSlides={ handleReorderSlides }
            onDuplicateSlide={ handleDuplicateSlide }
            onDeleteSlide={ handleDeleteSlide }
            onRenameSlide={ handleRenameSlide }
            onImportOptions={ handleImportOptions }
            enableThumbnails={ enableThumbnails }
            collapsibleStates={ collapsibleStates }
            onCollapsibleToggle={ toggleSection }
          />

          {( backendRecording || browserRecordingSupported ) && (
            <CaptureActions
              ref={ captureActionsRef }
              name={ name }
              options={ methods.watch() }
              persistedJob={ persistedJob }
              activeSlideIndex={ activeSlideIndex }
              backendRecording={ backendRecording }
              browserRecordingSupported={ browserRecordingSupported }
              thumbnails={ enableThumbnails ? thumbnails : {} }
              lifecycle={ lifecycle }
              recordingProgress={ recordingProgress }
              subscribeToRecordingStatus={ subscribeToRecordingStatus }
            />
          )}
        </div>

        <TemplateAssetsProvider scope="global" assetsName="assets" jobId={ jobId }>
          <SketchSettings
            activeSlideIndex={ activeSlideIndex }
            expanded={ collapsibleStates.sketchSettings }
            onToggle={ ( expanded ) => setSection(
              "sketchSettings",
              expanded
            ) }
          />
        </TemplateAssetsProvider>
      </CollapsibleProvider>
    </FormProvider>
  );
}
