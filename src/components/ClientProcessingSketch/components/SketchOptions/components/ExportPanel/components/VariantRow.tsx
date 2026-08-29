"use client";

import React from "react";
import clsx from "clsx";
import {
  Copy, Trash2
} from "lucide-react";
import {
  formatBytes
} from "@/lib/export/download";
import type {
  ExportItemState
} from "@/lib/export/runExportBatch";
import {
  variantExtension, type ExportVariant
} from "@/lib/export/variants";
import {
  useSmoothFill
} from "@/hooks/useSmoothFill";

type VariantRowProps = {
  variant: ExportVariant;
  size: {
    width: number;
    height: number;
  };
  framerate: number;
  slideCount: number;
  selected: boolean;
  state?: ExportItemState;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  removable: boolean;
};

/** "1080×1920 · mp4 · 30fps · 7 slides" — everything the row promises. */
function specLine(
  variant: ExportVariant,
  size: {
    width: number;
    height: number;
  },
  framerate: number,
  slideCount: number
): string {
  const parts = [
    `${ size.width }×${ size.height }`
  ];

  if ( variant.kind === "video" ) {
    parts.push(
      variant.format,
      `${ framerate }fps`
    );
  } else if ( variant.kind === "frames" ) {
    parts.push( `${ variant.frameCount === "all" ? "all" : variant.frameCount } × png` );
  } else {
    parts.push( variantExtension( variant ) );
  }

  if ( slideCount > 1 ) {
    parts.push( `${ slideCount } slides` );
  }

  return parts.join( " · " );
}

/**
 * One entry in the variant list.
 *
 * The row carries its own run state rather than deferring to a global bar:
 * with several variants in flight, "62%" means nothing unless it says which
 * variant, and on which slide.
 */
export default function VariantRow( {
  variant,
  size,
  framerate,
  slideCount,
  selected,
  state,
  onSelect,
  onDuplicate,
  onRemove,
  removable
}: VariantRowProps ) {
  const running = state?.status === "running";
  const fillRef = useSmoothFill<HTMLSpanElement>(
    running,
    state?.percentage ?? 0
  );

  return (
    <div
      role="button"
      tabIndex={ 0 }
      onClick={ onSelect }
      onKeyDown={ ( event ) => {
        if ( event.key === "Enter" || event.key === " " ) {
          event.preventDefault();
          onSelect();
        }
      } }
      className={ clsx(
        "group relative cursor-pointer overflow-hidden border-b border-theme px-3 py-2 transition-colors",
        selected ? "bg-foreground/5" : "hover:bg-hover"
      ) }
    >
      {running && (
        <span
          ref={ fillRef }
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 bg-red-500/10"
          style={ {
            width: "0%"
          } }
        />
      )}

      <div className="relative flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {variant.name}
        </span>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label={ `Duplicate ${ variant.name }` }
            onClick={ ( event ) => {
              event.stopPropagation();
              onDuplicate();
            } }
            className="rounded-md p-1 text-label transition-colors hover:bg-hover hover:text-foreground"
          >
            <Copy className="h-3 w-3" />
          </button>

          {removable && (
            <button
              type="button"
              aria-label={ `Remove ${ variant.name }` }
              onClick={ ( event ) => {
                event.stopPropagation();
                onRemove();
              } }
              className="rounded-md p-1 text-label transition-colors hover:bg-hover hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="relative mt-0.5 truncate font-mono text-[10px] text-label">
        {specLine(
          variant,
          size,
          framerate,
          slideCount
        )}
      </div>

      {state && state.status !== "queued" && (
        <div
          className={ clsx(
            "relative mt-1 flex items-center gap-1.5 text-[10px]",
            state.status === "failed" && "text-red-500",
            state.status === "done" && "text-green-500",
            state.status === "running" && "text-foreground/70",
            state.status === "cancelled" && "text-label"
          ) }
        >
          <span className="truncate">
            {state.status === "done" && "✓ "}
            {state.status === "failed" && "✗ "}
            {state.error ?? state.stage}
          </span>

          {state.status === "done" && state.bytes !== undefined && (
            <span className="ml-auto shrink-0 font-mono">
              {formatBytes( state.bytes )}
            </span>
          )}

          {state.status === "running" &&
            state.slideCount !== undefined &&
            state.slideCount > 1 &&
            state.slide !== undefined && (
            <span className="ml-auto shrink-0">
              slide {state.slide} of {state.slideCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
