"use client";

import {
  useEffect, useState
} from "react";
import {
  CheckCircle
} from "lucide-react";

type ImportSuccessBannerProps = {
  message: string;
  duration?: number;
  onDismiss: () => void;
};

export default function ImportSuccessBanner( {
  message,
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
      duration
    ]
  );

  return (
    <div
      className={ `flex items-start gap-2 px-2 py-2 border border-green-500/40 bg-green-500/10 backdrop-blur-xl rounded-2xl shadow-lg transition-all duration-300 ${
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
