"use client";

import React from "react";
import rootFormConfig from "./constants/root-field-config";

import GenericObjectForm from "./components/GenericObjectForm/GenericObjectForm";
import PanelSection from "../PanelSection";

type RootSettingsProps = {
  activeSlideIndex?: number;
  expanded?: boolean;
  onToggle?: ( expanded: boolean ) => void;
  /** Horizontal padding of the section, matched to the host panel (the mobile
   *  drawer already pads its own body). */
  paddingClassName?: string;
};

/**
 * "Canvas" section of the inspector: canvas size, duration and framerate.
 * Sits in the same panel as the sketch's own parameters so one surface carries
 * every knob for what is on screen. Edits the root blocks (`format` /
 * `animation`), or the active slide's overrides (`slides.N.*`) when a slide is
 * selected — the same contextual targeting as the sketch form, so the two
 * never disagree about which object is being edited.
 */
export default function RootSettings( {
  activeSlideIndex,
  expanded,
  onToggle,
  paddingClassName
}: RootSettingsProps ) {
  const isSlideContext = activeSlideIndex !== undefined;
  const basePath = isSlideContext ? `slides.${ activeSlideIndex }` : "";

  return (
    <PanelSection
      key={ basePath }
      label="canvas & animation"
      expanded={ expanded ?? true }
      onToggle={ onToggle }
      paddingClassName={ paddingClassName }
    >
      <GenericObjectForm basePath={ basePath } config={ rootFormConfig } />
    </PanelSection>
  );
}
