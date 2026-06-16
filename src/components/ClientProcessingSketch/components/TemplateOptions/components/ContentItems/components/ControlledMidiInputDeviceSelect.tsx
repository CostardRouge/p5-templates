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
 * Select bound to a Web MIDI input id ("" = listen to every input). The input
 * list comes from `requestMIDIAccess()` (no sysex, so browsers that support it
 * grant it without a prompt) and refreshes on `statechange` as devices are
 * plugged/unplugged. Falls back to just the "All inputs" option when Web MIDI
 * is unsupported or access is denied.
 */
export default function ControlledMidiInputDeviceSelect( props: Props ) {
  const [
    devices,
    setDevices
  ] = useState<DeviceOption[]>( [] );

  useEffect(
    () => {
      if (
        typeof navigator === "undefined" ||
        typeof navigator.requestMIDIAccess !== "function"
      ) {
        return;
      }

      let cancelled = false;
      let access: MIDIAccess | null = null;

      const refresh = () => {
        if ( !access || cancelled ) {
          return;
        }

        const inputs: DeviceOption[] = [];

        access.inputs.forEach( ( input ) => {
          inputs.push( {
            value: input.id,
            label: input.name || `MIDI input ${ inputs.length + 1 }`
          } );
        } );
        setDevices( inputs );
      };

      navigator.requestMIDIAccess()
        .then( ( midiAccess ) => {
          if ( cancelled ) {
            return;
          }

          access = midiAccess;
          access.onstatechange = refresh;
          refresh();
        } )
        .catch( () => {
          // MIDI permission denied / unavailable — keep only "All inputs".
        } );

      return () => {
        cancelled = true;

        if ( access ) {
          access.onstatechange = null;
        }
      };
    },
    []
  );

  return (
    <ControlledDeviceSelect
      { ...props }
      devices={ devices }
      defaultLabel="All inputs"
      ariaLabel="MIDI input"
      formatUnavailable={ () => "Unavailable input" }
    />
  );
}
