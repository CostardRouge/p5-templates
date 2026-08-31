import React from "react";
import dynamic from "next/dynamic";
import {
  UseFormReturn, useFormContext, useWatch
} from "react-hook-form";
import clsx from "clsx";
import {
  SketchOption, SketchOptionInput
} from "@/types/sketch.types";
import {
  JobModel
} from "@/types/recording.types";
import {
  Plus, X
} from "lucide-react";
import PanelSection from "./PanelSection";

// Two chunks, split where the weight is. The LIST is light — rows, icons and
// dnd-kit — and mounts with the band. The DETAIL drags in the recursive item
// editor (FieldRenderer and every Controlled* input, ~2.6k LOC), so it only
// compiles once a layer is actually opened: a sketch page that is never
// edited never pays for it.
const ContentLayers = dynamic( () => import( "./ContentLayers/ContentLayers" ) );
const ContentLayerDetail = dynamic( () => import( "./ContentLayers/ContentLayerDetail" ) );
const SlideTransitionSettings = dynamic( () => import( "./SlideTransitionSettings" ) );

import {
  parseLayerPath
} from "./ContentLayers/ContentLayerDetail";
import {
  useContentSelection, useSelectContentPath
} from "@/components/ClientProcessingSketch/components/SketchOptions/hooks/useContentItemSelection";
import OptionsImportExport from "./CaptureActions/components/OptionsImportExport";
import UndoRedo from "./UndoRedo";
import type {
  CollapsibleSection, CollapsibleStates
} from "@/components/ClientProcessingSketch/components/SketchOptions/hooks/useCollapsibleStates";

export type OptionsPanelBodyProps = {
  activeSlideIndex: number | undefined;
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
 * The content rail: a layers list of everything drawn over the sketch — text,
 * images, QR codes… — grouped by what it applies to, this slide first and the
 * shared content after it. Pressing a layer opens its inspector in place of
 * the list; the back arrow returns.
 *
 * Slides themselves live in the filmstrip, canvas & animation in the inspector.
 */
export function OptionsPanelBody( {
  activeSlideIndex,
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
  } )?.length ?? 0;
  const activeSlideContentLength = useWatch( {
    control,
    name:
      activeSlideIndex !== undefined
        ? `slides.${ activeSlideIndex }.content`
        : "content"
  } )?.length ?? 0;

  const hasActiveSlide = activeSlideIndex !== undefined;

  // The band counts every layer it holds, both scopes — without a slide the
  // two watches read the same array, so only count it once.
  const layerCount = hasActiveSlide
    ? rootContentLength + activeSlideContentLength
    : rootContentLength;

  const selection = useContentSelection();
  const selectPath = useSelectContentPath();
  const address = parseLayerPath( selection?.path ?? null );

  // The layer you came back from stays marked in the list. The live selection
  // cannot do that job: it is cleared by the back arrow (or the detail would
  // reopen), and while it is set the list is not on screen at all.
  const [
    lastOpenedPath,
    setLastOpenedPath
  ] = React.useState<string | null>( null );

  const openLayer = ( itemPath: string ) => {
    setLastOpenedPath( itemPath );
    selectPath( itemPath );
  };

  // Without slides the list has a single group, which then goes unlabelled —
  // so its `+` is hosted here, in the band's own header, and the panel never
  // prints "layers" twice.
  const [
    paletteOpen,
    setPaletteOpen
  ] = React.useState( false );

  const showBandAddButton = !address && !hasActiveSlide;

  return (
    <div
      className={ clsx(
        "flex flex-col min-h-0",
        scrollable && "overflow-y-auto overflow-x-hidden"
      ) }
      style={ scrollable ? {
        maxHeight: "calc(80svh - 3rem)"
      } : undefined }
    >
      {/* One band for the whole stack: the list, or the inspector of the
          layer picked out of it. The meta count stays on the list — in the
          detail the band already names the layer. */}
      <PanelSection
        label={ address ? "layer" : "layers" }
        meta={ !address && layerCount ? String( layerCount ) : undefined }
        expanded={ collapsibleStates.content }
        onToggle={ () => onCollapsibleToggle( "content" ) }
        bodyPaddingClassName="px-2 pb-2 pt-0.5"
        last={ !hasActiveSlide }
        actions={ showBandAddButton ? (
          <button
            type="button"
            onClick={ () => {
              // Opening the palette while the band is shut would unfold it out
              // of sight, so the band comes with it.
              if ( !collapsibleStates.content ) {
                onCollapsibleToggle( "content" );
              }

              setPaletteOpen( !paletteOpen );
            } }
            aria-expanded={ paletteOpen }
            aria-label="Add a layer"
            title="Add a layer"
            className={ clsx(
              "rounded-md p-2 md:p-1 transition-colors hover:bg-hover",
              paletteOpen ? "text-foreground" : "text-label hover:text-foreground"
            ) }
          >
            {paletteOpen ? (
              <X className="h-4 w-4 md:h-3.5 md:w-3.5" />
            ) : (
              <Plus className="h-4 w-4 md:h-3.5 md:w-3.5" />
            )}
          </button>
        ) : undefined }
      >
        {address ? (
          <ContentLayerDetail
            address={ address }
            onBack={ () => selectPath( null ) }
          />
        ) : (
          <ContentLayers
            activeSlideIndex={ activeSlideIndex }
            selectedPath={ lastOpenedPath }
            onSelect={ openLayer }
            paletteOpen={ paletteOpen }
            onPaletteOpenChange={ setPaletteOpen }
          />
        )}
      </PanelSection>

      {/* A transition belongs to the slide, not to any layer, so it stays a
          band of its own rather than a row in the list. */}
      {hasActiveSlide && (
        <PanelSection
          label="transition"
          expanded={ collapsibleStates.transition }
          onToggle={ () => onCollapsibleToggle( "transition" ) }
          last
        >
          <SlideTransitionSettings activeIndex={ activeSlideIndex } />
        </PanelSection>
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

  // Docked: the rail supplies chrome and scrolling, and undo/redo +
  // import/export live in the top bar / export panel — render the sections
  // bare.
  if ( docked ) {
    return <OptionsPanelBody scrollable={ false } { ...bodyProps } />;
  }

  // Floating card: the card itself no longer collapses — its sections do, so
  // the section titles stay visible and a fully collapsed card is already
  // small. (It also removes a second whole-panel toggle competing with the
  // per-section ones.)
  return (
    <div className="flex flex-col w-full glass border border-theme rounded-2xl shadow-lg overflow-hidden">
      <div className="flex gap-1 px-2 py-1.5 border-b border-theme">
        <UndoRedo />

        <OptionsImportExport
          options={ options }
          name={ name }
          persistedJobId={ persistedJob?.id }
          jobStatus={ jobStatus }
          onImportInMemory={ ( importedOptions ) =>
            onImportOptions( importedOptions as SketchOption ) }
        />
      </div>

      <OptionsPanelBody { ...bodyProps } />
    </div>
  );
}