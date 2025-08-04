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
  ContentItem,
  OptionsSchema,
  SketchOption
} from "@/types/sketch.types";

import ImageAssets from "@/components/TemplateOptions/components/ImageAssets";
import CaptureActions from "@/components/TemplateOptions/components/CaptureActions";
import SlideCarousel from "./components/SlideCarousel";

import ContentLayerListForm from "./components/ContentLayerListForm/ContentLayerListForm";
import SlideEditor from "./components/SlideEditor";

import {
  FormProvider,
  useFieldArray,
  useForm
} from "react-hook-form";
import {
  zodResolver
} from "@hookform/resolvers/zod";

export default function TemplateOptions( {
  name,
  options,
  setOptions,
  persistedJob
}: {
    name: string;
    options: SketchOption;
    persistedJob?: JobModel
    setOptions: ( nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void ) ) => void;
} ) {
  const [
    expanded,
    setExpanded
  ] = useState( true );

  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState( 0 );

  // 2. Sync with p5.js on initial component mount
  useEffect(
    () => {
      if ( typeof window?.slides?.index === "number" ) {
        setActiveSlideIndex( window.slides.index );
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

  const methods = useForm<Partial<SketchOption>>( {
    resolver: zodResolver( OptionsSchema ),
    defaultValues: options,
  } );

  const {
    control,
    watch,
    formState: {
      errors
    },
  } = methods;

  // 1. Set up useFieldArray for the 'slides' property
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

  // For debugging Zod errors
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

  return (
    <div
      data-no-zoom=""
      className="w-64 flex flex-col gap-1 absolute right-0 bottom-0 bg-white p-2 border border-b-0 border-gray-400 shadow shadow-black-300 drop-shadow-sm border-r-0 z-50 rounded-tl-sm"
      style={ {
        maxHeight: "calc(80svh)",
      } }
    >
      <button
        className="text-gray-500 text-sm"
        onClick={() => setExpanded( e => !e )}
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

      {expanded && (
        <FormProvider {...methods}>
          <div className="rounded-sm border border-gray-300 text-black text-left bg-white">
            <span className="px-1 text-xs text-gray-500">root.content</span>
            <ContentLayerListForm baseFieldName="content" />

            <span className="px-1 text-xs text-gray-500">root.assets.images</span>
            <ImageAssets
              assets={options?.assets}
              scope="global"
              id={options.id}
            />
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
                    from, to
                  ) => {
                    // 4. Use the 'move' function from the hook
                    moveSlide(
                      from,
                      to
                    );
                  }}
                />
              </div>

              <div className="overflow-y-scroll rounded-sm border-t border-b border-gray-300">
                <SlideEditor
                  activeIndex={activeSlideIndex}
                  options={watch()} // Pass the whole form value to get slide assets
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
      ) }
    </div>
  );
}