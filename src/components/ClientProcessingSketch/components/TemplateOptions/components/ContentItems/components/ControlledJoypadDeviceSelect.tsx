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
 * Select bound to a gamepad id ("" = any connected gamepad). Browsers expose a
 * gamepad's id (a vendor/product string) only after it is connected and, on
 * some platforms, after its first input — so the list is rebuilt on the
 * `gamepadconnected` / `gamepaddisconnected` window events. Identical
 * controllers share an id; the list de-duplicates by id so the dropdown stays
 * clean, and the interaction layer matches every gamepad with that id.
 */
export default function ControlledJoypadDeviceSelect( props: Props ) {
  const [
    devices,
    setDevices
  ] = useState<DeviceOption[]>( [] );

  useEffect(
    () => {
      if (
        typeof navigator === "undefined" ||
        typeof navigator.getGamepads !== "function"
      ) {
        return;
      }

      let cancelled = false;

      const refresh = () => {
        if ( cancelled ) {
          return;
        }

        const seen = new Set<string>();
        const list: DeviceOption[] = [];

        for ( const gamepad of navigator.getGamepads() ) {
          if ( !gamepad || !gamepad.id || seen.has( gamepad.id ) ) {
            continue;
          }

          seen.add( gamepad.id );
          list.push( {
            value: gamepad.id,
            label: gamepad.id
          } );
        }

        setDevices( list );
      };

      refresh();
      window.addEventListener(
        "gamepadconnected",
        refresh
      );
      window.addEventListener(
        "gamepaddisconnected",
        refresh
      );

      return () => {
        cancelled = true;
        window.removeEventListener(
          "gamepadconnected",
          refresh
        );
        window.removeEventListener(
          "gamepaddisconnected",
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
      defaultLabel="Any"
      ariaLabel="Gamepad"
      formatUnavailable={ ( value ) => value }
    />
  );
}
