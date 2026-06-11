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
