// SlideEditor.tsx
import React from "react";
import {
  useWatch, useFormContext
} from "react-hook-form";
import {
  SketchOptionInput
} from "@/types/sketch.types";
import TemplateAssetsProvider from "./TemplateAssetsProvider/TemplateAssetsProvider";
import ContentArrayProvider from "./ContentArrayProvider/ContentArrayProvider";
import ContentItems from "./ContentItems/ContentItems";

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

  const slideContentLength = slide?.content?.length ?? 0;

  return (
    <div className="text-black text-left bg-white rounded-sm">
      <span className="p-1 text-xs text-gray-500">
        root.slides[{activeIndex}].content {slideContentLength ? `(${ slideContentLength })` : null}
      </span>

      <TemplateAssetsProvider
        scope={{
          slide: activeIndex
        }}
        assetsName={`${ slideFieldPath }.assets`}
        jobId={jobId}
      >
        <ContentArrayProvider name={slideContentFieldPath}>
          <ContentItems baseFieldName={slideContentFieldPath} />
        </ContentArrayProvider>
      </TemplateAssetsProvider>
    </div>
  );
}
