import React from "react";
import dynamic from "next/dynamic";
import {
  UseFormReturn, useFormContext, useWatch
} from "react-hook-form";
import {
  ArrowDownFromLine, ListCollapse
} from "lucide-react";
import clsx from "clsx";
import {
  SketchOption, SketchOptionInput
} from "@/types/sketch.types";
import {
  JobModel
} from "@/types/recording.types";
import CollapsibleItem from "@/components/CollapsibleItem";
import SketchAssetsProvider from "./SketchAssetsProvider/SketchAssetsProvider";

// The content sections start collapsed or absent (see useCollapsibleStates
// DEFAULT_STATES), so CollapsibleItem never mounts their content until the
// user expands them. Loading them as separate chunks means the dev server
// doesn't compile this whole subtree — the recursive content editor and its
// dnd-kit deps (~2.6k LOC) — just to open a sketch page; it compiles only when
// a section is actually opened. The collapsible headers live here in
// OptionsPanel and stay static, so there is no loading flash.
const ContentItems = dynamic( () => import( "./ContentItems/ContentItems" ) );
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

function SectionHeader( {
  expanded,
  label
}: {
  expanded: boolean;
  label: React.ReactNode;
} ) {
  return (
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
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * The content rail: the elements that enrich the sketch — text, images, QR
 * codes… — presented as the active slide's own items plus the shared (root)
 * items that apply to every slide. Slides themselves live in the filmstrip;
 * canvas & animation moved into the inspector.
 */
export function OptionsPanelBody( {
  activeSlideIndex,
  slideFields,
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
  const activeSlideContentLength = useWatch( {
    control,
    name:
      activeSlideIndex !== undefined
        ? `slides.${ activeSlideIndex }.content`
        : "content"
  } )?.length;

  const jobId = useWatch( {
    control,
    name: "id"
  } ) as string | undefined;

  const slideIds = slideFields.map( ( field ) => field.id );
  const editorKey =
    activeSlideIndex !== undefined && slideIds[ activeSlideIndex ]
      ? slideIds[ activeSlideIndex ]
      : `no-slides-${ slideFields.length }`;

  const hasActiveSlide = activeSlideIndex !== undefined;

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
      {/* The active slide's own content (and its transition settings). */}
      {hasActiveSlide && (
        <CollapsibleItem
          expanded={ collapsibleStates.slides }
          onToggle={ ( expanded ) => onCollapsibleToggle( "slides" ) }
          className="p-1 border border-theme rounded-lg bg-background overflow-y-auto"
          header={ ( expanded ) => (
            <SectionHeader
              expanded={ expanded }
              label={
                <>
                  slide {activeSlideIndex + 1} content{" "}
                  {activeSlideContentLength
                    ? `(${ activeSlideContentLength })`
                    : null}
                </>
              }
            />
          ) }
        >
          <SlideEditor key={ editorKey } activeIndex={ activeSlideIndex } />
        </CollapsibleItem>
      )}

      {/* The root content: applies to every slide. Without slides it is
          simply the sketch's content. */}
      <CollapsibleItem
        expanded={ collapsibleStates.globalContent }
        onToggle={ ( expanded ) => onCollapsibleToggle( "globalContent" ) }
        className="p-1 border border-theme rounded-lg text-foreground bg-background overflow-y-auto"
        header={ ( expanded ) => (
          <SectionHeader
            expanded={ expanded }
            label={
              <>
                {hasActiveSlide ? "shared content" : "content"}{" "}
                {rootContentLength ? `(${ rootContentLength })` : null}
              </>
            }
          />
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

  // Docked: the rail supplies chrome and scrolling, and undo/redo +
  // import/export live in the top bar / export panel — render the sections
  // bare.
  if ( docked ) {
    return <OptionsPanelBody scrollable={ false } { ...bodyProps } />;
  }

  return (
    <CollapsibleItem
      swipeToCollapse
      className="flex flex-col gap-1 w-full glass p-2 border border-theme rounded-2xl shadow-lg"
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
        </div>
      ) }
    >
      <OptionsPanelBody { ...bodyProps } />
    </CollapsibleItem>
  );
}
