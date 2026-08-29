// SlideEditor.tsx
import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";
import {
  SketchOptionInput
} from "@/types/sketch.types";
import SketchAssetsProvider from "./SketchAssetsProvider/SketchAssetsProvider";
import ContentArrayProvider from "./ContentArrayProvider/ContentArrayProvider";
import ContentItems from "./ContentItems/ContentItems";
import SlideTransitionSettings from "./SlideTransitionSettings";

type SlideEditorProps = {
  activeIndex: number;
};

export default function SlideEditor( {
  activeIndex
}: SlideEditorProps ) {
  const {
    control
  } = useFormContext<SketchOptionInput>();

  const slide = useWatch( {
    control,
    name: `slides.${ activeIndex }`
  } );
  const jobId = useWatch( {
    control,
    name: "id"
  } );

  const slideFieldPath = `slides.${ activeIndex }` as const;
  const slideContentFieldPath = `${ slideFieldPath }.content` as const;

  if ( !slide ) {
    return null;
  }

  // No caption and no card of its own: this renders inside a PanelSection
  // band that already names and counts the content, and a raw `root.slides[N]`
  // path — 0-based, under a 1-based header — was a third name for the slide
  // the filmstrip already identifies.
  return (
    <div className="text-foreground text-left">
      <SlideTransitionSettings activeIndex={ activeIndex } />

      <SketchAssetsProvider
        scope={ {
          slide: activeIndex
        } }
        assetsName={ `${ slideFieldPath }.assets` }
        jobId={ jobId }
      >
        <ContentArrayProvider name={ slideContentFieldPath }>
          <ContentItems baseFieldName={ slideContentFieldPath } />
        </ContentArrayProvider>
      </SketchAssetsProvider>
    </div>
  );
}
