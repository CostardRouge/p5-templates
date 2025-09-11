import React from "react";
import {
  SketchOption
} from "@/types/sketch.types";
import ContentLayerListForm from "./ContentLayerListForm/ContentLayerListForm";
// import ImageAssets from "@/components/TemplateOptions/components/ImageAssets";
import TemplateAssetsProvider from "../components/TemplateAssetsProvider/TemplateAssetsProvider";
import ContentArrayProvider
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentArrayProvider/ContentArrayProvider";

type SlideEditorProps = {
  activeIndex: number;
  options: SketchOption;
};

export default function SlideEditor( {
  activeIndex, options
}: SlideEditorProps ) {
  const slideFieldPath = `slides.${ activeIndex }` as const;
  const slideContentFieldPath = `${ slideFieldPath }.content` as const;
  const slide = options.slides?.[ activeIndex ];

  if ( !slide ) {
    return <div className="p-1 text-gray-500 text-center text-xs border-r border-l border-gray-300">Select a slide to edit.</div>;
  }

  return (
    <div className="border-r border-l border-gray-300 text-black text-left bg-white rounded-sm">
      <span className="px-1 text-xs text-gray-500">root.slides[{activeIndex}].content</span>

      <TemplateAssetsProvider
        scope={{
          slide: activeIndex
        }}
        assetsName={`${ slideFieldPath }.assets`}
        jobId={options.id}
      >
        <ContentArrayProvider name={slideContentFieldPath} scopeKey={slideContentFieldPath}>
          <ContentLayerListForm baseFieldName={slideContentFieldPath} />
        </ContentArrayProvider>
      </TemplateAssetsProvider>
    </div>
  );
}
