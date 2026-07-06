"use client";

import {
  useSyncExternalStore
} from "react";
import {
  getFullscreenMode,
  isFullscreenSupported,
  isViewportFullscreen,
  subscribeFullscreen
} from "@/lib/fullscreen/fullscreenViewport";
import type {
  FullscreenMode
} from "@/lib/fullscreen/constants";

export type FullscreenViewportState = {
  /** The viewport is currently the active fullscreen element. */
  isFullscreen: boolean;
  /** The active fullscreen mode, or `null` when not fullscreen. */
  mode: FullscreenMode | null;
  /** The browser exposes (and permits) the element-fullscreen API. */
  isSupported: boolean;
};

/**
 * Subscribe a component to the shared viewport fullscreen controller. The flags
 * fall back to not-fullscreen / unsupported during SSR, so gate any fullscreen
 * affordance on them.
 */
export default function useFullscreenViewport(): FullscreenViewportState {
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    isViewportFullscreen,
    () => false
  );
  const mode = useSyncExternalStore(
    subscribeFullscreen,
    getFullscreenMode,
    () => null
  );
  const isSupported = useSyncExternalStore(
    subscribeFullscreen,
    isFullscreenSupported,
    () => false
  );

  return {
    isFullscreen,
    mode,
    isSupported
  };
}
