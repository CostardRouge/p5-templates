"use client";

import React from "react";
import {
  createPortal
} from "react-dom";
import {
  WEBGL_UNAVAILABLE
} from "@/p5/utils/glContext.js";

// The p5 runtime raises an error of that name when the browser refuses a
// WebGL context, and words its message for the person in front of the page;
// any other engine error is a developer's, and gets a generic line here with
// the detail in the console.
export function describeEngineFailure( error: Error ): string {
  return error.name === WEBGL_UNAVAILABLE
    ? error.message
    : "This sketch could not start. The browser console has the details.";
}

/**
 * What the page shows instead of an empty canvas when its engine reports an
 * unrecoverable error.
 *
 * Portalled to the body: the engine's container lives inside the zoomable
 * viewport, whose transform would scale the text with the canvas and make
 * `position: fixed` relative to it.
 */
export default function SketchFailureNotice( {
  error
}: {
  error: Error | null;
} ) {
  if ( !error || typeof document === "undefined" ) {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
      <p
        role="alert"
        data-sketch-failure=""
        className="pointer-events-auto m-0 max-w-sm rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg"
      >
        {describeEngineFailure( error )}
      </p>
    </div>,
    document.body
  );
}
