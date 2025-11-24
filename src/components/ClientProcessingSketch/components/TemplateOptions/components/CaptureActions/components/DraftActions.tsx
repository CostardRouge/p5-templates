"use client";

import React from "react";
import {
  Archive, Clapperboard, Loader, Save, Trash2
} from "lucide-react";
import clsx from "clsx";

type DraftActionsProps = {
  onSave: () => void;
  onStart: () => void;
  onDelete: () => void;
  saving: boolean;
  isLoading: boolean;
  deleting: boolean;
  isAnyActionLoading: boolean;
  isBlockingActionLoading: boolean;
};

export default function DraftActions( {
  onSave,
  onStart,
  onDelete,
  saving,
  isLoading,
  deleting,
  isAnyActionLoading,
  isBlockingActionLoading,
}: DraftActionsProps ) {
  return (
    <>
      <div className="flex gap-1">
        <button
          className={clsx(
            "rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5 flex-1",
            {
              "animate-pulse-soft": saving,
            }
          )}
          onClick={onSave}
          disabled={isAnyActionLoading}
        >
          {saving ? (
            <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <Save className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="truncate">{saving ? "Saving..." : "Save"}</span>
        </button>

        <button
          className="rounded-xl px-3 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 flex-1"
          onClick={onStart}
          disabled={isBlockingActionLoading}
        >
          {isLoading && !saving ? (
            <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
          ) : (
            <Clapperboard className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="truncate">
            {isLoading && !saving ? "Starting..." : "Start"}
          </span>
        </button>
      </div>

      <button
        className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onDelete}
        disabled={isAnyActionLoading}
      >
        {deleting ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Trash2 className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate">{deleting ? "Deleting..." : "Delete Draft"}</span>
      </button>
    </>
  );
}
