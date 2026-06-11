"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  RotateCcw
} from "lucide-react";
import React, {
  useState
} from "react";
import clsx from "clsx";
import {
  Controller, useFormContext
} from "react-hook-form";

import rgbaToHex from "./utils/rgbaToHex";
import hexToRgba from "./utils/hexToRgba";
import {
  CONTROL_BAR_CLASS,
  CONTROL_EDIT_INPUT_CLASS,
  CONTROL_RESET_BUTTON_CLASS,
  CONTROL_VALUE_BUTTON_CLASS
} from "../../constants/control-bar";

type ControlledColorInputProps = {
  name: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

const CHECKERBOARD_STYLE: React.CSSProperties = {
  background: `linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc),
              linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)`,
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 4px 4px"
};

/**
 * One-line color control sharing the slider bar chrome: the whole bar drags
 * the alpha channel, and its fill doubles as the live color preview (the
 * color at its current alpha over a checkerboard). The swatch on the left
 * opens the native color picker; tapping the percentage switches the bar to
 * numeric alpha entry.
 */
export default function ControlledColorInput( {
  name,
  label,
  isModified = false,
  onReset
}: ControlledColorInputProps ) {
  const {
    control
  } = useFormContext();

  const [
    editing,
    setEditing
  ] = useState( false );

  return (
    <Controller
      control={ control }
      name={ name }
      render={ ( {
        field
      } ) => {
        // Ensure we always have a valid RGBA array
        const currentValue =
          Array.isArray( field.value ) && field.value.length >= 3
            ? field.value
            : [
              0,
              0,
              0,
              255
            ];
        const r = currentValue[ 0 ] ?? 0;
        const g = currentValue[ 1 ] ?? 0;
        const b = currentValue[ 2 ] ?? 0;
        const a = currentValue[ 3 ] ?? 255;
        const alphaPercent = Math.round( ( a / 255 ) * 100 );
        const hex = rgbaToHex( currentValue );

        const handleColorChange = ( nextHex: string ) => {
          const [
            newR,
            newG,
            newB
          ] = hexToRgba( nextHex );

          field.onChange( [
            newR,
            newG,
            newB,
            a
          ] ); // Preserve alpha
        };

        const handleAlphaChange = ( newAlpha: number ) => {
          field.onChange( [
            r,
            g,
            b,
            Math.min(
              255,
              Math.max(
                0,
                Math.round( newAlpha )
              )
            )
          ] );
        };

        const commitEdit = ( raw: string ) => {
          setEditing( false );

          const parsed = parseInt(
            raw,
            10
          );

          if ( Number.isNaN( parsed ) ) {
            return;
          }

          handleAlphaChange( ( Math.min(
            100,
            Math.max(
              0,
              parsed
            )
          ) / 100 ) * 255 );
        };

        if ( editing ) {
          return (
            <input
              type="number"
              autoFocus
              defaultValue={ alphaPercent }
              step={ 1 }
              min={ 0 }
              max={ 100 }
              inputMode="numeric"
              aria-label={ `${ label ?? name } alpha percentage` }
              className={ CONTROL_EDIT_INPUT_CLASS }
              onBlur={ ( e ) => commitEdit( e.target.value ) }
              onKeyDown={ ( e ) => {
                if ( e.key === "Enter" ) {
                  commitEdit( ( e.target as HTMLInputElement ).value );
                } else if ( e.key === "Escape" ) {
                  setEditing( false );
                }
              } }
            />
          );
        }

        return (
          <SliderPrimitive.Root
            min={ 0 }
            max={ 255 }
            step={ 1 }
            value={ [
              a
            ] }
            onValueChange={ ( [
              next
            ] ) => handleAlphaChange( next ) }
            onBlur={ field.onBlur }
            className={ `group touch-none select-none cursor-ew-resize ${ CONTROL_BAR_CLASS }` }
          >
            <SliderPrimitive.Track
              className="relative h-full w-full grow"
              style={ CHECKERBOARD_STYLE }
            >
              <SliderPrimitive.Range
                className="absolute h-full"
                style={ {
                  backgroundColor: `rgba(${ r }, ${ g }, ${ b }, ${ a / 255 })`
                } }
              />
            </SliderPrimitive.Track>

            <SliderPrimitive.Thumb
              aria-label={ `${ label ?? name } alpha` }
              className="block h-6 md:h-4 w-1 rounded-full bg-foreground/60 ring-1 ring-background/80 focus-visible:outline-none focus-visible:bg-foreground"
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-2">
              <span className="flex min-w-0 items-center gap-1.5">
                {/* Swatch: opens the native color picker (opaque so the hue
                    stays visible even at alpha 0). */}
                <span
                  className="pointer-events-auto relative h-6 w-6 md:h-4 md:w-4 shrink-0 cursor-pointer overflow-hidden rounded-md border border-theme shadow-sm"
                  style={ {
                    backgroundColor: hex
                  } }
                  onPointerDown={ ( e ) => e.stopPropagation() }
                >
                  <input
                    id={ name }
                    type="color"
                    value={ hex }
                    onChange={ ( e ) => handleColorChange( e.target.value ) }
                    aria-label={ `${ label ?? name } color picker` }
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </span>

                {label && (
                  <span
                    className={ clsx(
                      "truncate rounded bg-background/70 px-1 backdrop-blur-sm",
                      isModified ? "font-medium text-foreground" : "text-label"
                    ) }
                  >
                    {label}
                  </span>
                )}
              </span>

              <span className="flex shrink-0 items-center gap-1">
                {isModified && onReset && (
                  <button
                    type="button"
                    tabIndex={ -1 }
                    title="Reset to saved value"
                    onClick={ onReset }
                    onPointerDown={ ( e ) => e.stopPropagation() }
                    className={ `${ CONTROL_RESET_BUTTON_CLASS } bg-background/70 backdrop-blur-sm` }
                  >
                    <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  </button>
                )}

                <button
                  type="button"
                  title="Tap to type an alpha percentage"
                  onClick={ () => setEditing( true ) }
                  onPointerDown={ ( e ) => e.stopPropagation() }
                  className={ `${ CONTROL_VALUE_BUTTON_CLASS } bg-background/70 backdrop-blur-sm` }
                >
                  {alphaPercent}%
                </button>
              </span>
            </div>
          </SliderPrimitive.Root>
        );
      } }
    />
  );
}
