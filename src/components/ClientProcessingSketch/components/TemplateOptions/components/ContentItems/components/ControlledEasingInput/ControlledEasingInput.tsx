"use client";

import {
  useCallback, useEffect, useState
} from "react";
import {
  ChevronDown, RotateCcw, Spline
} from "lucide-react";
import clsx from "clsx";
import {
  useController, useFormContext
} from "react-hook-form";
import {
  buildEasingKey,
  EASING_DIRECTIONS,
  EASING_FAMILIES,
  parseEasingKey,
  type EasingDirection,
  type EasingFamily
} from "../../constants/easing-options";
import {
  CONTROL_BAR_CLASS,
  CONTROL_CHEVRON_CLASS,
  CONTROL_LABEL_SEGMENT_CLASS,
  CONTROL_RESET_BUTTON_CLASS
} from "../../constants/control-bar";

type Props = {
  name: string;
  label?: string;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

/**
 * One-line easing control sharing the slider bar chrome: an icon + label
 * segment on the left, then the direction and family selects fused together
 * with a separator in the middle. Each visible segment is backed by an
 * invisible native <select> so the platform picker opens on tap.
 */
export default function ControlledEasingInput( {
  name,
  label,
  isModified = false,
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
    ]
  );

  const directionLabel =
    EASING_DIRECTIONS.find( ( d ) => d.value === direction )?.label ?? direction;
  const familyLabel = family.charAt( 0 ).toUpperCase() + family.slice( 1 );

  return (
    <div className={ CONTROL_BAR_CLASS }>
      {label && (
        <span className={ CONTROL_LABEL_SEGMENT_CLASS }>
          <Spline className="h-4 w-4 md:h-3 md:w-3 shrink-0 text-label" />
          <span
            className={ clsx(
              "truncate",
              isModified ? "font-medium text-foreground" : "text-label"
            ) }
          >
            {label}
          </span>
          {isModified && onReset && (
            <button
              type="button"
              tabIndex={ -1 }
              title="Reset to saved value"
              onClick={ onReset }
              className={ `relative z-10 shrink-0 ${ CONTROL_RESET_BUTTON_CLASS }` }
            >
              <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
            </button>
          )}
        </span>
      )}

      {family !== "linear" && (
        <span className="relative flex h-full min-w-0 flex-1 items-center">
          <span className="pointer-events-none flex w-full items-center justify-between gap-1 px-2.5">
            <span className="truncate">{directionLabel}</span>
            <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
          </span>
          <select
            aria-label={ `${ label ?? name } direction` }
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={ direction }
            onChange={ ( e ) => {
              const next = e.target.value as EasingDirection;

              setDirection( next );
              propagate(
                next,
                family
              );
            } }
          >
            {EASING_DIRECTIONS.map( ( d ) => (
              <option key={ d.value } value={ d.value }>
                {d.label}
              </option>
            ) )}
          </select>
        </span>
      )}

      <span
        className={ clsx(
          "relative flex h-full min-w-0 flex-1 items-center",
          family !== "linear" && "border-l border-theme"
        ) }
      >
        <span className="pointer-events-none flex w-full items-center justify-between gap-1 px-2.5">
          <span className="truncate">{familyLabel}</span>
          <ChevronDown className={ CONTROL_CHEVRON_CLASS } />
        </span>
        <select
          aria-label={ `${ label ?? name } function` }
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={ family }
          onChange={ ( e ) => {
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
          } }
        >
          {EASING_FAMILIES.map( ( f ) => (
            <option key={ f } value={ f }>
              {f.charAt( 0 ).toUpperCase() + f.slice( 1 )}
            </option>
          ) )}
        </select>
      </span>
    </div>
  );
}
