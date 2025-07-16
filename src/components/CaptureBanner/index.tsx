"use client";

import {
  JsonData
} from "json-edit-react";
import React, {
  Fragment,
  useState
} from "react";
import {
  ArrowDownFromLine,
} from "lucide-react";
import {
  JobModel
} from "@/types/recording.types";

import type {
  SketchOption
} from "@/types/sketch.types";

import ImageAssets from "@/components/CaptureBanner/components/ImageAssets";

import clsx from "clsx";
import CaptureActions from "@/components/CaptureBanner/components/CaptureActions";

import SlideCarousel from "./components/SlideCarousel";

export default function CaptureBanner( {
  name,
  options,
  setOptions,
  persistedJob
}: {
    name: string;
    options: SketchOption;
    persistedJob?: JobModel
    setOptions: ( nextOptions: JsonData ) => void;
} ) {
  const [
    expanded,
    setExpanded
  ] = useState( true );

  return (
    <div
      data-no-zoom=""
      className="w-64 flex flex-col gap-1 absolute right-0 bottom-0 bg-white p-2 border border-b-0 border-gray-400 shadow shadow-black-300 drop-shadow-sm border-r-0 z-50 rounded-tl-sm"
      style={ {
        maxHeight: "calc(60svh)",
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
        <>

          <div className="rounded-sm border border-gray-400 text-black text-left bg-white">
            <span className="px-1 text-xs text-gray-500">root.assets.images</span>
            <ImageAssets
              assets={options?.assets}
              scope="global"
              id={options.id}
            />
          </div>

          { options.slides && Array.isArray( options.slides ) && (
            <Fragment>
              <div className="rounded-sm border border-gray-400 text-black text-left bg-white">
                <SlideCarousel
                  slides={options.slides}
                  activeIndex={window?.slides?.index}
                  onSelect={window.setSlide}
                  onAdd={() => {
                    console.log( "onAdd" );
                    // addSlide( setOptions )
                  }}
                  onReorder={( slides ) => setOptions( {
                    slides
                  } )}
                />
              </div>

              <div className="overflow-y-scroll flex flex-col gap-1 rounded-sm border-t border-b border-gray-400">
                {options.slides?.map( (
                  slideOption, slideIndex
                ) => (
                  <div
                    key={`slide-${ slideIndex }`}
                    className={clsx(
                      "border border-gray-400 text-black text-left bg-white",
                      slideIndex === 0 && "border-t-0",
                      slideIndex === ( options?.slides?.length ?? 0 ) - 1 && "border-b-0"
                    )}
                  >
                    <span className="px-1 text-xs text-gray-500">root.slides[{slideIndex}].assets.images</span>
                    <ImageAssets
                      id={options.id}
                      assets={slideOption?.assets}
                      scope={{
                        slide: slideIndex
                      }}
                    />
                  </div>
                ) )}
              </div>
            </Fragment>
          )
          }

          <CaptureActions
            name={name}
            options={options}
            persistedJob={persistedJob}
          />
        </>
      )
      }
    </div>
  )
  ;
}