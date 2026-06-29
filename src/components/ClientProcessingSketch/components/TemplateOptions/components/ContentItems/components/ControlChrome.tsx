import React from "react";
import {
  RotateCcw
} from "lucide-react";
import clsx from "clsx";
import {
  CONTROL_CARD_HEADER_CLASS,
  CONTROL_LABEL_SEGMENT_CLASS,
  CONTROL_RESET_BUTTON_CLASS
} from "../constants/control-bar";

type ControlLabelProps = {
  label?: string;
  icon?: React.ReactNode;
  isModified?: boolean;
  onReset?: ( event: React.MouseEvent ) => void;
};

function ResetButton( {
  onReset,
  className
}: {
  onReset: ( event: React.MouseEvent ) => void;
  className?: string;
} ) {
  return (
    <button
      type="button"
      tabIndex={ -1 }
      title="Reset to saved value"
      onClick={ onReset }
      className={ clsx(
        "shrink-0",
        CONTROL_RESET_BUTTON_CLASS,
        className
      ) }
    >
      <RotateCcw className="h-3.5 w-3.5 md:h-3 md:w-3" />
    </button>
  );
}

/**
 * Left-hand label segment of a one-line control bar (select, number, text,
 * easing…). The reset affordance is raised above any invisible native input
 * overlaying the bar.
 */
export function BarLabelSegment( {
  label,
  icon,
  isModified = false,
  onReset
}: ControlLabelProps ) {
  if ( !label ) {
    return null;
  }

  return (
    <span className={ CONTROL_LABEL_SEGMENT_CLASS }>
      {icon}
      <span
        className={ clsx(
          "truncate",
          isModified ? "font-medium text-foreground" : "text-label"
        ) }
      >
        {label}
      </span>
      {isModified && onReset && (
        <ResetButton onReset={ onReset } className="relative z-10" />
      )}
    </span>
  );
}

/**
 * Header strip of a multi-line control card (textarea, json, multi-select),
 * mirroring the bar label segment.
 */
export function CardLabelHeader( {
  label,
  icon,
  isModified = false,
  onReset
}: ControlLabelProps ) {
  if ( !label ) {
    return null;
  }

  return (
    <div className={ CONTROL_CARD_HEADER_CLASS }>
      <span className="flex min-w-0 items-center gap-1">
        {icon}
        <span
          className={ clsx(
            "truncate",
            isModified ? "font-medium text-foreground" : "text-label"
          ) }
        >
          {label}
        </span>
      </span>
      {isModified && onReset && <ResetButton onReset={ onReset } />}
    </div>
  );
}

/**
 * Mobile-friendly toggle switch shared by every boolean control (the form's
 * `checkbox` fields and the binding popover's enable/invert toggles). The
 * visually-hidden checkbox keeps native semantics; the two sibling spans render
 * the track and the sliding knob via `peer-checked`. Pass `inputProps` straight
 * from `register()` (RHF) or as controlled `{ checked, onChange }` — anything
 * but `className`, which the component owns.
 */
export function ToggleSwitch( {
  inputProps,
  className
}: {
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  className?: string;
} ) {
  return (
    <span
      className={ clsx(
        "relative inline-flex shrink-0 items-center",
        className
      ) }
    >
      <input
        type="checkbox"
        { ...inputProps }
        className="peer sr-only"
      />
      <span className="h-6 w-10 md:h-5 md:w-9 rounded-full border border-theme bg-foreground/10 transition-colors peer-checked:bg-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus/50" />
      <span className="pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 md:h-4 md:w-4 -translate-y-1/2 rounded-full border border-theme bg-background shadow transition-transform peer-checked:translate-x-4" />
    </span>
  );
}
