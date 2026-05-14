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
      headerContainerClassName="leading-none"
      header={ ( expanded ) => (
        <button
          className="truncate text-foreground text-xs w-full text-left -ml-1 align-text-top"
          aria-label={ expanded ? "Collapse controls" : "Expand controls" }
        >
          <ListCollapse
            className="inline text-foreground h-3"
            style={ {
              rotate: expanded ? "180deg" : "0deg"
            } }
          />
          {label}
        </button>
      ) }
    >
      <GenericObjectForm basePath={ basePath } config={ rootFormConfig } />
    </CollapsibleItem>
  );
}
