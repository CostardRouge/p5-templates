"use client";

import React, {
  useEffect, useState
} from "react";
import {
  CheckCircle, XCircle, Info, AlertTriangle, X
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

const colorMap = {
  success: "bg-green-600 border-green-700",
  error: "bg-red-600 border-red-700",
  info: "bg-blue-600 border-blue-700",
  warning: "bg-orange-600 border-orange-700",
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
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg text-white transition-all duration-300 ${ colorMap[ type ] } ${ 
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={() => {
          setIsVisible( false );
          setTimeout(
            onClose,
            300
          );
        }}
        className="ml-2 hover:opacity-80 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
