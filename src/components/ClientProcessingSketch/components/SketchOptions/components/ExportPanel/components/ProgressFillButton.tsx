"use client";

import React from "react";
import clsx from "clsx";
import {
  useSmoothFill
} from "@/hooks/useSmoothFill";

type ProgressFillButtonProps = {
  label: string;
  percentage: number;
  onClick?: () => void;
  ariaLabel?: string;
  icon?: React.ReactNode;
  className?: string;
};

/**
 * A button that doubles as its own progress bar by tweening a fill span
 * behind its label.
 *
 * One component for every capture in flight. There used to be five
 * near-identical copies of this block in `BrowserRecordingButton` — one per
 * recorder flavour — which is why a change to the fill's easing only ever
 * landed in whichever copy the author happened to be reading.
 */
export default function ProgressFillButton( {
  label,
  percentage,
  onClick,
  ariaLabel,
  icon,
  className
}: ProgressFillButtonProps ) {
  const fillRef = useSmoothFill<HTMLSpanElement>(
    true,
    percentage
  );

  return (
    <button
      type="button"
      onClick={ onClick }
      aria-label={ ariaLabel ?? label }
      className={ clsx(
        "relative inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg border border-red-500/40 bg-background px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/5",
        className
      ) }
    >
      <span
        ref={ fillRef }
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 bg-red-500/20"
        style={ {
          width: "0%"
        } }
      />
      {icon}
      <span className="relative truncate">{label}</span>
    </button>
  );
}
