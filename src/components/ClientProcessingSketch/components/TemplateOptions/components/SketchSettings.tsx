"use client";

import React from "react";
import {
  useFormContext, useWatch
} from "react-hook-form";

// Your presets
const presets = [
  {
    label: "1080 × 1080",
    w: 1080,
    h: 1080
  },
  {
    label: "1920 × 1080",
    w: 1920,
    h: 1080
  },
  {
    label: "2048 × 2048",
    w: 2048,
    h: 2048
  },
];

// Common framerate options
const fpsOptions = [
  1,
  5,
  10,
  12,
  15,
  24,
  25,
  30,
  48,
  50,
  60
];

// tiny debounce hook
function useDebouncedEffect(
  effect: () => void, deps: any[], ms = 250
) {
  React.useEffect(
    () => {
      const t = setTimeout(
        effect,
        ms
      );

      return () => clearTimeout( t );
    },
    deps
  );
}

export default function SketchSettings() {
  const {
    register, setValue, control
  } = useFormContext();

  // Watch values live
  const {
    width, height
  } =
  useWatch( {
    control,
    name: "size"
  } ) ?? {
    width: 0,
    height: 0
  };
  const {
    duration, framerate
  } =
  useWatch( {
    control,
    name: "animation"
  } ) ?? {
    duration: 0,
    framerate: 0
  };

  // Compute currently selected preset (or custom)
  const matchedPresetIndex = React.useMemo(
    () => presets.findIndex( ( p ) => p.w === width && p.h === height ),
    [
      width,
      height
    ]
  );

  // Debounced side-effects to p5
  useDebouncedEffect(
    () => {
      if ( typeof window !== "undefined" && ( window as any ).resizeSketch ) {
        ( window as any ).resizeSketch(
          width,
          height
        );
      }
    },
    [
      width,
      height
    ],
    300
  );

  useDebouncedEffect(
    () => {
      if ( typeof window !== "undefined" && ( window as any ).setFrameRate ) {
        ( window as any ).setFrameRate( framerate );
      }
    },
    [
      framerate
    ],
    150
  );

  // Register a virtual field for the size preset selector which writes width/height
  const sizePresetField = register(
 "size.__preset" as const,
 {
   onChange: ( e ) => {
     const i = parseInt(
       e.target.value,
       10
     );
     const p = presets[ i ];

     if ( !p ) return;
     setValue(
       "size.width",
       p.w,
       {
         shouldDirty: true,
         shouldValidate: true
       }
     );
     setValue(
       "size.height",
       p.h,
       {
         shouldDirty: true,
         shouldValidate: true
       }
     );
   },
 }
  );

  return (
    <div className="p-1 border rounded-sm bg-white hover:shadow hover:border-gray-300 text-xs">
      <div className="flex flex-col gap-2">
        <div>
          <label
            htmlFor="size.__preset"
            className="text-gray-400"
          >
            Size
          </label>
          <select
            id="size.__preset"
            className="w-full border border-gray-300 rounded-sm"
            value={matchedPresetIndex >= 0 ? String( matchedPresetIndex ) : ""}
            {...sizePresetField}
          >
            <option value="" disabled>
              {matchedPresetIndex < 0
                ? `Custom (${ width } × ${ height })`
                : "Choose a preset"}
            </option>
            {presets.map( (
              p, i
            ) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ) )}
          </select>
        </div>

        <div>
          <label
            htmlFor="animation"
            className="text-gray-400"
          >
            Animation
          </label>

          <div className="flex gap-1 p-1 mt-0.5 border border-gray-300 rounded-sm text-black">
            <div className="flex-1">
              <label className="text-gray-400" htmlFor="animation.duration">
                Duration
              </label>

              <input
                id="animation.duration"
                className="w-full p-1 border border-gray-300 rounded-sm h-7"
                type="number"
                min="1"
                max="60"
                {...register(
                  "animation.duration",
                  {
                    valueAsNumber: true
                  }
                )}
              />
            </div>

            <div className="flex-1">
              <label className="text-gray-400" htmlFor="animation.framerate">
                Framerate
              </label>
              <select
                id="animation.framerate"
                className="w-full border border-gray-300 rounded-sm h-7"
                {...register(
                  "animation.framerate",
                  {
                    valueAsNumber: true
                  }
                )}
                defaultValue={framerate ?? 60}
              >
                {fpsOptions.map( ( fps ) => (
                  <option key={fps} value={fps}>
                    {fps} hertz
                  </option>
                ) )}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
