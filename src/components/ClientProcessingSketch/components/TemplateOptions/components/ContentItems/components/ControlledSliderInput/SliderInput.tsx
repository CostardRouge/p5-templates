"use client";

import {
  RotateCcw
} from "lucide-react";
import React, {
  useState
} from "react";
import clsx from "clsx";
import useDragSlider from "@/hooks/useDragSlider";
import {
  CONTROL_BAR_CLASS,
  CONTROL_EDIT_INPUT_CLASS,
  CONTROL_RESET_BUTTON_CLASS,
  CONTROL_VALUE_BUTTON_CLASS
} from "../../constants/control-bar";

type SliderInputProps = {
  value: number;
  onChange: ( next: number ) => void;
  onBlur?: () => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * Presentational, fully-controlled value slider in the style of Blender/Leva:
 * the whole bar is the drag surface, the fill shows the current value, and the
 * label lives inside the bar so the control needs no separate label row.
 * Tapping the value switches the bar to a number input for precise entry.
 *
 * Form-agnostic — pass `value`/`onChange` directly. {@link ControlledSliderInput}
 * wraps this with react-hook-form; anything outside a form (e.g. the UI-sound
 * settings popover) can use it standalone so every slider looks identical.
 *
 * The drag is handled by {@link useDragSlider} with `touch-action: pan-y`, so a
 * horizontal drag adjusts the value while a vertical drag scrolls the panel the
 * bar lives in.
 */
export default function SliderInput( {
  value: rawValue,
  onChange,
  onBlur,
  label,
  min = 0,
  max = 100,
  step = 1,
  isModified = false,
  onReset
}: SliderInputProps ) {
  const [
    editing,
    setEditing
  ] = useState( false );

  const decimals = step < 1 ? 2 : 0;
  const numericValue = Number( rawValue );
  const value = Number.isFinite( numericValue ) ? numericValue : min;

  const {
    ref, handlers
  } = useDragSlider( {
    min,
    max,
    step,
    value,
    onChange
  } );

  const fraction =
    max > min ? clampFraction( ( value - min ) / ( max - min ) ) : 0;

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

    onChange( Math.min(
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
        aria-label={ `${ label ?? "value" } value` }
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
    <div
      ref={ ref }
      role="slider"
      tabIndex={ 0 }
      aria-label={ label }
      aria-valuemin={ min }
      aria-valuemax={ max }
      aria-valuenow={ value }
      onBlur={ onBlur }
      { ...handlers }
      className={ `group touch-pan-y select-none cursor-ew-resize outline-none focus-visible:ring-1 focus-visible:ring-focus ${ CONTROL_BAR_CLASS }` }
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-foreground/10 transition-colors group-hover:bg-foreground/15"
        style={ {
          width: `${ fraction * 100 }%`
        } }
      />

      <div
        className="pointer-events-none absolute top-1/2 h-6 md:h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/30"
        style={ {
          left: `${ fraction * 100 }%`
        } }
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
    </div>
  );
}

function clampFraction( fraction: number ): number {
  return Math.min(
    1,
    Math.max(
      0,
      fraction
    )
  );
}
