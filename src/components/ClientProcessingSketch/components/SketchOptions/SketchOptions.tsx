import dynamic from "next/dynamic";
import clsx from "clsx";
import {
  Download
} from "lucide-react";
import type React from "react";
import {
  useCallback, useEffect, useRef, useState
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
import CaptureDialog from "./components/CaptureDialog";
import TransportBar from "./components/TransportBar";
import UndoRedo from "./components/UndoRedo";
import InteractivePanel from "./components/InteractivePanel/InteractivePanel";
import SketchAssetsProvider from "./components/SketchAssetsProvider/SketchAssetsProvider";
import useMediaQuery from "@/hooks/useMediaQuery";
import useGlobalHotkey from "@/hooks/useGlobalHotkey";
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
  STUDIO_FILMSTRIP_HEIGHT_VAR, STUDIO_TRANSPORT_HEIGHT_VAR
} from "./constants/drawer-events";
import {
  readAndClearPendingImport
} from "@/lib/pendingImportOptions";

// The recording subtree (useBrowserRecorder -> @/engines/recording, the
// mediabunny + gif.js encoders, VideoPreviewModal) is reached through
// CaptureDialog / MobileStudioDrawer, both code-split below, so it never lands
// in the sketch page's initial compile. Only the ref type is imported here.
//
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
  /** Scrub lifecycle, forwarded to the transport bar so the viewport's
   *  performance label can still report "seeking" now that the scrubber lives
   *  outside the viewport. */
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
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
  onSeekStart,
  onSeekEnd,
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

  // The capture dialog: opened by the transport bar's record dot and, in the
  // docked layout, by the top bar's Export button. One dialog, one mounted
  // CaptureActions — the two are triggers, not copies.
  const [
    captureOpen,
    setCaptureOpen
  ] = useState( false );

  // "E" opens the same dialog as the transport bar's record dot / the docked
  // top bar's Export button — one more trigger for the one dialog, not a copy.
  const openCapture = useCallback(
    () => setCaptureOpen( true ),
    []
  );

  useGlobalHotkey( {
    code: "KeyE",
    onTrigger: openCapture
  } );

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

  // ≥ md: separate floating panels (inspector left, content rail right).
  // Below: a single bottom drawer with Sketch / Content tabs, under the
  // transport bar. The form context above is shared either way — only the
  // layout changes. Declared here because the initial collapsible states
  // depend on it; `useMediaQuery`'s client snapshot reads matchMedia directly,
  // so the very first client render already knows the real viewport.
  const isDesktop = useMediaQuery( "(min-width: 768px)" );

  // Collapsible section states. The drawer scrolls inside `max-h-[50svh]`, so
  // opening it with canvas & animation *and* the sketch's options unfolded put
  // the option count several screens down; on mobile the first section starts
  // closed. Desktop rails are full height and keep the defaults.
  const {
    states: collapsibleStates,
    toggleSection,
    setSection
  } = useCollapsibleStates( isDesktop ? undefined : {
    rootSettings: false
  } );

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

  // The docked workspace layout (edge-to-edge rails) vs the floating layout
  // (rounded islands in the bottom corners). Desktop-only; a global toggle.
  const {
    docked
  } = usePanelDock();
  const dockedDesktop = isDesktop && docked;

  const hasSlides = slideFields.length > 0;

  // The bottom stack, from the viewport edge up: the transport bar (a
  // full-width floor in every layout), then the filmstrip band, then the
  // floating islands and the Interactive mixer. Each offset is derived from
  // the one below it so adding or removing a layer never leaves two of them
  // overlapping — and the bar's height is stated once, in the CSS variable
  // the rails and the sketch viewport read back.
  const transportHeight = `var(${ STUDIO_TRANSPORT_HEIGHT_VAR }, 0px)`;
  const filmstripHeight = dockedDesktop
    ? `var(${ STUDIO_FILMSTRIP_HEIGHT_VAR }, 0px)`
    : "0px";
  const railBottom = transportHeight;
  const islandBottom = `calc(${ transportHeight } + ${ filmstripHeight } + 1rem)`;
  const mixerBottom = `calc(${ islandBottom } + 3.25rem)`;

  // The transport bar is 3rem tall and always mounted with the studio, so it
  // publishes a constant. It is a variable rather than a literal because five
  // other boxes (both rails, the filmstrip band, the mobile stack, the sketch
  // viewport) are positioned off it and must never drift apart.
  useEffect(
    () => {
      document.documentElement.style.setProperty(
        STUDIO_TRANSPORT_HEIGHT_VAR,
        "3rem"
      );

      return () => {
        document.documentElement.style.removeProperty( STUDIO_TRANSPORT_HEIGHT_VAR );
      };
    },
    []
  );

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
                    // Docked: no padding of its own — the sections inside are
                    // full-bleed bands and must reach the rail's edges, exactly
                    // as they do in the inspector. Anything that is not a
                    // section (the banners below) pads itself.
                    dockedDesktop
                      ? "right-0 top-12 z-40 flex w-72 flex-col glass border-l border-theme overflow-y-auto"
                      : "right-4 w-64 space-y-2"
                  ) }
                  style={ dockedDesktop ? {
                    bottom: railBottom
                  } : {
                    bottom: islandBottom,
                    maxWidth: "calc(50% - 0.75rem)"
                  } }
                >
                  {( lifecycle.isLocked || importBanner ) && (
                    <div
                      className={ clsx(
                        "flex flex-col gap-1",
                        dockedDesktop && "p-2"
                      ) }
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
                    </div>
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

                  {/* Floating: the deck is a panel of the right column, under
                      the content card and the same width — it belongs with the
                      document's other objects rather than floating over the
                      canvas. Docked keeps it as a band between the rails. */}
                  {!dockedDesktop && (
                    <div className="glass border border-theme rounded-2xl shadow-lg overflow-hidden">
                      <SlideFilmstrip { ...filmstripProps } thumbnailHeight={ 52 } />
                    </div>
                  )}
                </div>

                {/* Inspector (left): canvas & animation + the sketch's own
                    parameters, one panel. */}
                <SketchAssetsProvider scope="global" assetsName="assets" jobId={ jobId }>
                  <SketchSettings
                    activeSlideIndex={ activeSlideIndex }
                    activeSlideId={ activeSlideId }
                    docked={ dockedDesktop }
                    rootSettingsExpanded={ collapsibleStates.rootSettings }
                    onRootSettingsToggle={ ( expanded ) => setSection(
                      "rootSettings",
                      expanded
                    ) }
                    sketchSectionExpanded={ collapsibleStates.sketchSection }
                    onSketchSectionToggle={ ( expanded ) => setSection(
                      "sketchSection",
                      expanded
                    ) }
                  />
                </SketchAssetsProvider>

                {/* Slide filmstrip: the deck in the page body. Docked: a band
                    between the rails, above the viewport's bottom edge (the
                    height comes from the shared CSS variable). Floating: an
                    island bottom-center. */}
                {dockedDesktop && (
                  <div
                    className="absolute left-80 right-72 z-40 glass border-t border-theme"
                    style={ {
                      bottom: railBottom,
                      height: `var(${ STUDIO_FILMSTRIP_HEIGHT_VAR }, 0px)`
                    } }
                  >
                    {/* The band is 3rem tall when the deck is empty, so the
                        add slot shrinks with it rather than overflowing. */}
                    <SlideFilmstrip
                      { ...filmstripProps }
                      thumbnailHeight={ hasSlides ? 72 : 32 }
                    />
                  </div>
                )}

                {/* Docked top bar actions — rendered through a portal because
                    the bar belongs to SketchPage while undo/redo and the
                    Export button need this form context. Export opens the very
                    same dialog as the record dot: two triggers, one surface. */}
                {dockedDesktop &&
                  topBarActionsContainer &&
                  createPortal(
                    <div className="flex h-full items-stretch">
                      <div className="flex items-center px-2">
                        <UndoRedo />
                      </div>

                      <div className="w-px bg-border" />

                      <div className="flex items-center px-2">
                        <button
                          type="button"
                          onClick={ openCapture }
                          title="Recording, export and options import/export"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-85"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </button>
                      </div>
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
                rootSettingsExpanded={ collapsibleStates.rootSettings }
                onRootSettingsToggle={ ( expanded ) => setSection(
                  "rootSettings",
                  expanded
                ) }
                sketchSectionExpanded={ collapsibleStates.sketchSection }
                onSketchSectionToggle={ ( expanded ) => setSection(
                  "sketchSection",
                  expanded
                ) }
                deck={
                  <div className="glass border border-theme rounded-2xl shadow-lg overflow-hidden">
                    <SlideFilmstrip { ...filmstripProps } thumbnailHeight={ 48 } />
                  </div>
                }
                lifecycle={ lifecycle }
                bannerCloning={ bannerCloning }
                onBannerClone={ handleBannerClone }
                importBanner={ importBanner }
                onImportBannerDismiss={ () => setImportBanner( null ) }
              />
            )}

            {/* The transport bar: one full-width bar along the bottom edge, the
                same in all three layouts. Everything else — the rails, the
                filmstrip band, the floating islands, the mobile stack — is
                positioned off its height, published as a CSS variable above.
                It was a floating pill until the floating layout had three
                islands competing for the bottom of the screen; as a bar it is
                also wide enough to carry the frame counter and the percentage
                again. */}
            <div className="absolute bottom-0 left-0 right-0 z-40">
              <TransportBar
                onOpenCapture={ openCapture }
                recording={ browserRecording || lifecycle.isRecording }
                onSeekStart={ onSeekStart }
                onSeekEnd={ onSeekEnd }
              />
            </div>

            {/* The central Interactive mixer — one overview of every binding, with
              per-layer solo / mute / weight. Floats bottom-center (desktop only,
              where it doesn't collide with the mobile drawer); hidden unless the
              plugin is on and the scope has bindings. Lifted above the slide
              filmstrip, which now owns the bottom-center. */}
            {isDesktop && (

              <InteractivePanel
                basePath={ sketchBasePath }
                bottomOffset={ mixerBottom }
              />
            )}

            {/* Recording and export, for all three layouts: a centred dialog on
                desktop, a bottom sheet on mobile — where it replaces the Export
                drawer tab. Rendered last so its z-[70] surface really is on top,
                and unconditionally so `captureActionsRef` (the autosave handle)
                exists whatever the viewport. */}
            <CaptureDialog
              open={ captureOpen }
              onClose={ () => setCaptureOpen( false ) }
              activeSlideIndex={ activeSlideIndex }
              capture={ captureProps }
              captureActionsRef={ captureActionsRef }
              recordingSupported={ recordingSupported }
              browserExportSupported={ browserRecordingSupported }
              bottomSheet={ !isDesktop }
            />
          </ContentSelectionProvider>
        </CollapsibleProvider>
      </FormUndoRedo>
    </FormProvider>
  );
}
