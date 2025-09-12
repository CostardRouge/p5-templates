"use client";

import React, {
  Fragment, useEffect,
  useState
} from "react";
import {
  ArrowDownFromLine,
} from "lucide-react";

import {
  JobModel
} from "@/types/recording.types";
import {
  OptionsSchema,
  SketchOption
} from "@/types/sketch.types";

import ContentItems from "./components/ContentItems/ContentItems";
import CaptureActions from "./components/CaptureActions";
import SlideCarousel from "./components/SlideCarousel";
import SlideEditor from "./components/SlideEditor";

import TemplateAssetsProvider from "./components/TemplateAssetsProvider/TemplateAssetsProvider";

import {
  FormProvider,
  useFieldArray,
  useForm
} from "react-hook-form";
import {
  zodResolver
} from "@hookform/resolvers/zod";

import CollapsibleItem from "@/components/CollapsibleItem";
import initOptions from "@/components/utils/initOptions";

import ContentArrayProvider
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentArrayProvider/ContentArrayProvider";

export default function TemplateOptions( {
  name,
  setOptions,
  persistedJob,
  options: initialOptions,
}: {
    name: string;
    options: SketchOption;
    persistedJob?: JobModel
    setOptions: ( nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ) ) => void;
} ) {
  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState( 0 );

  useEffect(
    () => {
      if ( typeof window?.slides?.index === "number" ) {
        setActiveSlideIndex( window.slides.index ?? 0 );
      }
    },
    [
    ]
  );

  const handleSlideSelect = ( index: number ) => {
    setActiveSlideIndex( index );

    if ( typeof window.setSlide === "function" ) {
      window.setSlide( index );
    }
  };

  const methods = useForm<SketchOption>( {
    mode: "onChange",
    defaultValues: initOptions( initialOptions ),
    resolver: zodResolver( OptionsSchema )
  } );

  const {
    control,
    watch,
    formState: {
      errors
    },
  } = methods;

  const {
    fields: slideFields, append: appendSlide, move: moveSlide
  } = useFieldArray( {
    control,
    name: "slides",
  } );

  useEffect(
    () => {
      const subscription = watch( ( value ) => {
        console.log( {
          value
        } );

        setOptions( value as SketchOption );
      } );

      return () => subscription.unsubscribe();
    },
    [
      watch,
      setOptions
    ]
  );

  useEffect(
    () => {
      if ( Object.keys( errors ).length > 0 ) {
        console.error(
          "Form Validation Errors:",
          errors
        );
      }
    },
    [
      errors
    ]
  );
  const options = watch();
  const rootContentLength = options?.content?.length;

  return (
    <CollapsibleItem
      data-no-zoom=""
      className="w-64 flex flex-col gap-1 absolute right-0 bottom-0 bg-white p-2 border border-b-0 border-gray-400 shadow shadow-black-300 drop-shadow-sm border-r-0 z-50 rounded-tl-sm"
      style={ {
        maxHeight: "calc(80svh)",
      } }
      header={ expanded => (
        <button
          className="text-gray-500 text-sm w-full"
          aria-label={expanded ? "Collapse controls" : "Expand controls"}
        >
          <ArrowDownFromLine
            className="inline text-gray-500 h-4"
            style={{
              rotate: expanded ? "0deg" : "180deg"
            }}
          />
          <span>{expanded ? "hide" : "show"} options</span>
        </button>
      )}
    >
      <FormProvider {...methods}>
        <div className="rounded-sm border border-gray-300 text-black text-left bg-white overflow-y-scroll">
          <span className="px-1 text-xs text-gray-500">root.content {rootContentLength ? `(${ rootContentLength })` : null}</span>

          <TemplateAssetsProvider scope="global" assetsName="assets" jobId={options.id}>
            <ContentArrayProvider name="content">
              <ContentItems baseFieldName="content" />
            </ContentArrayProvider>
          </TemplateAssetsProvider>
        </div>

        { slideFields && (
          <Fragment>
            <div className="rounded-sm border border-gray-300 text-black text-left bg-white">
              <SlideCarousel
                slides={slideFields}
                activeIndex={activeSlideIndex}
                onSelect={handleSlideSelect}
                onAdd={() => {
                  // addSlide( setOptions )
                }}
                onReorder={(
                  from: number, to: number
                ) => {
                  moveSlide(
                    from,
                    to
                  );
                }}
              />
            </div>

            <div className="overflow-y-scroll rounded-sm border-t border-b border-gray-300">
              <SlideEditor
                key={activeSlideIndex}
                activeIndex={activeSlideIndex}
                options={options}
              />
            </div>
          </Fragment>
        ) }

        <CaptureActions
          name={name}
          options={options}
          persistedJob={persistedJob}
        />
      </FormProvider>
    </CollapsibleItem>
  );
}