import React, {
  Fragment
} from "react";
import dynamic from "next/dynamic";
import {
  UseFormReturn, useFormContext, useWatch
} from "react-hook-form";
import {
  ArrowDownFromLine, ListCollapse
} from "lucide-react";
import clsx from "clsx";
import {
  SketchOption, SketchOptionInput, SlideOption
} from "@/types/sketch.types";
import {
  JobModel
} from "@/types/recording.types";
import CollapsibleItem from "@/components/CollapsibleItem";
import RootSettings from "./RootSettings/RootSettings";
import SketchAssetsProvider from "./SketchAssetsProvider/SketchAssetsProvider";

// The "global content" and "slides" sections start collapsed (see
// useCollapsibleStates DEFAULT_STATES), so CollapsibleItem never mounts their
// content until the user expands them. Loading them as separate chunks means
// the dev server doesn't compile this whole subtree — the recursive content
// editor and its dnd-kit deps (~2.6k LOC) — just to open a sketch page; it
// compiles only when a section is actually opened. The collapsible headers live
// here in OptionsPanel and stay static, so there is no loading flash.
const ContentItems = dynamic( () => import( "./ContentItems/ContentItems" ) );
const SlideCarousel = dynamic( () => import( "./SlideCarousel" ) );
const SlideEditor = dynamic( () => import( "./SlideEditor" ) );

import ContentArrayProvider from "./ContentArrayProvider/ContentArrayProvider";
import OptionsImportExport from "./CaptureActions/components/OptionsImportExport";
import UndoRedo from "./UndoRedo";
import initOptions from "@/utils/initOptions";
import type {
  CollapsibleSection, CollapsibleStates
} from "@/components/ClientProcessingSketch/components/SketchOptions/hooks/useCollapsibleStates";

export type OptionsPanelBodyProps = {
  activeSlideIndex: number | undefined;
  slideFields: any[];
  thumbnails: Record<string, string>;
  slides?: SlideOption[];
  isAdding: boolean;
  onAddSlide: () => void;
  onSelectSlide: ( index: number | undefined ) => void;
  onReorderSlides: ( oldIndex: number, newIndex: number ) => void;
  onDuplicateSlide: ( index: number ) => void;
  onDeleteSlide: ( index: number ) => void;
  onRenameSlide: ( index: number, newName: string ) => void;
  enableThumbnails: boolean;
  collapsibleStates: CollapsibleStates;
  onCollapsibleToggle: ( section: CollapsibleSection ) => void;
  /** The desktop panel scrolls internally; the mobile drawer scrolls itself. */
  scrollable?: boolean;
};

type OptionsPanelProps = OptionsPanelBodyProps & {
  methods: UseFormReturn<SketchOptionInput>;
  name: string;
  persistedJob?: JobModel;
  jobStatus?: string;
  onImportOptions: ( options: SketchOption ) => void;
  /** Flat variant for the docked rail: drop the panel's own glass card and let
   *  the rail scroll instead of the body. */
  docked?: boolean;
};

/**
 * The sketch's option sections (general settings, global content, slides) without
 * panel chrome — rendered in the desktop floating panel and in the mobile
 * drawer's Settings tab.
 */
export function OptionsPanelBody( {
  activeSlideIndex,
  slideFields,
  thumbnails,
  slides,
  isAdding,
  onAddSlide,
  onSelectSlide,
  onReorderSlides,
  onDuplicateSlide,
  onDeleteSlide,
  onRenameSlide,
  enableThumbnails,
  collapsibleStates,
  onCollapsibleToggle,
  scrollable = true
}: OptionsPanelBodyProps ) {
  const {
    control
  } = useFormContext();

  const rootContentLength = useWatch( {
    control,
    name: "content"
  } )?.length;

  const slideIds = slideFields.map( ( field ) => field.id );
  const slidesLength = slides?.length;
  const jobId = useWatch( {
    control,
    name: "id"
  } ) as string | undefined;

  const editorKey =
    activeSlideIndex !== undefined && slideIds[ activeSlideIndex ]
      ? slideIds[ activeSlideIndex ]
      : `no-slides-${ slideFields.length }`;

  return (
    <div
      className={ clsx(
        "flex flex-col gap-1 min-h-0",
        scrollable && "overflow-y-auto overflow-x-hidden pr-0.5"
      ) }
      style={ scrollable ? {
        maxHeight: "calc(80svh - 3rem)"
      } : undefined }
    >
      <RootSettings
        activeSlideIndex={ activeSlideIndex }
        expanded={ collapsibleStates.rootSettings }
        onToggle={ () => onCollapsibleToggle( "rootSettings" ) }
      />

      <CollapsibleItem
        expanded={ collapsibleStates.globalContent }
        onToggle={ ( expanded ) => onCollapsibleToggle( "globalContent" ) }
        className="p-1 border border-theme rounded-lg text-foreground bg-background overflow-y-auto"
        header={ ( expanded ) => (
          <button
            className={ clsx(
              "flex w-full items-center gap-1.5 text-left text-foreground text-xs min-h-[2.5rem] md:min-h-[1.75rem]",
              {
                "mb-1": expanded
              }
            ) }
            aria-label={ expanded ? "Collapse" : "Expand" }
          >
            <ListCollapse
              className="shrink-0 text-foreground h-4 w-4 md:h-3 md:w-3"
              style={ {
                rotate: expanded ? "180deg" : "0deg"
              } }
            />
            <span className="truncate">
              global content{" "}
              {rootContentLength ? `(${ rootContentLength })` : null}
            </span>
          </button>
        ) }
      >
        <SketchAssetsProvider
          scope="global"
          assetsName="assets"
          jobId={ jobId }
        >
          <ContentArrayProvider name="content">
            <ContentItems baseFieldName="content" />
          </ContentArrayProvider>
        </SketchAssetsProvider>
      </CollapsibleItem>

      {slides && (
        <Fragment>
          <CollapsibleItem
            expanded={ collapsibleStates.slides }
            onToggle={ ( expanded ) => onCollapsibleToggle( "slides" ) }
            className="p-1 border border-theme rounded-lg bg-background overflow-y-auto"
            header={ ( expanded ) => (
              <button
                className={ clsx(
                  "flex w-full items-center gap-1.5 text-left text-foreground text-xs min-h-[2.5rem] md:min-h-[1.75rem]",
                  {
                    "mb-1": expanded
                  }
                ) }
                aria-label={ expanded ? "Collapse" : "Expand" }
              >
                <ListCollapse
                  className="shrink-0 text-foreground h-4 w-4 md:h-3 md:w-3"
                  style={ {
                    rotate: expanded ? "180deg" : "0deg"
                  } }
                />
                <span className="truncate">slides {slidesLength ? `(${ slidesLength })` : null}</span>
              </button>
            ) }
          >
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
              <SlideEditor key={ editorKey } activeIndex={ activeSlideIndex } />
            )}
          </CollapsibleItem>
        </Fragment>
      )}
    </div>
  );
}

export default function OptionsPanel( {
  methods,
  name,
  persistedJob,
  jobStatus,
  onImportOptions,
  docked,
  ...bodyProps
}: OptionsPanelProps ) {
  const {
    watch
  } = methods;

  const options = watch();

  return (
    <CollapsibleItem
      swipeToCollapse={ !docked }
      expanded={ docked ? true : undefined }
      className={ clsx(
        "flex flex-col gap-1 w-full",
        docked
          ? "px-1"
          : "glass p-2 border border-theme rounded-2xl shadow-lg"
      ) }
      contentClassName="flex flex-col gap-1 min-h-0"
      header={ (
        expanded, title
      ) => (
        <div className="flex gap-1">
          <UndoRedo />

          <OptionsImportExport
            options={ options }
            name={ name }
            persistedJobId={ persistedJob?.id }
            jobStatus={ jobStatus }
            onImportInMemory={ ( importedOptions ) => {
              const processedOptions = initOptions( importedOptions as SketchOption );

              console.log(
                "Importing options:",
                {
                  imported: importedOptions,
                  processed: processedOptions,
                  slidesCount: processedOptions.slides?.length
                }
              );
              onImportOptions( importedOptions as SketchOption );
            } }
          />

          {!docked && (
            <button
              title={ title }
              className="text-foreground text-sm w-full flex items-center justify-end"
              aria-label={ expanded ? "Collapse controls" : "Expand controls" }
            >
              <ArrowDownFromLine
                className="inline text-foreground h-3 w-3 ml-1"
                style={ {
                  rotate: expanded ? "0deg" : "180deg"
                } }
              />
            </button>
          )}
        </div>
      ) }
    >
      {/* In the docked rail the rail itself scrolls, so the body renders its
          full height instead of scrolling internally. */}
      <OptionsPanelBody scrollable={ !docked } { ...bodyProps } />
    </CollapsibleItem>
  );
}
