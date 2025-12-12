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
  warning: AlertTriangle,
};

const iconColorMap = {
  success: "text-green-600",
  error: "text-red-600",
  info: "text-blue-600",
  warning: "text-orange-600",
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

  return (
    <div
      className={`fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 max-w-[calc(100vw-1rem)] sm:max-w-none ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="bg-background border border-border rounded-xl sm:rounded-2xl shadow-xl px-3 py-2.5 sm:px-6 sm:py-4 flex items-center gap-2 sm:gap-4">
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${ iconColorMap[ type ] }`} />
        <span className="text-sm sm:text-base font-medium text-foreground">{message}</span>

        <div className="w-px h-5 sm:h-6 bg-border ml-2" />

        <button
          onClick={() => {
            setIsVisible( false );
            setTimeout(
              onClose,
              300
            );
          }}
          className="p-1.5 sm:p-2 rounded-lg hover:bg-hover transition-colors"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}
