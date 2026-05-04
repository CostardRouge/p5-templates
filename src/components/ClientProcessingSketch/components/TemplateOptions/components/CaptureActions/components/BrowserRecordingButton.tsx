"use client";

import React from "react";
import {
  Save
} from "lucide-react";

type BrowserRecordingButtonProps = {
  onRecord: () => Promise<void>;
};

export default function BrowserRecordingButton( {
  onRecord
}: BrowserRecordingButtonProps ) {
  return (
    <button
      className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5"
      onClick={ onRecord }
    >
      <Save className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">Record in .webm</span>
    </button>
  );
}
