"use client";

import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";

import ContentArrayProvider from "../ContentArrayProvider/ContentArrayProvider";
import SketchAssetsProvider from "../SketchAssetsProvider/SketchAssetsProvider";
import LayerDetail from "./components/LayerDetail";

export type LayerAddress = {
  baseFieldName: "content" | `slides.${ number }.content`;
  index: number;
  /** Slide the layer belongs to, or undefined for the shared (root) content. */
  slideIndex?: number;
};

/**
 * Read a selected item path back into the scope it belongs to.
 *
 * The path is the address the rest of the studio already speaks — the canvas
 * selection event, the collapsible keys and the form all use `content.2` /
 * `slides.1.content.0` — so the detail view derives its scope from it rather
 * than carrying a second, parallel notion of where it is.
 */
export function parseLayerPath( path: string | null ): LayerAddress | null {
  if ( !path ) {
    return null;
  }

  const root = /^content\.(\d+)$/.exec( path );

  if ( root ) {
    return {
      baseFieldName: "content",
      index: Number( root[ 1 ] )
    };
  }

  const slide = /^slides\.(\d+)\.content\.(\d+)$/.exec( path );

  if ( slide ) {
    const slideIndex = Number( slide[ 1 ] );

    return {
      baseFieldName: `slides.${ slideIndex }.content`,
      index: Number( slide[ 2 ] ),
      slideIndex
    };
  }

  return null;
}

type ContentLayerDetailProps = {
  address: LayerAddress;
  onBack: () => void;
};

/**
 * Mounts one layer's inspector inside the providers of ITS OWN scope — the
 * asset list an image picker offers is the slide's for a slide layer and the
 * sketch's for a shared one, so getting this wrong shows up as an image
 * picker that silently offers the wrong library.
 */
export default function ContentLayerDetail( {
  address,
  onBack
}: ContentLayerDetailProps ) {
  const {
    control
  } = useFormContext();

  const jobId = useWatch( {
    control,
    name: "id"
  } ) as string | undefined;

  const {
    baseFieldName, index, slideIndex
  } = address;

  const detail = (
    <ContentArrayProvider name={ baseFieldName }>
      <LayerDetail
        baseFieldName={ baseFieldName }
        index={ index }
        onBack={ onBack }
      />
    </ContentArrayProvider>
  );

  if ( slideIndex === undefined ) {
    return (
      <SketchAssetsProvider scope="global" assetsName="assets" jobId={ jobId }>
        {detail}
      </SketchAssetsProvider>
    );
  }

  return (
    <SketchAssetsProvider
      scope={ {
        slide: slideIndex
      } }
      assetsName={ `slides.${ slideIndex }.assets` }
      jobId={ jobId }
    >
      {detail}
    </SketchAssetsProvider>
  );
}
