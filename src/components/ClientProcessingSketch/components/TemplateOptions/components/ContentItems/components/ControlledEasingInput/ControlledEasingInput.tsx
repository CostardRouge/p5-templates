"use client";

import {
  useCallback, useEffect, useState
} from "react";
import {
  useController, useFormContext
} from "react-hook-form";
import {
  buildEasingKey,
  EASING_DIRECTIONS,
  EASING_FAMILIES,
  parseEasingKey,
  type EasingDirection,
  type EasingFamily,
} from "../../constants/easing-options";

type Props = {
  name: string;
};

export default function ControlledEasingInput( {
  name
}: Props ) {
  const {
    control
  } = useFormContext();

  const {
    field,
  } = useController( {
    name,
    control
  } );

  const parsed = parseEasingKey( field.value as string );
  const [
    family,
    setFamily
  ] = useState<EasingFamily>( parsed.family );
  const [
    direction,
    setDirection
  ] = useState<EasingDirection>( parsed.direction );

  // Sync local state when external value changes (e.g. form reset)
  useEffect(
    () => {
      const next = parseEasingKey( field.value as string );

      setFamily( next.family );
      setDirection( next.direction );
    },
    [
      field.value
    ]
  );

  const propagate = useCallback(
    (
      nextDirection: EasingDirection, nextFamily: EasingFamily
    ) => {
      field.onChange( buildEasingKey(
        nextDirection,
        nextFamily
      ) );
    },
    [
      field
    ],
  );

  const selectClassName =
    "w-full p-1 border border-theme rounded-lg bg-background text-foreground";

  return (
    <div className="flex items-center gap-2">
      {family !== "linear" && (
        <select
          className={selectClassName}
          value={direction}
          onChange={( e ) => {
            const next = e.target.value as EasingDirection;

            setDirection( next );
            propagate(
              next,
              family
            );
          }}
        >
          {EASING_DIRECTIONS.map( ( d ) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ) )}
        </select>
      )}

      <select
        className={selectClassName}
        value={family}
        onChange={( e ) => {
          const next = e.target.value as EasingFamily;

          setFamily( next );

          if ( next === "linear" ) {
            propagate(
              "In",
              next
            );
          } else {
            propagate(
              direction,
              next
            );
          }
        }}
      >
        {EASING_FAMILIES.map( ( f ) => (
          <option key={f} value={f}>
            {f.charAt( 0 ).toUpperCase() + f.slice( 1 )}
          </option>
        ) )}
      </select>
    </div>
  );
}
