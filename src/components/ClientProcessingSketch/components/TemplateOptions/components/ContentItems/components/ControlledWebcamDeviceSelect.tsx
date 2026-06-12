"use client";

import React, {
  useEffect, useState
} from "react";
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

type Props = {
  name: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

type DeviceOption = {
  deviceId: string;
  label: string;
};

/**
 * Select bound to a webcam deviceId ("" = browser default). Device labels are
 * only exposed by the browser once a camera permission has been granted, so
 * the list refreshes on `devicechange` — which also fires after the vision
 * layer first opens the webcam — and falls back to "Camera N" labels.
 */
export default function ControlledWebcamDeviceSelect( {
  name,
  label,
  isModified,
  onReset
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

  const [
    devices,
    setDevices
  ] = useState<DeviceOption[]>( [] );

  useEffect(
    () => {
      const media = navigator.mediaDevices;

      if ( !media?.enumerateDevices ) {
        return;
      }

      let cancelled = false;

      async function refresh() {
        try {
          const all = await media.enumerateDevices();

          if ( cancelled ) {
            return;
          }

          setDevices( all
            .filter( ( device ) => device.kind === "videoinput" )
            .map( (
              device, index
            ) => ( {
              deviceId: device.deviceId,
              label: device.label || `Camera ${ index + 1 }`
            } ) ) );
        } catch {
          // Enumeration unavailable (permissions, insecure context…): keep
          // whatever list we had — the "Default" option always works.
        }
      }

      refresh();
      media.addEventListener?.(
        "devicechange",
        refresh
      );

      return () => {
        cancelled = true;
        media.removeEventListener?.(
          "devicechange",
          refresh
        );
      };
    },
    []
  );

  const currentValue = typeof field.value === "string" ? field.value : "";
  const matched = devices.find( ( device ) => device.deviceId === currentValue );
  // A saved deviceId may belong to an unplugged camera: keep it selectable so
  // saving the form doesn't silently drop it.
  const displayLabel = matched?.label ??
    ( currentValue ? `Unavailable (${ currentValue.slice(
      0,
      8
    ) }…)` : "Default" );

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
        aria-label={ label ?? "Camera" }
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        value={ currentValue }
        onChange={ ( e ) => field.onChange( e.target.value ) }
        onBlur={ field.onBlur }
      >
        <option value="">Default</option>

        {currentValue && !matched && (
          <option value={ currentValue } hidden>
            {displayLabel}
          </option>
        )}

        {devices.map( ( device ) => (
          <option key={ device.deviceId } value={ device.deviceId }>
            {device.label}
          </option>
        ) )}
      </select>
    </div>
  );
}
