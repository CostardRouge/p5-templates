import React, {
  Fragment
} from "react";
import {
  UseFormReturn, useWatch
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
import ContentItems from "./ContentItems/ContentItems";
import SlideCarousel from "./SlideCarousel";
import SlideEditor from "./SlideEditor";
import TemplateAssetsProvider from "./TemplateAssetsProvider/TemplateAssetsProvider";
import ContentArrayProvider from "./ContentArrayProvider/ContentArrayProvider";
import OptionsImportExport from "./CaptureActions/components/OptionsImportExport";
import initOptions from "@/utils/initOptions";
import type {
  CollapsibleSection, CollapsibleStates
} from "@/components/ClientProcessingSketch/components/TemplateOptions/hooks/useCollapsibleStates";

type OptionsPanelProps = {
  methods: UseFormReturn<SketchOptionInput>;
  name: string;
  persistedJob?: JobModel;
  activeSlideIndex: number | undefined;
  slideFields: any[];
  thumbnails: Record<string, string>;
  slides?: SlideOption[];
  jobStatus?: string;
  isAdding: boolean;
  onAddSlide: () => void;
  onSelectSlide: ( index: number | undefined ) => void;
  onReorderSlides: ( oldIndex: number, newIndex: number ) => void;
  onDuplicateSlide: ( index: number ) => void;
  onDeleteSlide: ( index: number ) => void;
  onRenameSlide: ( index: number, newName: string ) => void;
  onImportOptions: ( options: SketchOption ) => void;
  enableThumbnails: boolean;
  collapsibleStates: CollapsibleStates;
  onCollapsibleToggle: ( section: CollapsibleSection ) => void;
};

export default function OptionsPanel( {
  methods,
  name,
  persistedJob,
  activeSlideIndex,
  slideFields,
  thumbnails,
  slides,
  jobStatus,
  isAdding,
  onAddSlide,
  onSelectSlide,
  onReorderSlides,
  onDuplicateSlide,
  onDeleteSlide,
  onRenameSlide,
  onImportOptions,
  enableThumbnails,
  collapsibleStates,
  onCollapsibleToggle
}: OptionsPanelProps ) {
  const {
    control, watch
  } = methods;

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
  const options = watch();

  const editorKey =
    activeSlideIndex !== undefined && slideIds[ activeSlideIndex ]
      ? slideIds[ activeSlideIndex ]
      : `no-slides-${ slideFields.length }`;

  return (
    <CollapsibleItem
      swipeToCollapse
      className="flex flex-col gap-1 glass p-2 border border-theme rounded-2xl shadow-lg w-full"
      contentClassName="flex flex-col gap-1 min-h-0"
      header={ (
        expanded, title
      ) => (
        <div className="flex gap-1">
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
      <div
        className="flex flex-col gap-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5"
        style={ {
          maxHeight: "calc(80svh - 3rem)"
        } }
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
          headerContainerClassName="leading-none"
          header={ ( expanded ) => (
            <button
              className={ clsx(
                "truncate text-foreground text-xs w-full text-left -ml-1 align-text-top",
                {
                  "mb-1": expanded
                }
              ) }
              aria-label={ expanded ? "Collapse" : "Expand" }
            >
              <ListCollapse
                className="inline text-foreground h-3"
                style={ {
                  rotate: expanded ? "180deg" : "0deg"
                } }
              />
              <span>
                global content{" "}
                {rootContentLength ? `(${ rootContentLength })` : null}
              </span>
            </button>
          ) }
        >
          <TemplateAssetsProvider
            scope="global"
            assetsName="assets"
            jobId={ jobId }
          >
            <ContentArrayProvider name="content">
              <ContentItems baseFieldName="content" />
            </ContentArrayProvider>
          </TemplateAssetsProvider>
        </CollapsibleItem>

        {slides && (
          <Fragment>
            <CollapsibleItem
              expanded={ collapsibleStates.slides }
              onToggle={ ( expanded ) => onCollapsibleToggle( "slides" ) }
              className="p-1 border border-theme rounded-lg bg-background overflow-y-auto"
              headerContainerClassName="leading-none"
              header={ ( expanded ) => (
                <button
                  className={ clsx(
                    "text-foreground text-xs w-full text-left -ml-1 align-text-top",
                    {
                      "mb-1": expanded
                    }
                  ) }
                  aria-label={ expanded ? "Collapse" : "Expand" }
                >
                  <ListCollapse
                    className="inline text-foreground h-3"
                    style={ {
                      rotate: expanded ? "180deg" : "0deg"
                    } }
                  />
                  <span>slides {slidesLength ? `(${ slidesLength })` : null}</span>
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
    </CollapsibleItem>
  );
}
