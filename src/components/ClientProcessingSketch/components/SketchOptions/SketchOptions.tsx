import dynamic from "next/dynamic";
import clsx from "clsx";
import type React from "react";
import {
  useEffect, useRef, useState
} from "react";
import {
  createPortal
} from "react-dom";
import {
  FormProvider, useFieldArray, useWatch
} from "react-hook-form";
import initOptions from "@/utils/initOptions";
import {
  withUiSoundSuppressed
} from "@/lib/uiSound";
import useRecordingStatusStream from "@/hooks/useRecordingStatusStream";
import type {
  JobModel
} from "@/types/recording.types";
import type {
  SketchOption, SlideOption
} from "@/types/sketch.types";
import useSketch from "../SketchProvider/hooks/useSketch";
import type {
  CaptureActionsRef
} from "./components/CaptureActions";
import useBrowserRecordingSupported from "./components/CaptureActions/hooks/useBrowserRecordingSupported";
import OptionsPanel from "./components/OptionsPanel";
import {
  FormUndoRedo
} from "./components/FormUndoRedo";
import RecordingLockBanner from "./components/RecordingLockBanner";
import ImportSuccessBanner from "./components/ImportSuccessBanner";
import SketchSettings from "./components/SketchSettings/SketchSettings";
import ExportMenu from "./components/ExportMenu";
import UndoRedo from "./components/UndoRedo";
import InteractivePanel from "./components/InteractivePanel/InteractivePanel";
import SketchAssetsProvider from "./components/SketchAssetsProvider/SketchAssetsProvider";
import useMediaQuery from "@/hooks/useMediaQuery";
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
import {
  ContentSelectionProvider, ContentSelectionListener
} from "./hooks/useContentItemSelection";
import {
  usePanelDock
} from "@/hooks/usePanelDock";
import {
  subscribeSketchOptions
} from "@/lib/syncSketchOptions";
import {
  STUDIO_FILMSTRIP_HEIGHT_VAR
} from "./constants/drawer-events";
import {
  readAndClearPendingImport
} from "@/lib/pendingImportOptions";

// CaptureActions drags the whole recording subtree into the sketch page's
// initial compile: useBrowserRecorder -> @/engines/recording -> createRecorder
// pulls in the mediabunny + gif.js encoders, plus the action buttons and
// VideoPreviewModal. It only renders behind `recordingSupported &&`, so load it
// as a separate chunk. next/dynamic does not forward refs, so the imperative
// handle (auto-save / clone-as-draft) is wired through a `forwardedRef` prop.
const CaptureActions = dynamic( () => import( "./components/CaptureActions" ) );

// MobileStudioDrawer is a full mobile-only duplicate of the panel/settings/
// capture UI (its own CaptureActions, GenericObjectForm, asset providers). It
// renders only on the mobile media-query branch, so desktop should never
// compile it — and the desktop panels are never compiled for mobile. Code-split
// it so each layout's initial compile only covers what it actually shows.
const MobileStudioDrawer = dynamic( () => import( "./components/MobileStudioDrawer" ) );

// The filmstrip drags dnd-kit in; slideless sketches still pay nothing until
// the strip actually renders thumbnails.
const SlideFilmstrip = dynamic( () => import( "./components/SlideFilmstrip" ) );

type SketchOptionsProps = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: (
    nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ),
    changedPaths?: string[]
  ) => void;
  onActiveSlideChange?: ( index: number | undefined ) => void;
  enableThumbnails?: boolean;
  /** Docked top bar cell (owned by SketchPage) that undo/redo and the Export
   *  menu portal into — they need this form context, the bar doesn't have it. */
  topBarActionsContainer?: HTMLElement | null;
};

export default function SketchOptions( {
  name,
  persistedJob,
  onOptionsChange,
  onActiveSlideChange,
  options: initialOptions,
  enableThumbnails = true, // Enable by default now
  topBarActionsContainer
}: SketchOptionsProps ) {
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

  // Success banner shown above the options panel after an import applies —
  // covers both the manual Import button and the sketches-listing handoff,
  // since both funnel through handleImportOptions below.
  const [
    importBanner,
    setImportBanner
  ] = useState<string | null>( null );

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

  // Sync form with sketch-driven option changes (e.g., clicking the canvas to set a point).
  // Only fires for non-"react" origins to avoid feedback loops with the form's own watch().
  useEffect(
    () => {
      function syncLeafValues(
        newObj: unknown, currentObj: unknown, path: string
      ) {
        if (
          newObj === null ||
          newObj === undefined ||
          typeof newObj !== "object" ||
          Array.isArray( newObj )
        ) {
          if ( JSON.stringify( newObj ) !== JSON.stringify( currentObj ) ) {
            setValue(
              path as any,
              newObj,
              {
                shouldDirty: false,
                shouldValidate: false
              }
            );
          }
          return;
        }

        for ( const key of Object.keys( newObj as Record<string, unknown> ) ) {
          const childPath = path ? `${ path }.${ key }` : key;

          syncLeafValues(
            ( newObj as Record<string, unknown> )[ key ],
            ( currentObj as Record<string, unknown> )?.[ key ],
            childPath
          );
        }
      }

      return subscribeSketchOptions( (
        opts, origin
      ) => {
        if ( origin === "react" ) {
          return;
        }
        // Programmatic sync — the sketch pushed these values, not the user.
        // Suppress UI-sound clicks so opening/loading a sketch stays silent.
        withUiSoundSuppressed( () => syncLeafValues(
          opts,
          getValues(),
          ""
        ) );
      } );
    },
    [
      getValues,
      setValue
    ]
  );

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
      backendRecording, sketchFormValues, engine, browserRecording
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
    slideFields,
    engine,
    recording: browserRecording
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

  // Stable identity of the active slide. The sketch settings form edits a
  // positional path (`slides.N.sketch`), so when a structural change — e.g.
  // duplicating an earlier slide — swaps which slide sits at the active index
  // without changing the index itself, the path stays the same and the form
  // would keep each field's stale "saved value" baseline from the previously
  // shown slide. Keying the form by the slide id remounts it on identity
  // changes so the baseline always reflects the slide on screen.
  const activeSlideId =
    activeSlideIndex !== undefined
      ? slideFields[ activeSlideIndex ]?.id
      : undefined;

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
    setImportBanner( "Options imported successfully" );
  };

  // One-shot handoff from the sketches listing page's "Import .json"
  // button: it stashes the parsed options in sessionStorage right before a
  // hard navigation to this sketch, since the listing page and this page
  // are separate mounted trees with no shared React state. Only applies to
  // a fresh (non-persisted) load — a persisted job already has its own
  // import path (ImportOptionsButton -> /api/options/import/:jobId).
  useEffect(
    () => {
      if ( persistedJob ) {
        return;
      }

      const pending = readAndClearPendingImport();

      if ( !pending || typeof pending !== "object" ) {
        return;
      }

      if ( ( pending as {
        name?: unknown;
      } ).name !== name ) {
        return;
      }

      handleImportOptions( pending as SketchOption );
    },
    // Mount-only: this is a one-shot consume (readAndClearPendingImport
    // removes the key on first read), not a reactive sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ≥ md: separate floating panels (general settings right, sketch settings left).
  // Below: a single bottom drawer with Sketch / Settings / Export tabs.
  // The form context above is shared either way — only the layout changes.
  const isDesktop = useMediaQuery( "(min-width: 768px)" );

  // The docked workspace layout (edge-to-edge rails) vs the floating layout
  // (rounded islands in the bottom corners). Desktop-only; a global toggle.
  const {
    docked
  } = usePanelDock();
  const dockedDesktop = isDesktop && docked;

  const hasSlides = slideFields.length > 0;

  // Publish the docked filmstrip band's height so the viewport (SketchPage)
  // can subtract it, the band can size itself and the Interactive mixer can
  // clear it — one value, read through the CSS variable. 7rem fits a slide
  // thumbnail row; 3rem the empty-state invite; 0 outside the docked layout.
  useEffect(
    () => {
      document.documentElement.style.setProperty(
        STUDIO_FILMSTRIP_HEIGHT_VAR,
        dockedDesktop ? ( hasSlides ? "7rem" : "3rem" ) : "0px"
      );

      return () => {
        document.documentElement.style.removeProperty( STUDIO_FILMSTRIP_HEIGHT_VAR );
      };
    },
    [
      dockedDesktop,
      hasSlides
    ]
  );

  const bodyProps = {
    activeSlideIndex,
    slideFields,
    collapsibleStates,
    onCollapsibleToggle: toggleSection
  };

  const filmstripProps = {
    slideFields,
    slides,
    thumbnails: enableThumbnails ? thumbnails : {},
    activeIndex: activeSlideIndex,
    isAdding,
    onAdd: handleAddSlide,
    onSelect: handleSlideSelect,
    onReorder: handleReorderSlides,
    onDuplicate: handleDuplicateSlide,
    onDelete: handleDeleteSlide,
    onRename: handleRenameSlide
  };

  const captureProps = {
    name,
    options: methods.watch(),
    persistedJob,
    backendRecording,
    browserRecordingSupported,
    thumbnails: enableThumbnails ? thumbnails : {},
    lifecycle,
    recordingProgress,
    subscribeToRecordingStatus
  };

  const recordingSupported = Boolean( backendRecording || browserRecordingSupported );

  // The sketch-settings scope the Interactive mixer manages — the active slide's
  // overrides when a slide is selected, otherwise the global sketch settings.
  const sketchBasePath =
    activeSlideIndex !== undefined
      ? `slides.${ activeSlideIndex }.sketch`
      : "sketch";

  return (
    <FormProvider { ...methods }>
      {/* Undo/redo history over the whole options form. Auto-captures a
          snapshot 400ms after the user stops editing (form fields as well as
          sketch-driven changes like canvas drags, which sync into the form),
          and wires Cmd/Ctrl+Z / Shift+Z hotkeys. Undo/redo replay through
          reset(), which propagates to the sketch like an options import. */}
      <FormUndoRedo autoCapture="debounced">
        <CollapsibleProvider>
          <ContentSelectionProvider>
            <ContentSelectionListener
              setSection={ setSection }
              onSelectSlide={ handleSlideSelect }
              activeSlideIndex={ activeSlideIndex }
            />
            {isDesktop ? (
              <>
                {/* Content rail (right): the elements that enrich the sketch.
                    Docked: a flat, full-height rail flush to the right edge.
                    Floating: a card anchored in the bottom-right corner, which
                    also keeps the capture card below it (docked moves capture
                    into the top bar's Export menu). */}
                <div
                  className={ clsx(
                    "absolute",
                    dockedDesktop
                      ? "right-0 top-12 bottom-0 z-40 flex w-72 flex-col gap-1 p-2 glass border-l border-theme overflow-y-auto"
                      : "right-4 bottom-4 w-64 space-y-2"
                  ) }
                  style={ dockedDesktop ? undefined : {
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

                  {importBanner && (
                    <ImportSuccessBanner
                      message={ importBanner }
                      onDismiss={ () => setImportBanner( null ) }
                    />
                  )}

                  <OptionsPanel
                    methods={ methods }
                    name={ name }
                    persistedJob={ persistedJob }
                    jobStatus={ lifecycle.currentStatus }
                    onImportOptions={ handleImportOptions }
                    docked={ dockedDesktop }
                    { ...bodyProps }
                  />

                  {!dockedDesktop && recordingSupported && (
                    <CaptureActions
                      forwardedRef={ captureActionsRef }
                      activeSlideIndex={ activeSlideIndex }
                      docked={ false }
                      { ...captureProps }
                    />
                  )}
                </div>

                {/* Inspector (left): canvas & animation + the sketch's own
                    parameters, one panel. */}
                <SketchAssetsProvider scope="global" assetsName="assets" jobId={ jobId }>
                  <SketchSettings
                    activeSlideIndex={ activeSlideIndex }
                    activeSlideId={ activeSlideId }
                    expanded={ collapsibleStates.sketchSettings }
                    onToggle={ ( expanded ) => setSection(
                      "sketchSettings",
                      expanded
                    ) }
                    docked={ dockedDesktop }
                    rootSettingsExpanded={ collapsibleStates.rootSettings }
                    onRootSettingsToggle={ ( expanded ) => setSection(
                      "rootSettings",
                      expanded
                    ) }
                  />
                </SketchAssetsProvider>

                {/* Slide filmstrip: the deck in the page body. Docked: a band
                    between the rails, above the viewport's bottom edge (the
                    height comes from the shared CSS variable). Floating: an
                    island bottom-center. */}
                {dockedDesktop ? (
                  <div
                    className="absolute bottom-0 left-80 right-72 z-40 glass border-t border-theme"
                    style={ {
                      height: `var(${ STUDIO_FILMSTRIP_HEIGHT_VAR }, 0px)`
                    } }
                  >
                    <SlideFilmstrip { ...filmstripProps } thumbnailHeight={ 72 } />
                  </div>
                ) : (
                  <div className="absolute bottom-4 left-1/2 z-40 max-w-[calc(100%-42rem)] -translate-x-1/2 glass border border-theme rounded-2xl shadow-lg">
                    <SlideFilmstrip { ...filmstripProps } thumbnailHeight={ 56 } />
                  </div>
                )}

                {/* Docked top bar actions — rendered through a portal because
                    the bar belongs to SketchPage while undo/redo and the
                    Export menu need this form context. */}
                {dockedDesktop &&
                  topBarActionsContainer &&
                  createPortal(
                    <div className="flex h-full items-stretch">
                      <div className="flex items-center px-2">
                        <UndoRedo />
                      </div>

                      <div className="w-px bg-border" />

                      <ExportMenu
                        activeSlideIndex={ activeSlideIndex }
                        capture={ captureProps }
                        captureActionsRef={ captureActionsRef }
                        recordingSupported={ recordingSupported }
                        jobStatus={ lifecycle.currentStatus }
                        onImportOptions={ handleImportOptions }
                        forceOpen={ browserRecording || lifecycle.isRecording }
                      />
                    </div>,
                    topBarActionsContainer
                  )}
              </>
            ) : (
              <MobileStudioDrawer
                expanded={ collapsibleStates.sketchSettings }
                onToggle={ ( expanded ) => setSection(
                  "sketchSettings",
                  expanded
                ) }
                activeSlideIndex={ activeSlideIndex }
                activeSlideId={ activeSlideId }
                jobId={ jobId }
                body={ bodyProps }
                filmstrip={ filmstripProps }
                rootSettingsExpanded={ collapsibleStates.rootSettings }
                onRootSettingsToggle={ ( expanded ) => setSection(
                  "rootSettings",
                  expanded
                ) }
                capture={ captureProps }
                captureActionsRef={ captureActionsRef }
                recordingSupported={ recordingSupported }
                jobStatus={ lifecycle.currentStatus }
                onImportOptions={ handleImportOptions }
                bannerCloning={ bannerCloning }
                onBannerClone={ handleBannerClone }
                importBanner={ importBanner }
                onImportBannerDismiss={ () => setImportBanner( null ) }
              />
            )}

            {/* The central Interactive mixer — one overview of every binding, with
              per-layer solo / mute / weight. Floats bottom-center (desktop only,
              where it doesn't collide with the mobile drawer); hidden unless the
              plugin is on and the scope has bindings. Lifted above the slide
              filmstrip, which now owns the bottom-center. */}
            {isDesktop && (
              <InteractivePanel
                basePath={ sketchBasePath }
                bottomOffset={
                  dockedDesktop
                    ? `calc(var(${ STUDIO_FILMSTRIP_HEIGHT_VAR }, 0px) + 1rem)`
                    : hasSlides
                      ? "7.5rem"
                      : "4.25rem"
                }
              />
            )}
          </ContentSelectionProvider>
        </CollapsibleProvider>
      </FormUndoRedo>
    </FormProvider>
  );
}
