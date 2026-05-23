"use client";

import {
  Film, Image as ImageIcon, Settings2, Sliders, Upload
} from "lucide-react";
import type {
  RefObject
} from "react";
import {
  useMemo, useState
} from "react";
import {
  UseFormReturn, useWatch
} from "react-hook-form";

import MobileSheet, {
  type SheetSnap
} from "@/components/MobileSheet/MobileSheet";
import type {
  JobModel
} from "@/types/recording.types";
import type {
  SketchOption, SketchOptionInput, SlideOption
} from "@/types/sketch.types";
import type {
  RecordingLifecycle
} from "../../hooks/useRecordingLifecycle";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import RandomizeSettingsButton from "@/components/RandomizeSettingsButton";
import ResetSettingsButton from "@/components/ResetSettingsButton";
import initOptions from "@/utils/initOptions";

import type {
  CaptureActionsRef
} from "../CaptureActions";
import CaptureActions from "../CaptureActions";
import useBrowserRecordingSupported from "../CaptureActions/hooks/useBrowserRecordingSupported";
import OptionsImportExport from "../CaptureActions/components/OptionsImportExport";
import ContentArrayProvider from "../ContentArrayProvider/ContentArrayProvider";
import ContentItems from "../ContentItems/ContentItems";
import GenericObjectForm from "../RootSettings/components/GenericObjectForm/GenericObjectForm";
import rootFormConfig from "../RootSettings/constants/root-field-config";
import RecordingLockBanner from "../RecordingLockBanner";
import SlideCarousel from "../SlideCarousel";
import SlideEditor from "../SlideEditor";
import SaveDefaultsButton from "../SketchSettings/SaveDefaultsButton";
import GenerateThumbnailButton from "../SketchSettings/GenerateThumbnailButton";
import GeneratePreviewButton from "../SketchSettings/GeneratePreviewButton";
import {
  injectSketchSchemas
} from "../SketchSettings/utils/injectSketchSchemas";
import TemplateAssetsProvider from "../TemplateAssetsProvider/TemplateAssetsProvider";

import SheetPeekBar from "./SheetPeekBar";
import SheetTabBar, {
  type TabDef, type TabId
} from "./SheetTabBar";

type MobileOptionsSheetProps = {
  methods: UseFormReturn<SketchOptionInput>;
  name: string;
  persistedJob?: JobModel;
  activeSlideIndex: number | undefined;
  slideFields: { id: string }[];
  slides?: SlideOption[];
  thumbnails: Record<string, string>;
  enableThumbnails: boolean;
  isAdding: boolean;
  onAddSlide: () => void;
  onSelectSlide: ( index: number | undefined ) => void;
  onReorderSlides: ( oldIndex: number, newIndex: number ) => void;
  onDuplicateSlide: ( index: number ) => void;
  onDeleteSlide: ( index: number ) => void;
  onRenameSlide: ( index: number, newName: string ) => void;
  onImportOptions: ( options: SketchOption ) => void;
  // Lifecycle / capture wiring (parity with desktop)
  lifecycle: RecordingLifecycle;
  bannerCloning: boolean;
  onBannerClone: () => void | Promise<void>;
  captureActionsRef: RefObject<CaptureActionsRef>;
  recordingProgress: Parameters<typeof CaptureActions>[ 0 ][ "recordingProgress" ];
  subscribeToRecordingStatus: Parameters<typeof CaptureActions>[ 0 ][ "subscribeToRecordingStatus" ];
};

const STORAGE_KEY = "p5-templates:mobile-sheet:tab";

function readStoredTab( fallback: TabId ): TabId {
  if ( typeof window === "undefined" ) {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem( STORAGE_KEY );

    if ( stored === "sketch" || stored === "slides" || stored === "content" || stored === "settings" || stored === "export" ) {
      return stored;
    }
  } catch {
    /* ignore */
  }

  return fallback;
}

export default function MobileOptionsSheet( props: MobileOptionsSheetProps ) {
  const {
    methods,
    name,
    persistedJob,
    activeSlideIndex,
    slideFields,
    slides,
    thumbnails,
    enableThumbnails,
    isAdding,
    onAddSlide,
    onSelectSlide,
    onReorderSlides,
    onDuplicateSlide,
    onDeleteSlide,
    onRenameSlide,
    onImportOptions,
    lifecycle,
    bannerCloning,
    onBannerClone,
    captureActionsRef,
    recordingProgress,
    subscribeToRecordingStatus
  } = props;

  const [
    {
      backendRecording, sketchFormConfiguration, sketchFormValues
    }
  ] = useSketch();

  const browserRecordingSupported = useBrowserRecordingSupported();

  const {
    control, watch
  } = methods;

  const rootContentLength = ( useWatch( {
    control,
    name: "content"
  } ) as unknown[] | undefined )?.length ?? 0;
  const slidesLength = slides?.length ?? 0;
  const jobId = useWatch( {
    control,
    name: "id"
  } ) as string | undefined;

  // Sheet snap point + active tab (persisted).
  const [
    snap,
    setSnap
  ] = useState<SheetSnap>( "peek" );

  const slideIds = slideFields.map( ( f ) => f.id );
  const hasSlides = slidesLength > 0;
  const slideContext = activeSlideIndex !== undefined;

  const [
    activeTab,
    setActiveTab
  ] = useState<TabId>( () => readStoredTab( "sketch" ) );

  const changeTab = ( id: TabId ) => {
    setActiveTab( id );

    if ( snap === "peek" ) {
      setSnap( "half" );
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        id
      );
    } catch {
      /* ignore */
    }
  };

  // Sketch-specific form config (with runtime schema injection).
  const sketchConfigWithSchemas = useMemo(
    () => {
      if ( !sketchFormConfiguration ) {
        return undefined;
      }

      return injectSketchSchemas(
        name,
        sketchFormConfiguration
      );
    },
    [
      name,
      sketchFormConfiguration
    ]
  );

  const sketchBasePath = slideContext
    ? `slides.${ activeSlideIndex }.sketch`
    : "sketch";

  const generalBasePath = slideContext ? `slides.${ activeSlideIndex }` : "";

  const sketchOptionsCount = sketchFormValues
    ? Object.keys( sketchFormValues ).length
    : 0;

  // Build tabs dynamically (slides hidden when sketch has no slide support).
  const tabs: TabDef[] = [];

  if ( sketchConfigWithSchemas && Object.keys( sketchConfigWithSchemas ).length > 0 ) {
    tabs.push( {
      id: "sketch",
      label: "Sketch",
      icon: Sliders,
      badge: sketchOptionsCount
    } );
  }

  if ( hasSlides ) {
    tabs.push( {
      id: "slides",
      label: "Slides",
      icon: Film,
      badge: slidesLength
    } );
  }

  tabs.push( {
    id: "content",
    label: "Content",
    icon: ImageIcon,
    badge: rootContentLength
  } );

  tabs.push( {
    id: "settings",
    label: "Canvas",
    icon: Settings2
  } );

  tabs.push( {
    id: "export",
    label: "Export",
    icon: Upload
  } );

  // Guard: if the active tab is unavailable (e.g. sketch has no options or no
  // slides), fall back to the first available tab.
  const resolvedActiveTab: TabId = tabs.some( ( t ) => t.id === activeTab )
    ? activeTab
    : tabs[ 0 ].id;

  const editorKey =
    activeSlideIndex !== undefined && slideIds[ activeSlideIndex ]
      ? slideIds[ activeSlideIndex ]
      : `no-slides-${ slideFields.length }`;

  const options = watch();

  return (
    <MobileSheet
      snap={ snap }
      onSnapChange={ setSnap }
      peekBar={ (
        <SheetPeekBar
          snap={ snap }
          onSnapChange={ setSnap }
        />
      ) }
      tabBar={ (
        <SheetTabBar
          tabs={ tabs }
          active={ resolvedActiveTab }
          onChange={ changeTab }
        />
      ) }
    >
      {lifecycle.isLocked && (
        <div className="mb-3">
          <RecordingLockBanner
            state={ lifecycle.state }
            onClone={ onBannerClone }
            cloning={ bannerCloning }
          />
        </div>
      )}

      {resolvedActiveTab === "sketch" && sketchConfigWithSchemas && (
        <TemplateAssetsProvider scope="global" assetsName="assets" jobId={ jobId }>
          <section aria-label="Sketch options">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">
                {slideContext
                  ? `Slide ${ ( activeSlideIndex ?? 0 ) + 1 } · Sketch options`
                  : "Sketch options"}
              </h2>
              <div className="flex items-center gap-2">
                <ResetSettingsButton basePath={ sketchBasePath } />
                <RandomizeSettingsButton
                  config={ sketchConfigWithSchemas }
                  basePath={ sketchBasePath }
                />
                <SaveDefaultsButton />
                <GenerateThumbnailButton />
                <GeneratePreviewButton />
              </div>
            </div>

            <GenericObjectForm
              key={ sketchBasePath }
              basePath={ sketchBasePath }
              config={ sketchConfigWithSchemas }
            />
          </section>
        </TemplateAssetsProvider>
      )}

      {resolvedActiveTab === "slides" && hasSlides && (
        <section aria-label="Slides">
          <h2 className="text-sm font-semibold mb-2">
            Slides{slidesLength ? ` (${ slidesLength })` : ""}
          </h2>

          <SlideCarousel
            slideFields={ slideFields }
            slides={ slides }
            thumbnails={ enableThumbnails ? thumbnails : {} }
            activeIndex={ activeSlideIndex }
            isAdding={ isAdding }
            onAdd={ onAddSlide }
            onSelect={ onSelectSlide }
            onReorder={ onReorderSlides }
            onDuplicate={ onDuplicateSlide }
            onDelete={ onDeleteSlide }
            onRename={ onRenameSlide }
          />

          {activeSlideIndex !== undefined && (
            <div className="mt-4">
              <SlideEditor key={ editorKey } activeIndex={ activeSlideIndex } />
            </div>
          )}
        </section>
      )}

      {resolvedActiveTab === "content" && (
        <section aria-label="Global content">
          <h2 className="text-sm font-semibold mb-2">
            Global content{rootContentLength ? ` (${ rootContentLength })` : ""}
          </h2>

          <TemplateAssetsProvider
            scope="global"
            assetsName="assets"
            jobId={ jobId }
          >
            <ContentArrayProvider name="content">
              <ContentItems baseFieldName="content" />
            </ContentArrayProvider>
          </TemplateAssetsProvider>
        </section>
      )}

      {resolvedActiveTab === "settings" && (
        <section aria-label="Canvas & general settings">
          <h2 className="text-sm font-semibold mb-2">
            {slideContext
              ? `Slide ${ ( activeSlideIndex ?? 0 ) + 1 } overrides`
              : "Canvas & general"}
          </h2>

          <GenericObjectForm
            key={ generalBasePath || "root" }
            basePath={ generalBasePath }
            config={ rootFormConfig }
          />
        </section>
      )}

      {resolvedActiveTab === "export" && (
        <section aria-label="Export & recording">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Export</h2>
            <OptionsImportExport
              options={ options }
              name={ name }
              persistedJobId={ persistedJob?.id }
              jobStatus={ lifecycle.currentStatus }
              onImportInMemory={ ( importedOptions ) => {
                const processed = initOptions( importedOptions as SketchOption );

                onImportOptions( processed );
              } }
            />
          </div>

          {( backendRecording || browserRecordingSupported ) && (
            <CaptureActions
              ref={ captureActionsRef }
              name={ name }
              options={ options }
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
        </section>
      )}
    </MobileSheet>
  );
}
