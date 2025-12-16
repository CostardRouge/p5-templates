"use client";

import React from "react";
import {
  AlertCircle
} from "lucide-react";
import {
  Alert, AlertDescription, AlertTitle
} from "@/components/ui/alert";

interface GSAPTemplateErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function GSAPTemplateError( {
  title = "Template Error",
  message,
  onRetry,
}: GSAPTemplateErrorProps ) {
  return (
    <div className="flex items-center justify-center h-screen p-8">
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="mt-2">
          {message}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 underline hover:no-underline"
            >
              Try again
            </button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
