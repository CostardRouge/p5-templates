"use client";

import {
  RotateCcw
} from "lucide-react";
import React, {
  useState
} from "react";
import clsx from "clsx";
import {
  useController, useFormContext
} from "react-hook-form";

import useDragSlider from "@/hooks/useDragSlider";
import {
  bindingValueVarName
} from "@/lib/channelBridge";
import LiveBindingValue from "../BindingAffordance/LiveBindingValue";
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
  /**
   * Set while an interaction binding drives the colour: the fill shows the
   * colour the sketch reads this frame, the swatch keeps the base one, and
   * `ramp` (the binding's two stops) runs along the bottom edge.
   */
  live?: {
    target: string;
    ramp: { from: number[];
      to: number[] } | null;
  } | null;
};

const rgbaCss = ( value: number[] ) =>
  `rgba(${ value[ 0 ] ?? 0 }, ${ value[ 1 ] ?? 0 }, ${ value[ 2 ] ?? 0 }, ${ ( value[ 3 ] ?? 255 ) / 255 })`;

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
 *
 * The alpha drag is handled by {@link useDragSlider} with `touch-action: pan-y`,
 * so a horizontal drag adjusts alpha while a vertical drag scrolls the panel.
 */
export default function ControlledColorInput( {
  name,
  label,
  isModified = false,
  onReset,
  live = null
}: ControlledColorInputProps ) {
  const {
    control
  } = useFormContext();

  const {
    field
  } = useController( {
    name,
    control
  } );

  const [
    editing,
    setEditing
  ] = useState( false );

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

  const {
    ref, handlers
  } = useDragSlider( {
    min: 0,
    max: 255,
    step: 1,
    value: a,
    onChange: handleAlphaChange
  } );

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

  // Driven: the fill reads the live colour and its alpha straight from the
  // vars the engine writes every frame, falling back to the base value.
  const baseFill = `rgba(${ r }, ${ g }, ${ b }, ${ a / 255 })`;
  const fillColor = live
    ? `var(${ bindingValueVarName( live.target ) }, ${ baseFill })`
    : baseFill;
  const fillWidth = live
    ? `calc(var(${ bindingValueVarName(
      live.target,
      "a"
    ) }, ${ a / 255 }) * 100%)`
    : `${ ( a / 255 ) * 100 }%`;

  return (
    <div
      ref={ ref }
      role="slider"
      tabIndex={ 0 }
      aria-label={ `${ label ?? name } alpha` }
      aria-valuemin={ 0 }
      aria-valuemax={ 255 }
      aria-valuenow={ a }
      onBlur={ field.onBlur }
      { ...handlers }
      className={ clsx(
        "group touch-pan-y select-none cursor-ew-resize outline-none focus-visible:ring-1 focus-visible:ring-focus",
        CONTROL_BAR_CLASS,
        live && "binding-live-ring"
      ) }
    >
      {/* The checkerboard is its own layer so the bar's background stays free
          for the driven ring. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={ CHECKERBOARD_STYLE }
      />

      <div
        className="pointer-events-none absolute inset-y-0 left-0"
        style={ {
          width: fillWidth,
          backgroundColor: fillColor
        } }
      />

      {live?.ramp && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
          style={ {
            backgroundImage: `linear-gradient(90deg, ${ rgbaCss( live.ramp.from ) }, ${ rgbaCss( live.ramp.to ) })`
          } }
        />
      )}

      <div
        className={ clsx(
          "pointer-events-none absolute top-1/2 h-6 md:h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-background/80",
          live ? "border border-foreground/70 bg-background" : "bg-foreground/60"
        ) }
        style={ {
          left: `${ ( a / 255 ) * 100 }%`
        } }
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 px-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* Swatch: opens the native color picker (opaque so the hue
              stays visible even at alpha 0). Driven, it is the base colour —
              the one being edited — while the fill shows the live one. */}
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

          {live && (
            <LiveBindingValue
              target={ live.target }
              fallback={ hex }
              hex
              className="rounded bg-background/70 px-1 font-mono tabular-nums text-foreground backdrop-blur-sm"
            />
          )}

          <button
            type="button"
            title={ live ? "Base alpha — tap to type a percentage" : "Tap to type an alpha percentage" }
            onClick={ () => setEditing( true ) }
            onPointerDown={ ( e ) => e.stopPropagation() }
            className={ clsx(
              CONTROL_VALUE_BUTTON_CLASS,
              "bg-background/70 backdrop-blur-sm",
              live && "!text-label hover:!text-foreground"
            ) }
          >
            {alphaPercent}%
          </button>
        </span>
      </div>
    </div>
  );
}
