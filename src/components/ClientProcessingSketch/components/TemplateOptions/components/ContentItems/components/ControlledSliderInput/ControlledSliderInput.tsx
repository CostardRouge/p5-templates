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
  useController
} from "react-hook-form";

type ControlledSliderInputProps = {
  name: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * Touch-friendly replacement for the native range input, in the style of
 * Blender/Leva value sliders: the whole bar is the drag surface, the fill
 * shows the current value, and the label lives inside the bar so the control
 * doesn't need its own label row. Tapping the value switches the bar to a
 * number input for precise entry.
 */
export default function ControlledSliderInput( {
  name,
  label,
  min = 0,
  max = 100,
  step = 1,
  isModified = false,
  onReset
}: ControlledSliderInputProps ) {
  const {
    field
  } = useController( {
    name
  } );

  const [
    editing,
    setEditing
  ] = useState( false );

  const decimals = step < 1 ? 2 : 0;
  const numericValue = Number( field.value );
  const value = Number.isFinite( numericValue ) ? numericValue : min;

  const commitEdit = ( raw: string ) => {
    setEditing( false );

    const parsed = decimals > 0
      ? parseFloat( raw )
      : parseInt(
        raw,
        10
      );

    if ( Number.isNaN( parsed ) ) {
      return;
    }

    field.onChange( Math.min(
      max,
      Math.max(
        min,
        parsed
      )
    ) );
  };

  if ( editing ) {
    return (
      <input
        type="number"
        autoFocus
        defaultValue={ value.toFixed( decimals ) }
        step={ step }
        min={ min }
        max={ max }
        inputMode={ decimals > 0 ? "decimal" : "numeric" }
        aria-label={ `${ label ?? name } value` }
        className="w-full h-10 md:h-7 px-2.5 border border-theme rounded-lg bg-background text-foreground text-center font-mono text-base md:text-xs focus:outline-none focus:ring-1 focus:ring-focus"
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
      min={ min }
      max={ max }
      step={ step }
      value={ [
        value
      ] }
      onValueChange={ ( [
        next
      ] ) => field.onChange( next ) }
      onBlur={ field.onBlur }
      className="group relative flex h-10 md:h-7 w-full touch-none select-none items-center overflow-hidden rounded-lg border border-theme bg-background cursor-ew-resize"
    >
      <SliderPrimitive.Track className="relative h-full w-full grow">
        <SliderPrimitive.Range className="absolute h-full bg-foreground/10 transition-colors group-hover:bg-foreground/15" />
      </SliderPrimitive.Track>

      <SliderPrimitive.Thumb
        aria-label={ label ?? name }
        className="block h-6 md:h-4 w-1 rounded-full bg-foreground/30 focus-visible:outline-none focus-visible:bg-foreground"
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-2.5">
        <span
          className={ clsx(
            "truncate",
            isModified ? "font-medium text-foreground" : "text-label"
          ) }
        >
          {label}
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {isModified && onReset && (
            <button
              type="button"
              tabIndex={ -1 }
              title="Reset to saved value"
              onClick={ onReset }
              onPointerDown={ ( e ) => e.stopPropagation() }
              className="pointer-events-auto p-1.5 md:p-0.5 rounded-md text-label hover:text-foreground hover:bg-hover transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
            </button>
          )}

          <button
            type="button"
            title="Tap to type a value"
            onClick={ () => setEditing( true ) }
            onPointerDown={ ( e ) => e.stopPropagation() }
            className="pointer-events-auto px-1.5 py-1 md:py-0.5 rounded-md font-mono tabular-nums text-foreground/80 hover:text-foreground hover:bg-hover transition-colors"
          >
            {value.toFixed( decimals )}
          </button>
        </span>
      </div>
    </SliderPrimitive.Root>
  );
}
