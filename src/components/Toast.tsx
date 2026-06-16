"use client";

import React, {
  useEffect, useState
} from "react";
import {
  AlertTriangle, CheckCircle, Info, X, XCircle
} from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

type ToastProps = {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
};

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle
};

// Each toast type carries the same modern, frosted-glass treatment as the
// recording-lock banner — a faint accent tint behind the glass, an accent
// border and a matching icon. Full class literals so Tailwind keeps them.
const accentMap: Record<ToastType, {
  icon: string;
  border: string;
  tint: string;
}> = {
  success: {
    icon: "text-green-500",
    border: "border-green-500/40",
    tint: "bg-green-500/10"
  },
  error: {
    icon: "text-red-500",
    border: "border-red-500/40",
    tint: "bg-red-500/10"
  },
  info: {
    icon: "text-blue-500",
    border: "border-blue-500/40",
    tint: "bg-blue-500/10"
  },
  warning: {
    icon: "text-amber-500",
    border: "border-amber-500/40",
    tint: "bg-amber-500/10"
  }
};

export default function Toast( {
  message,
  type = "info",
  duration = 3000,
  onClose
}: ToastProps ) {
  const [
    isVisible,
    setIsVisible
  ] = useState( false );

  useEffect(
    () => {
    // Trigger animation
      setIsVisible( true );

      const timer = setTimeout(
        () => {
          setIsVisible( false );
          setTimeout(
            onClose,
            300
          ); // Wait for fade out animation
        },
        duration
      );

      return () => clearTimeout( timer );
    },
    [
      duration,
      onClose
    ]
  );

  const Icon = iconMap[ type ];
  const accent = accentMap[ type ];

  return (
    <div
      className={ `fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 max-w-[calc(100vw-1rem)] sm:max-w-none ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }` }
    >
      <div
        className={ `relative overflow-hidden glass border ${ accent.border } rounded-2xl shadow-lg` }
      >
        {/* Faint accent wash layered over the frosted glass. */}
        <div
          className={ `absolute inset-0 ${ accent.tint } pointer-events-none` }
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:px-5 sm:py-3.5">
          <Icon
            className={ `w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${ accent.icon }` }
          />
          <span className="text-sm sm:text-base font-medium text-foreground">
            {message}
          </span>

          <button
            onClick={ () => {
              setIsVisible( false );
              setTimeout(
                onClose,
                300
              );
            } }
            className="ml-1 sm:ml-2 p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-hover transition-colors"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
