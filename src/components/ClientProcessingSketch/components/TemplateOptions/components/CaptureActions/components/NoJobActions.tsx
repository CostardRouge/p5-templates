"use client";

import React from "react";
import {
  Archive, Clapperboard, Loader
} from "lucide-react";

type NoJobActionsProps = {
  onSaveDraft: () => void;
  onStart: () => void;
  saving: boolean;
  isLoading: boolean;
  isAnyActionLoading: boolean;
  isBlockingActionLoading: boolean;
};

export default function NoJobActions( {
  onSaveDraft,
  onStart,
  saving,
  isLoading,
  isAnyActionLoading,
  isBlockingActionLoading,
}: NoJobActionsProps ) {
  return (
    <div className="flex gap-1">
      <button
        className="rounded-xl px-1 py-2.5 border border-border text-foreground bg-background hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all inline-flex items-center justify-center gap-1 flex-1"
        onClick={onSaveDraft}
        disabled={isAnyActionLoading}
      >
        {saving ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Archive className="h-4 w-4 flex-shrink-" />
        )}
        {saving ? "Saving..." : "Save Draft"}
      </button>

      <button
        className="rounded-xl px-1 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 flex-1"
        onClick={onStart}
        disabled={isBlockingActionLoading}
      >
        {isLoading && !saving ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Clapperboard className="h-4 w-4 flex-shrink-0" />
        )}
        {isLoading && !saving ? "Starting..." : "Start"}
      </button>
    </div>
  );
}
