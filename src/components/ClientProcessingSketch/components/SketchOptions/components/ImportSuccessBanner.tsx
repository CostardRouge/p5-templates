"use client";

import React, {
  useEffect, useState
} from "react";
import {
  AlertCircle, CheckCircle, X
} from "lucide-react";

export type ImportBannerState = {
  message: string;
  tone: "success" | "error";
};

type ImportSuccessBannerProps = {
  message: string;
  // "error" (an import that was refused) stays until dismissed and is
  // announced assertively; it is drawn in ink, not red — the studio keeps red
  // for recording-in-progress (docs/memory/studio-ui.md).
  tone?: ImportBannerState[ "tone" ];
  duration?: number;
  onDismiss: () => void;
};

export default function ImportSuccessBanner( {
  message,
  tone = "success",
  duration = 3000,
  onDismiss
}: ImportSuccessBannerProps ) {
  const [
    isVisible,
    setIsVisible
  ] = useState( false );

  useEffect(
    () => {
      setIsVisible( true );

      if ( tone === "error" ) {
        return;
      }

      const timer = setTimeout(
        () => {
          setIsVisible( false );
          setTimeout(
            onDismiss,
            300
          ); // Wait for fade out animation
        },
        duration
      );

      return () => clearTimeout( timer );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      duration,
      tone
    ]
  );

  if ( tone === "error" ) {
    return (
      <div
        role="alert"
        className={ `flex items-start gap-2 px-2 py-2 border border-foreground/40 bg-background/80 backdrop-blur-xl rounded-xl shadow-lg transition-all duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }` }
      >
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-foreground" />
        <span className="flex-1 text-xs font-semibold leading-tight text-foreground">
          {message}
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={ onDismiss }
          className="flex-shrink-0 text-label hover:text-foreground focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground rounded"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={ `flex items-start gap-2 px-2 py-2 border border-green-500/40 bg-green-500/10 backdrop-blur-xl rounded-xl shadow-lg transition-all duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }` }
    >
      <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-500" />
      <span className="text-xs font-semibold leading-tight text-foreground">
        {message}
      </span>
    </div>
  );
}
