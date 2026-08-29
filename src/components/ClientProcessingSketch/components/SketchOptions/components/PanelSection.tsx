"use client";

import React from "react";
import clsx from "clsx";
import {
  ChevronDown
} from "lucide-react";

import CollapsibleItem from "@/components/CollapsibleItem";

type PanelSectionProps = {
  /** Section name. Rendered as a small uppercase, letter-spaced eyebrow. */
  label: React.ReactNode;
  /** Muted text after the label — a count, a scope, a format. */
  meta?: React.ReactNode;
  /** Icon buttons pinned to the right of the header, before the chevron.
   *  Clicks inside are stopped so they never toggle the section. */
  actions?: React.ReactNode;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
  /** Drop the separator — for the last section of a panel. */
  last?: boolean;
  /** Horizontal padding of the header and body (matches the host panel). */
  paddingClassName?: string;
  children: React.ReactNode;
};

/**
 * One band of a settings panel: a full-bleed header — uppercase eyebrow,
 * optional meta and actions, chevron — over its content, closed by a hairline
 * that runs edge to edge.
 *
 * The rule is what does the structural work here: sections read as stacked
 * bands rather than floating headings, so a long inspector stays scannable
 * without boxing every group in its own card. Nested groups *inside* a section
 * (FieldRenderer's `nested-object`) deliberately use a different, lighter
 * treatment — an indent guide, no full-bleed rule — so depth stays legible.
 */
export default function PanelSection( {
  label,
  meta,
  actions,
  expanded,
  onToggle,
  last = false,
  paddingClassName = "px-3",
  children
}: PanelSectionProps ) {
  return (
    <CollapsibleItem
      expanded={ expanded }
      onToggle={ onToggle }
      className={ clsx( !last && "border-b border-theme" ) }
      header={ ( isExpanded ) => (
        <div
          className={ clsx(
            "flex w-full items-center gap-2 py-2.5 md:py-2 cursor-pointer select-none hover:bg-hover transition-colors",
            paddingClassName
          ) }
        >
          <span className="truncate text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-label">
            {label}
          </span>

          {meta && (
            <span className="truncate text-[0.6875rem] text-label/70">
              {meta}
            </span>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {actions && (
              <span
                className="flex items-center gap-0.5"
                onClick={ ( e ) => e.stopPropagation() }
              >
                {actions}
              </span>
            )}

            <ChevronDown
              className="h-3.5 w-3.5 text-label transition-transform"
              style={ {
                transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)"
              } }
            />
          </span>
        </div>
      ) }
    >
      <div className={ clsx(
        "pb-3 pt-0.5",
        paddingClassName
      ) }
      >
        {children}
      </div>
    </CollapsibleItem>
  );
}
