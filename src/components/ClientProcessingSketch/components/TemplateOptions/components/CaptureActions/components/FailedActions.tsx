"use client";

import React from "react";
import {
  Archive, Loader, RotateCcw, Trash2
} from "lucide-react";

type FailedActionsProps = {
  onRetry: () => void;
  onSaveAsDraft: () => void;
  onDelete: () => void;
  retrying: boolean;
  saving: boolean;
  deleting: boolean;
  isAnyActionLoading: boolean;
};

export default function FailedActions( {
  onRetry,
  onSaveAsDraft,
  onDelete,
  retrying,
  saving,
  deleting,
  isAnyActionLoading
}: FailedActionsProps ) {
  return (
    <div className="flex flex-col gap-1">
      <button
        className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onSaveAsDraft}
        disabled={isAnyActionLoading}
      >
        {saving ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Archive className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate">
          {saving ? "Saving..." : "Save as Draft"}
        </span>
      </button>

      <div className="grid grid-cols-2 gap-1">
        <button
          className="rounded-xl px-3 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
          onClick={onRetry}
          disabled={isAnyActionLoading}
        >
          {retrying ? (
            <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <RotateCcw className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="truncate">{retrying ? "Retrying..." : "Retry"}</span>
        </button>

        <button
          className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
          onClick={onDelete}
          disabled={isAnyActionLoading}
        >
          {deleting ? (
            <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <Trash2 className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="truncate">
            {deleting ? "Deleting..." : "Delete"}
          </span>
        </button>
      </div>
    </div>
  );
}
