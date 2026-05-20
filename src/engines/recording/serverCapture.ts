import type {
  ServerCaptureController
} from "./types";

/**
 * Shared registry for the headless (Playwright) capture controller.
 *
 * Each engine registers a `ServerCaptureController` once it is ready; the
 * server-side recording pipeline reads it from `window.__sketchCapture` and
 * drives every engine through the same protocol (`prepare()` then
 * `renderFrame(i)` per frame, then a canvas read or DOM screenshot).
 *
 * Kept engine-agnostic and DOM-free so it can be imported from both engine
 * implementations without duplicating the window plumbing.
 */
declare global {
  interface Window {
    __sketchCapture?: ServerCaptureController;
  }
}

export function registerServerCaptureController( controller: ServerCaptureController ): void {
  if ( typeof window === "undefined" ) {
    return;
  }

  window.__sketchCapture = controller;
}

export function unregisterServerCaptureController(): void {
  if ( typeof window === "undefined" ) {
    return;
  }

  delete window.__sketchCapture;
}
