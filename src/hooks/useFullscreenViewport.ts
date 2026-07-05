"use client";

import {
  useSyncExternalStore
} from "react";
import {
  isFullscreenSupported,
  isViewportFullscreen,
  subscribeFullscreen
} from "@/lib/fullscreen/fullscreenViewport";

export type FullscreenViewportState = {
  /** The viewport is currently the active fullscreen element. */
  isFullscreen: boolean;
  /** The browser exposes (and permits) the element-fullscreen API. */
  isSupported: boolean;
};

/**
 * Subscribe a component to the shared viewport fullscreen controller. Both flags
 * fall back to `false` during SSR, so gate any fullscreen affordance on them.
 */
export default function useFullscreenViewport(): FullscreenViewportState {
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    isViewportFullscreen,
    () => false
  );
  const isSupported = useSyncExternalStore(
    subscribeFullscreen,
    isFullscreenSupported,
    () => false
  );

  return {
    isFullscreen,
    isSupported
  };
}
