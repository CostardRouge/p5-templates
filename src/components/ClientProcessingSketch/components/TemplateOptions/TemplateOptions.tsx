"use client";

import React, {
  Fragment, useEffect, useRef, useState,
} from "react";
import {
  ArrowDownFromLine, ListCollapse
} from "lucide-react";

import {
  JobModel
} from "@/types/recording.types";
import {
  OptionsSchema, SketchOption, SketchOptionInput, SlideOption,
} from "@/types/sketch.types";

import FormUndoRedo from "./components/FormUndoRedo/FormUndoRedo";
import ContentItems from "./components/ContentItems/ContentItems";
import CaptureActions from "./components/CaptureActions";
import SlideCarousel from "./components/SlideCarousel";
import SlideEditor from "./components/SlideEditor";

import TemplateAssetsProvider from "./components/TemplateAssetsProvider/TemplateAssetsProvider";

import {
  FormProvider, useFieldArray, useForm, useWatch
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

import RootSettings
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/RootSettings";
import clsx from "clsx";
import UndoRedo from "@/components/ClientProcessingSketch/components/TemplateOptions/components/UndoRedo";

export default function TemplateOptions( {
  name,
  setOptions,
  persistedJob,
  options: initialOptions,
}: {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  setOptions: (
    nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void )
  ) => void;
} ) {
  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState( 0 );

  const methods = useForm<SketchOptionInput>( {
    mode: "onChange",
    defaultValues: initOptions( initialOptions ),
    resolver: zodResolver( OptionsSchema ),
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
    remove: removeSlide,
  } = useFieldArray( {
    control,
    name: "slides",
  } );

  const slides = useWatch( {
    control,
    name: "slides",
  } ) as SlideOption[] | undefined;

  const jobId = useWatch( {
    control,
    name: "id",
  } ) as string | undefined;

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

  const didInitSelection = useRef( false );

  useEffect(
    () => {
      const length = slideFields.length;

      if ( !didInitSelection.current && length > 0 ) {
        didInitSelection.current = true;

        setActiveSlideIndex( 0 );

        if ( typeof window.setSlide === "function" ) {
          window.setSlide( 0 );
        }
      }
    },
    [
      slideFields.length
    ]
  );

  useEffect(
    () => {
      const length = slideFields.length;

      setActiveSlideIndex( ( current ) => {
        let next = current;

        if ( length === 0 ) {
          next = 0;
        }
        else if ( current < 0 ) {
          next = 0;
        }
        else if ( current > length - 1 ) {
          next = length - 1;
        }

        if ( typeof window.setSlide === "function" ) {
          window.setSlide( next );
        }

        return next;
      } );
    },
    [
      slideFields.length
    ]
  );

  const handleSlideSelect = ( index: number ) => {
    setActiveSlideIndex( index );

    if ( typeof window.setSlide === "function" ) {
      window.setSlide( index );
    }
  };

  const handleAddSlide = () => {
    const nextIndex = slideFields.length;

    appendSlide( makeDefaultSlide( {
      indexForLabel: nextIndex,
    } ) );

    handleSlideSelect( nextIndex );
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

    handleSlideSelect( insertIndex );
  };

  const handleDeleteSlide = ( indexToDelete: number ) => {
    const lengthBefore = slideFields.length;

    if ( lengthBefore <= 0 ) {
      return;
    }

    removeSlide( indexToDelete );
    const lengthAfter = lengthBefore - 1;

    if ( lengthAfter <= 0 ) {
      handleSlideSelect( 0 );
      return;
    }

    if ( indexToDelete < activeSlideIndex ) {
      handleSlideSelect( activeSlideIndex - 1 );
      return;
    }

    if ( indexToDelete === activeSlideIndex ) {
      const nextIndex = Math.min(
        activeSlideIndex,
        lengthAfter - 1
      );

      handleSlideSelect( nextIndex );
      return;
    }
    handleSlideSelect( activeSlideIndex );
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

    handleSlideSelect( newIndex );
  };

  const slideIds = slideFields.map( ( field ) => field.id );
  const slidesLength = slides?.length;
  const rootContentLength = useWatch( {
    control,
    name: "content",
  } )?.length;

  const options = watch();
  const editorKey = slideIds[ activeSlideIndex ] ?? `${ activeSlideIndex }-${ slides?.[ activeSlideIndex ]?.name ?? "unnamed-slide" }`;

  return (
    <CollapsibleItem
      data-no-zoom=""
      className="w-64 flex flex-col gap-1 absolute right-0 bottom-0 bg-background p-2 border border-b-0 border-theme  border-r-0 z-50 rounded-tl"
      style={{
        maxHeight: "calc(80svh)"
      }}
      header={( expanded ) => (
        <button
          className={
            clsx(
              "text-foreground text-sm text-right",
              {
                " w-full": !expanded,
                "absolute top-2 right-2": expanded
              }
            )
          }
          aria-label={expanded ? "Collapse controls" : "Expand controls"}
        >
          <span>{expanded ? "hide" : "show"} options</span>
          <ArrowDownFromLine
            className="inline text-foreground h-4"
            style={{
              rotate: expanded ? "0deg" : "180deg"
            }}
          />
        </button>
      )}
    >
      <FormProvider {...methods}>
        <FormUndoRedo
          maxHistory={50}
          hotkeys
          autoCapture="debounced"
          debounceMs={400}
          watchPaths={[
            "slides",
            "slides",
            "animation"
          ]}
          captureInitial
        >
          <UndoRedo />
        </FormUndoRedo>

        <RootSettings />

        <CollapsibleItem
          initialExpandedValue={false}
          className="p-1 border border-theme rounded text-left text-foreground bg-background overflow-y-auto"
          headerContainerClassName="leading-none"
          header={( expanded ) => (
            <button
              className={
                clsx(
                  "text-foreground text-xs w-full text-left -ml-1 align-text-top",
                  {
                    "mb-1": expanded
                  }
                )
              }
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <ListCollapse
                className="inline text-foreground h-3"
                style={{
                  rotate: expanded ? "180deg" : "0deg"
                }}
              />
              <span>global content {rootContentLength ? `(${ rootContentLength })` : null}</span>
            </button>
          )}
        >
          <TemplateAssetsProvider scope="global" assetsName="assets" jobId={jobId}>
            <ContentArrayProvider name="content">
              <ContentItems baseFieldName="content"/>
            </ContentArrayProvider>
          </TemplateAssetsProvider>
        </CollapsibleItem>

        {slides && (
          <Fragment>
            <CollapsibleItem
              initialExpandedValue={!!slidesLength}
              className="p-1 border border-theme rounded bg-background overflow-y-auto"
              headerContainerClassName="leading-none"
              header={( expanded ) => (
                <button
                  className={
                    clsx(
                      "text-foreground text-xs w-full text-left -ml-1 align-text-top",
                      {
                        "mb-1": expanded
                      }
                    )
                  }
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  <ListCollapse
                    className="inline text-foreground h-3"
                    style={{
                      rotate: expanded ? "180deg" : "0deg"
                    }}
                  />
                  <span>slides {slidesLength ? `(${ slidesLength })` : null}</span>
                </button>
              )}
            >
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

              <SlideEditor
                key={editorKey}
                activeIndex={activeSlideIndex}
              />
            </CollapsibleItem>
          </Fragment>
        )}

        <CaptureActions
          name={name}
          options={options as SketchOption}
          persistedJob={persistedJob}
        />
      </FormProvider>
    </CollapsibleItem>
  );
}
