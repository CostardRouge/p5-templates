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
  bindingValueVarName
} from "@/lib/channelBridge";
import LiveBindingValue from "../BindingAffordance/LiveBindingValue";
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
  /**
   * Set while an interaction binding drives the field: the bar then shows the
   * value the sketch reads this frame instead of the one being edited. `target`
   * keys the live value on the channel bridge; `range` is the span the
   * modulation sweeps, drawn along the bar's bottom edge.
   */
  live?: {
    target: string;
    range: { min: number;
      max: number } | null;
  } | null;
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
  onReset,
  live = null
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

  // Driven: the fill follows the live value in pure CSS — the engine writes
  // the number to a var every frame, the bar maps it through its own min/max
  // (which the engine does not know), and the base value stays as a hollow
  // thumb. Without a live var yet, the fill falls back to the base value.
  const span = max - min;
  const liveFill = live && span > 0
    ? `clamp(0%, calc((var(${ bindingValueVarName( live.target ) }, ${ value }) - ${ min }) / ${ span } * 100%), 100%)`
    : null;
  const band = live?.range && span > 0
    ? {
      left: clampFraction( ( live.range.min - min ) / span ),
      right: clampFraction( ( live.range.max - min ) / span )
    }
    : null;

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
      className={ clsx(
        "group touch-pan-y select-none cursor-ew-resize outline-none focus-visible:ring-1 focus-visible:ring-focus",
        CONTROL_BAR_CLASS,
        liveFill && "binding-live-ring"
      ) }
    >
      {liveFill ? (
        <div
          className="binding-iridescent pointer-events-none absolute inset-0 opacity-60"
          style={ {
            clipPath: `inset(0 calc(100% - ${ liveFill }) 0 0)`
          } }
        />
      ) : (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-foreground/10 transition-colors group-hover:bg-foreground/15"
          style={ {
            width: `${ fraction * 100 }%`
          } }
        />
      )}

      {band && (
        <div
          className="pointer-events-none absolute bottom-0 h-0.5 bg-foreground/50"
          style={ {
            left: `${ band.left * 100 }%`,
            width: `${ Math.max(
              0,
              band.right - band.left
            ) * 100 }%`
          } }
        />
      )}

      <div
        className={ clsx(
          "pointer-events-none absolute top-1/2 h-6 md:h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
          liveFill
            ? "border border-foreground/70 bg-background"
            : "bg-foreground/30"
        ) }
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

          {liveFill && live && (
            <>
              <LiveBindingValue
                target={ live.target }
                fallback={ value.toFixed( decimals ) }
                decimals={ decimals }
                className="font-mono tabular-nums text-foreground"
              />
              <span aria-hidden className="text-label">·</span>
            </>
          )}

          <button
            type="button"
            title={ liveFill ? "Base value — tap to type one" : "Tap to type a value" }
            onClick={ () => setEditing( true ) }
            onPointerDown={ ( e ) => e.stopPropagation() }
            className={ clsx(
              CONTROL_VALUE_BUTTON_CLASS,
              liveFill && "!text-label hover:!text-foreground"
            ) }
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
