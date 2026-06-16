"use client";

import React, {
  useEffect, useState
} from "react";
import ControlledDeviceSelect, {
  type DeviceOption
} from "./ControlledDeviceSelect";

type Props = {
  name: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * Select bound to an audio-input deviceId ("" = browser default microphone).
 * Like the camera picker, device labels are only exposed once a microphone
 * permission has been granted, so the list refreshes on `devicechange` — which
 * also fires after the interaction layer first opens the mic — and falls back
 * to "Microphone N" labels.
 */
export default function ControlledAudioInputDeviceSelect( props: Props ) {
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
            .filter( ( device ) => device.kind === "audioinput" )
            .map( (
              device, index
            ) => ( {
              value: device.deviceId,
              label: device.label || `Microphone ${ index + 1 }`
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

  return (
    <ControlledDeviceSelect
      { ...props }
      devices={ devices }
      defaultLabel="Default"
      ariaLabel="Microphone"
    />
  );
}
