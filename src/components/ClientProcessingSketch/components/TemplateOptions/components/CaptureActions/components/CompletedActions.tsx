"use client";

import React from "react";
import {
  Copy, Download, Eye, Loader, Trash2
} from "lucide-react";
import {
  JobModel
} from "@/types/recording.types";
import {
  formatFileSize
} from "../utils/formatFileSize";

type CompletedActionsProps = {
  persistedJob: JobModel;
  activeSlideIndex: number;
  onPreview: () => void;
  onRecordAgain: () => void;
  onDelete: () => void;
  downloading: boolean;
  onDownload: () => Promise<void>;
  deleting: boolean;
  cloning: boolean;
};

export default function CompletedActions( {
  persistedJob,
  activeSlideIndex,
  onPreview,
  onRecordAgain,
  onDelete,
  downloading,
  onDownload,
  deleting,
  cloning,
}: CompletedActionsProps ) {
  // Get video sizes directly from job data
  const videoSizes = ( persistedJob.videoSizes as unknown as number[] ) || [
  ];
  const currentVideoSize = videoSizes[ activeSlideIndex ];

  return (
    <div className="grid grid-cols-2 gap-1">
      <button
        className="rounded-xl px-3 py-2.5 border border-border bg-hover hover:bg-hover/70 text-foreground text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onPreview}
        disabled={downloading || deleting || cloning}
      >
        <Eye className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">Preview</span>
      </button>

      <button
        className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5 min-w-0"
        onClick={onDownload}
        disabled={downloading || deleting || cloning}
      >
        {downloading ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Download className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate">
          {downloading
            ? "Downloading..."
            : `Download${ currentVideoSize ? ` (${ formatFileSize( currentVideoSize ) })` : "" }`}
        </span>
      </button>

      <button
        className="rounded-xl px-3 py-2.5 border border-border text-foreground bg-background hover:bg-hover text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onRecordAgain}
        disabled={downloading || deleting || cloning}
      >
        {cloning ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Copy className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate">{cloning ? "Cloning..." : "Clone"}</span>
      </button>

      <button
        className="rounded-xl px-3 py-2.5 border border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-1.5"
        onClick={onDelete}
        disabled={downloading || deleting || cloning}
      >
        {deleting ? (
          <Loader className="h-4 w-4 animate-spin flex-shrink-0" />
        ) : (
          <Trash2 className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate">{deleting ? "Deleting..." : "Delete"}</span>
      </button>
    </div>
  );
}
