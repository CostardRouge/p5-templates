import React from "react";
import {
  SketchOption
} from "@/types/sketch.types";
import ContentLayerListForm from "./ContentLayerListForm/ContentLayerListForm";
// import ImageAssets from "@/components/TemplateOptions/components/ImageAssets";
import TemplateAssetsProvider from "../components/TemplateAssetsProvider/TemplateAssetsProvider";

type SlideEditorProps = {
  activeIndex: number;
  options: SketchOption;
};

export default function SlideEditor( {
  activeIndex, options
}: SlideEditorProps ) {
  const baseContentFieldName = `slides.${ activeIndex }` as const;
  const slide = options.slides?.[ activeIndex ];

  if ( !slide ) {
    return <div className="p-2 text-gray-500">Select a slide to edit.</div>;
  }

  return (
    <div className="border-r border-l border-gray-300 text-black text-left bg-white rounded-sm">
      <span className="px-1 text-xs text-gray-500">root.slides[{activeIndex}].content</span>

      <TemplateAssetsProvider
        scope={{
          slide: activeIndex
        }}
        assetsName={`${ baseContentFieldName }.assets`}
        jobId={options.id}
      >
        <ContentLayerListForm baseFieldName={`${ baseContentFieldName }.content`} />
      </TemplateAssetsProvider>

      {/* <span className="px-1 mt-2 text-xs text-gray-500">root.slides[{activeIndex}].assets.images</span>*/}
      {/* <ImageAssets*/}
      {/*  id={options.id}*/}
      {/*  assets={slide.assets}*/}
      {/*  scope={{*/}
      {/*    slide: activeIndex*/}
      {/*  }}*/}
      {/* />*/}
    </div>
  );
}
