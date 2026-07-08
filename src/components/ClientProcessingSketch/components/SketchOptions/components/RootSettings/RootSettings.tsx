"use client";

import React from "react";
import rootFormConfig from "./constants/root-field-config";

import GenericObjectForm from "./components/GenericObjectForm/GenericObjectForm";
import {
  ListCollapse
} from "lucide-react";
import CollapsibleItem from "@/components/CollapsibleItem";

type RootSettingsProps = {
  activeSlideIndex?: number;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
};

export default function RootSettings( {
  activeSlideIndex,
  expanded,
  onToggle
}: RootSettingsProps ) {
  const isSlideContext = activeSlideIndex !== undefined;
  const basePath = isSlideContext ? `slides.${ activeSlideIndex }` : "";
  const label = isSlideContext
    ? `slide ${ activeSlideIndex + 1 } settings`
    : "general settings";

  return (
    <CollapsibleItem
      key={ basePath }
      expanded={ expanded ?? isSlideContext }
      onToggle={ onToggle }
      className={ `p-1 border rounded-lg text-foreground bg-background overflow-y-auto ${
        isSlideContext
          ? "border-blue-400/60 ring-1 ring-blue-400/30"
          : "border-theme"
      }` }
      header={ ( expanded ) => (
        <button
          className="flex w-full items-center gap-1.5 text-left text-foreground text-xs min-h-[2.5rem] md:min-h-0"
          aria-label={ expanded ? "Collapse controls" : "Expand controls" }
        >
          <ListCollapse
            className="shrink-0 text-foreground h-4 w-4 md:h-3 md:w-3"
            style={ {
              rotate: expanded ? "180deg" : "0deg"
            } }
          />
          <span className="truncate">{label}</span>
        </button>
      ) }
    >
      <GenericObjectForm basePath={ basePath } config={ rootFormConfig } />
    </CollapsibleItem>
  );
}
