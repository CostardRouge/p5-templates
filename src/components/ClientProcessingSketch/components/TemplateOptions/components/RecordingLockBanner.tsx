"use client";

import {
  AlertTriangle, Copy, Loader
} from "lucide-react";
import type {
  LifecycleState
} from "../hooks/useRecordingLifecycle";

type RecordingLockBannerProps = {
  state: LifecycleState;
  onClone: () => void;
  cloning: boolean;
};

export default function RecordingLockBanner( {
  state,
  onClone,
  cloning
}: RecordingLockBannerProps ) {
  const isRecording = state === "queued" || state === "active";
  const isCompleted = state === "completed";

  if ( !isRecording && !isCompleted ) {
    return null;
  }

  const title = isRecording ? "Recording in progress" : "Recording locked";
  const subtitle = "Edits to this sketch won't be saved.";

  return (
    <div className="flex flex-col gap-2 px-2 py-2 border border-amber-400/40 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 rounded-2xl shadow-lg">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold leading-tight text-amber-900 dark:text-amber-100">
            {title}
          </span>
          <span className="text-[11px] leading-tight mt-0.5 text-amber-800/80 dark:text-amber-200/80">
            {subtitle}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={ onClone }
        disabled={ cloning }
        className="rounded-xl px-2 py-2.5 border border-amber-500/40 dark:border-amber-400/30 text-amber-950 dark:text-amber-50 bg-amber-200 dark:bg-amber-400/20 hover:bg-amber-300 dark:hover:bg-amber-400/30 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
      >
        {cloning ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Copy className="h-4 w-4 flex-shrink-0" />
        )}
        <span>{cloning ? "Cloning..." : "Clone to save changes"}</span>
      </button>
    </div>
  );
}
