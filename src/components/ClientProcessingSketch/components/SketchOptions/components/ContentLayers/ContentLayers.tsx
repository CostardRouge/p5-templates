"use client";

import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";

import ContentArrayProvider from "../ContentArrayProvider/ContentArrayProvider";
import SketchAssetsProvider from "../SketchAssetsProvider/SketchAssetsProvider";
import LayerGroup from "./components/LayerGroup";

type ContentLayersProps = {
  activeSlideIndex: number | undefined;
  /** The layer whose inspector was last opened — marked in the list so coming
   *  back from one lands you where you were. */
  selectedPath: string | null;
  onSelect: ( itemPath: string ) => void;
  /** Palette state for the single-group case, where the `+` sits in the
   *  band's header rather than in a group header of its own. */
  paletteOpen: boolean;
  onPaletteOpenChange: ( open: boolean ) => void;
};

/**
 * The layers list: everything drawn over the sketch, in one place, grouped by
 * what it applies to — this slide first (what you edit most), then what every
 * slide shares.
 *
 * Both groups are live: a shared layer is edited here like any other, and the
 * group label is what says it applies everywhere. The panel deliberately has
 * no third "inherited, read-only" state — it would be a mode to learn for no
 * gain.
 *
 * Without slides there is only one scope, so the group drops its header
 * entirely: the band above already reads "layers" with the same count, and
 * its `+` is the one in the band's own header. A group names itself only when
 * there is another group to tell it apart from.
 *
 * Each group is mounted inside its own scope providers, because a layer's
 * assets belong to its scope: an image in a slide layer resolves against that
 * slide's asset list, not the sketch's.
 */
export default function ContentLayers( {
  activeSlideIndex,
  selectedPath,
  onSelect,
  paletteOpen,
  onPaletteOpenChange
}: ContentLayersProps ) {
  const {
    control
  } = useFormContext();

  const jobId = useWatch( {
    control,
    name: "id"
  } ) as string | undefined;

  const hasActiveSlide = activeSlideIndex !== undefined;

  return (
    <div className="flex flex-col text-xs">
      {/* Keyed by the slide's own path: useFieldArray keeps its `fields` when
          only the `name` changes, so without a remount switching slides left
          the previous slide's rows on screen, bound to paths that no longer
          resolve (they rendered as a nameless "Layer"). The editor this list
          replaced remounted for the same reason. */}
      {hasActiveSlide && (
        <SketchAssetsProvider
          key={ `slides.${ activeSlideIndex }.content` }
          scope={ {
            slide: activeSlideIndex
          } }
          assetsName={ `slides.${ activeSlideIndex }.assets` }
          jobId={ jobId }
        >
          <ContentArrayProvider name={ `slides.${ activeSlideIndex }.content` }>
            <LayerGroup
              label="this slide"
              baseFieldName={ `slides.${ activeSlideIndex }.content` }
              selectedPath={ selectedPath }
              onSelect={ onSelect }
            />
          </ContentArrayProvider>
        </SketchAssetsProvider>
      )}

      <SketchAssetsProvider scope="global" assetsName="assets" jobId={ jobId }>
        <ContentArrayProvider name="content">
          <LayerGroup
            label={ hasActiveSlide ? "shared by all slides" : undefined }
            baseFieldName="content"
            selectedPath={ selectedPath }
            onSelect={ onSelect }
            paletteOpen={ hasActiveSlide ? undefined : paletteOpen }
            onPaletteOpenChange={ hasActiveSlide ? undefined : onPaletteOpenChange }
          />
        </ContentArrayProvider>
      </SketchAssetsProvider>
    </div>
  );
}
