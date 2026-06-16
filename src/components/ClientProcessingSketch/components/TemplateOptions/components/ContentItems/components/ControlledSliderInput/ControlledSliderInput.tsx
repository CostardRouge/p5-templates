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
import usePreventTouchScroll from "@/hooks/usePreventTouchScroll";
import {
  CONTROL_BAR_CLASS,
  CONTROL_EDIT_INPUT_CLASS,
  CONTROL_RESET_BUTTON_CLASS,
  CONTROL_VALUE_BUTTON_CLASS
} from "../../constants/control-bar";

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

  const sliderRef = usePreventTouchScroll<HTMLSpanElement>();

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
      ref={ sliderRef }
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
      className={ `group touch-none select-none cursor-ew-resize ${ CONTROL_BAR_CLASS }` }
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
              className={ CONTROL_RESET_BUTTON_CLASS }
            >
              <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
            </button>
          )}

          <button
            type="button"
            title="Tap to type a value"
            onClick={ () => setEditing( true ) }
            onPointerDown={ ( e ) => e.stopPropagation() }
            className={ CONTROL_VALUE_BUTTON_CLASS }
          >
            {value.toFixed( decimals )}
          </button>
        </span>
      </div>
    </SliderPrimitive.Root>
  );
}
