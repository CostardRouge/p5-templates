"use client";

import {
  Copy, Loader, Lock, Radio
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

  const title = isRecording ? "Recording en cours" : "Recording terminé";
  const subtitle =
    "Vos modifications ne seront pas sauvegardées sur ce sketch.";

  return (
    <div className="flex flex-col gap-2 glass px-3 py-2.5 border border-theme rounded-2xl shadow-lg">
      <div className="flex items-start gap-2">
        {isRecording ? (
          <Radio className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-500 animate-pulse" />
        ) : (
          <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold leading-tight">{title}</span>
          <span className="text-[11px] opacity-75 leading-tight mt-0.5">
            {subtitle}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={ onClone }
        disabled={ cloning }
        className="rounded-xl px-3 py-2 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
      >
        {cloning ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Copy className="h-4 w-4 flex-shrink-0" />
        )}
        <span>{cloning ? "Clonage..." : "Cloner en draft pour modifier"}</span>
      </button>
    </div>
  );
}
