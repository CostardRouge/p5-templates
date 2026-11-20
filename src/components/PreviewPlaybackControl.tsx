"use client";

import clsx from "clsx";
import {
  type PreviewPlayback,
  usePreviewPlayback
} from "@/hooks/usePreviewPlayback";

const OPTIONS: {
  value: PreviewPlayback;
  label: string;
}[] = [
  {
    value: "inview",
    label: "In view"
  },
  {
    value: "hover",
    label: "On hover"
  },
  {
    value: "off",
    label: "Off"
  }
];

/**
 * The Sketches page's "Previews" setting: when the cards' preview loops play.
 *
 * A screen that can hover gets three states (in view, on hover, off). A touch
 * screen keeps the two-state switch, since "on hover" has nothing to hover
 * there. Disabled until hydration, so it never shows the server's default as
 * if it were the visitor's choice.
 */
export default function PreviewPlaybackControl() {
  const {
    mode, setMode, canHover, hydrated
  } = usePreviewPlayback();

  if ( !canHover ) {
    const enabled = mode === "inview";

    return (
      <label
        className={ clsx(
          "inline-flex items-center gap-2 select-none",
          hydrated ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
        ) }
      >
        <span className="text-xs sm:text-sm text-foreground/70 font-medium">
          Live previews
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={ enabled }
          aria-label="Live previews"
          disabled={ !hydrated }
          onClick={ () => setMode( enabled ? "off" : "inview" ) }
          className={ clsx(
            "relative inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-focus",
            enabled ? "bg-foreground" : "bg-border"
          ) }
        >
          <span
            className={ clsx(
              "inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-background shadow-xs transition-transform duration-200",
              enabled ? "translate-x-[18px] sm:translate-x-[22px]" : "translate-x-0.5"
            ) }
          />
        </button>
      </label>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Previews"
      title="When the sketch previews play"
      className={ clsx(
        "inline-flex shrink-0 gap-0.5 rounded-lg border border-border bg-background p-0.5",
        !hydrated && "opacity-50"
      ) }
    >
      { OPTIONS.map( ( {
        value, label
      } ) => (
        <label
          key={ value }
          className={ clsx(
            "relative",
            hydrated ? "cursor-pointer" : "cursor-not-allowed"
          ) }
        >
          <input
            type="radio"
            name="preview-playback"
            value={ value }
            checked={ hydrated && mode === value }
            disabled={ !hydrated }
            onChange={ () => setMode( value ) }
            className="peer absolute inset-0 m-0 cursor-[inherit] opacity-0"
          />
          <span
            className={ clsx(
              "block whitespace-nowrap rounded-md px-2.5 py-1 text-xs sm:text-sm font-medium transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-focus",
              hydrated && mode === value
                ? "bg-foreground text-background"
                : "text-foreground/70 hover:bg-hover"
            ) }
          >
            { label }
          </span>
        </label>
      ) ) }
    </div>
  );
}
