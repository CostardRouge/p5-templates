"use client";

import {
  useSyncExternalStore
} from "react";
import {
  getPresentationState,
  isFullscreenSupported,
  subscribePresentation
} from "@/lib/presentation/presentationMode";
import type {
  PresentationState
} from "@/lib/presentation/presentationMode";

export type PresentationModeState = PresentationState & {
  /** The browser exposes (and permits) the Fullscreen API. */
  isFullscreenSupported: boolean;
  /** Any axis is on — what the "Exit presentation" affordance keys on. */
  isPresenting: boolean;
};

const serverState: PresentationState = {
  fullscreen: false,
  hideInterface: false,
  stretchCanvas: false
};

/**
 * Subscribe a component to the shared presentation controller. Every flag falls
 * back to off during SSR, so gate any presentation affordance on them rather
 * than rendering it and correcting on hydration.
 */
export default function usePresentationMode(): PresentationModeState {
  const state = useSyncExternalStore(
    subscribePresentation,
    getPresentationState,
    () => serverState
  );
  const fullscreenSupported = useSyncExternalStore(
    subscribePresentation,
    isFullscreenSupported,
    () => false
  );

  return {
    ...state,
    isFullscreenSupported: fullscreenSupported,
    isPresenting: state.fullscreen || state.hideInterface || state.stretchCanvas
  };
}
