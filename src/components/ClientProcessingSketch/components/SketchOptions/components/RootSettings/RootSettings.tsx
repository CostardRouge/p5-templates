"use client";

import React from "react";
import {
  ChevronDown, Frame
} from "lucide-react";
import rootFormConfig from "./constants/root-field-config";

import GenericObjectForm from "./components/GenericObjectForm/GenericObjectForm";
import CollapsibleItem from "@/components/CollapsibleItem";

type RootSettingsProps = {
  activeSlideIndex?: number;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
};

/**
 * "Canvas & animation" section of the inspector: canvas size, duration and
 * framerate. Sits above the sketch's own parameters so one panel carries every
 * knob for what is on screen. Edits the root blocks (`format` / `animation`),
 * or the active slide's overrides (`slides.N.*`) when a slide is selected —
 * the same contextual targeting as the sketch form below it, so the two never
 * disagree about which object is being edited.
 */
export default function RootSettings( {
  activeSlideIndex,
  expanded,
  onToggle
}: RootSettingsProps ) {
  const isSlideContext = activeSlideIndex !== undefined;
  const basePath = isSlideContext ? `slides.${ activeSlideIndex }` : "";

  return (
    <CollapsibleItem
      key={ basePath }
      expanded={ expanded ?? true }
      onToggle={ onToggle }
      className="border-b border-theme"
      header={ ( isExpanded ) => (
        <button
          className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-foreground hover:bg-hover transition-colors"
          aria-label={ isExpanded ? "Collapse canvas settings" : "Expand canvas settings" }
        >
          <Frame className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">canvas &amp; animation</span>
          <ChevronDown
            className="ml-auto h-3.5 w-3.5 shrink-0 text-label transition-transform"
            style={ {
              transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)"
            } }
          />
        </button>
      ) }
    >
      <div className="px-3 pb-3">
        <GenericObjectForm basePath={ basePath } config={ rootFormConfig } />
      </div>
    </CollapsibleItem>
  );
}
