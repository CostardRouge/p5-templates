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
  SketchOption,
  SketchOptionInput, SlideOption
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
import deepClone from "@/utils/deepClone";
import makeDefaultSlide from "@/components/ClientProcessingSketch/components/TemplateOptions/utils/makeDefaultSlide";

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

  const handleSlideSelect = ( index: number ) => {
    setActiveSlideIndex( index );

    if ( typeof window.setSlide === "function" ) {
      window.setSlide( index );
    }
  };

  const methods = useForm<SketchOptionInput>( {
    mode: "onChange",
    defaultValues: initOptions( initialOptions ),
    resolver: zodResolver( OptionsSchema )
  } );

  const {
    control,
    watch,
    getValues,
    formState: {
      errors
    },
  } = methods;

  const {
    fields: slideFields,
    append: appendSlide,
    insert: insertSlide,
    move: moveSlide,
    remove: removeSlide
  } = useFieldArray( {
    control,
    name: "slides",
  } );

  useEffect(
    () => {
      const subscription = watch( ( value ) => {
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

  useEffect(
    () => {
      const length = slideFields.length;

      if ( length === 0 ) {
        setActiveSlideIndex( 0 );
        return;
      }
      setActiveSlideIndex( ( current ) => {
        if ( current < 0 ) {
          return 0;
        }
        if ( current > length - 1 ) {
          return length - 1;
        }
        return current;
      } );
    },
    [
      slideFields.length
    ]
  );

  const handleAddSlide = () => {
    const nextIndex = slideFields.length;

    appendSlide( makeDefaultSlide( {
      indexForLabel: nextIndex
    } ) );
    setActiveSlideIndex( nextIndex );
  };

  const handleDuplicateSlide = ( indexToDuplicate: number ) => {
    const allSlides = getValues( "slides" ) ?? [
    ];
    const original = allSlides[ indexToDuplicate ];

    if ( !original ) {
      return;
    }
    const duplicated = deepClone( original );

    if ( duplicated?.name ) {
      duplicated.name = `${ duplicated.name } (copy)`;
    }
    const insertIndex = indexToDuplicate + 1;

    insertSlide(
      insertIndex,
      duplicated
    );
    setActiveSlideIndex( insertIndex );
  };

  const handleDeleteSlide = ( indexToDelete: number ) => {
    const lengthBefore = slideFields.length;

    if ( lengthBefore <= 0 ) {
      return;
    }

    removeSlide( indexToDelete );
    const lengthAfter = lengthBefore - 1;

    if ( lengthAfter <= 0 ) {
      setActiveSlideIndex( 0 );
      return;
    }

    if ( indexToDelete < activeSlideIndex ) {
      setActiveSlideIndex( activeSlideIndex - 1 );
      return;
    }

    if ( indexToDelete === activeSlideIndex ) {
      const nextIndex = Math.min(
        activeSlideIndex,
        lengthAfter - 1
      );

      setActiveSlideIndex( nextIndex );
      return;
    }
  };

  const handleReorderSlides = (
    oldIndex: number, newIndex: number
  ) => {
    if ( oldIndex === newIndex ) {
      return;
    }

    moveSlide(
      oldIndex,
      newIndex
    );
    setActiveSlideIndex( newIndex );
  };

  const options = watch();
  const slides = getValues( "slides" );
  const slideIds = slideFields.map( ( field ) => field.id );
  const rootContentLength = options?.content?.length;
  const slidesLength = slides?.length;

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

        { slides && (
          <Fragment>
            <div className="rounded-sm border border-gray-300 text-black text-left bg-white">
              <span className="px-1 text-xs text-gray-500">slides {slidesLength ? `(${ slidesLength })` : null}</span>

              <SlideCarousel
                slides={slides as SlideOption[]}
                slideIds={slideIds}
                activeIndex={activeSlideIndex}
                onAdd={handleAddSlide}
                onSelect={handleSlideSelect}
                onReorder={handleReorderSlides}
                onDuplicate={handleDuplicateSlide}
                onDelete={handleDeleteSlide}
              />
            </div>

            <div className="overflow-y-scroll rounded-sm border-t border-b border-gray-300">
              <SlideEditor
                key={activeSlideIndex}
                activeIndex={activeSlideIndex}
                options={options as SketchOption}
              />
            </div>
          </Fragment>
        ) }

        <CaptureActions
          name={name}
          options={options as SketchOption}
          persistedJob={persistedJob}
        />
      </FormProvider>
    </CollapsibleItem>
  );
}
