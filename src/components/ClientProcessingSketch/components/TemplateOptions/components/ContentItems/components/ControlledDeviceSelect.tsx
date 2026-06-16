"use client";

import React from "react";
import {
  ChevronDown
} from "lucide-react";
import {
  useController, useFormContext
} from "react-hook-form";
import {
  CONTROL_BAR_CLASS,
  CONTROL_CHEVRON_CLASS
} from "../constants/control-bar";
import {
  BarLabelSegment
} from "./ControlChrome";

export type DeviceOption = {
  value: string;
  label: string;
};

type Props = {
  name: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
  /** Devices to list. The empty value ("") is always offered first. */
  devices: DeviceOption[];
  /** Label for the empty value ("") — e.g. "Default", "All inputs", "Any". */
  defaultLabel: string;
  /** Fallback aria-label when no `label` is provided. */
  ariaLabel: string;
  /**
   * How to render a saved value that is not in the current device list (an
   * unplugged device). Defaults to a truncated id, matching the camera picker.
   */
  formatUnavailable?: ( value: string ) => string;
};

/**
 * Presentational select bound to a device id string, sharing the slider-bar
 * chrome (label segment + value + chevron, native <select> overlaid invisibly).
 * The enumeration of devices lives in the per-kind wrappers (audio input, MIDI
 * input, gamepad); this component only renders the list and binds the value.
 *
 * A saved id that is no longer present stays selectable so saving the form
 * never silently drops a device the user picked while it was plugged in.
 */
export default function ControlledDeviceSelect( {
  name,
  label,
  isModified,
  onReset,
  devices,
  defaultLabel,
  ariaLabel,
  formatUnavailable
}: Props ) {
  const {
    control
  } = useFormContext();
  const {
    field
  } = useController( {
    name,
    control
  } );

  const currentValue = typeof field.value === "string" ? field.value : "";
  const matched = devices.find( ( device ) => device.value === currentValue );
  const displayLabel = matched?.label ??
    ( currentValue
      ? formatUnavailable?.( currentValue ) ?? `Unavailable (${ currentValue.slice(
        0,
        8
      ) }…)`
      : defaultLabel );

  return (
    <div className={ CONTROL_BAR_CLASS }>
      <BarLabelSegment
        label={ label }
        isModified={ isModified }
        onReset={ onReset }
      />

      <span className="pointer-events-none flex min-w-0 flex-1 items-center justify-between gap-1 px-2.5">
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
      </span>

      <select
        id={ name }
        aria-label={ label ?? ariaLabel }
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={ currentValue }
        onChange={ ( e ) => field.onChange( e.target.value ) }
        onBlur={ field.onBlur }
      >
        <option value="">{defaultLabel}</option>

        {currentValue && !matched && (
          <option value={ currentValue } hidden>
            {displayLabel}
          </option>
        )}

        {devices.map( ( device ) => (
          <option key={ device.value } value={ device.value }>
            {device.label}
          </option>
        ) )}
      </select>
    </div>
  );
}
