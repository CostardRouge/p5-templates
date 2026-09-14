"use client";

import React, {
  useEffect, useMemo, useState
} from "react";
import {
  ArrowLeft, Download, FileArchive, Share2
} from "lucide-react";
import {
  formatBytes
} from "@/lib/export/download";
import {
  isDelivered, saveArtifacts, toFiles, type SaveOutcome
} from "@/lib/export/delivery";
import {
  canShareFiles
} from "@/lib/export/share";
import type {
  ExportArtifact
} from "@/lib/export/runExportBatch";

type ExportPreviewProps = {
  title: string;
  artifacts: ExportArtifact[];
  /** The name these files take when they collapse into one download. */
  bundleFileName: string;
  /** How this variant's last save went, if it has been tried. */
  outcome?: SaveOutcome;
  onSaved?: ( outcome: SaveOutcome ) => void;
  onBack: () => void;
};

/** What element can actually render this file. */
function previewKindOf( fileName: string ): "video" | "image" | "none" {
  const extension = fileName.split( "." ).pop()
    ?.toLowerCase() ?? "";

  if ( extension === "mp4" || extension === "webm" ) {
    return "video";
  }

  // A .gif is an image, not a video container — a <video> renders nothing for
  // it however willing the browser looks.
  if ( extension === "gif" || extension === "png" || extension === "jpg" ) {
    return "image";
  }

  return "none";
}

/**
 * What just came out of an export, before deciding what to do with it.
 *
 * It renders straight from the blobs the run produced — no upload, no fetch.
 * That also sidesteps the reason the backend preview needs an S3 proxy: WebKit
 * refuses a `<video>` whose source cannot serve range requests, and a `blob:`
 * URL has no such problem.
 *
 * The share action is the point of the screen on iOS, where a download only
 * ever reaches the Files app and the share sheet is the only route to Photos.
 */
export default function ExportPreview( {
  title,
  artifacts,
  bundleFileName,
  outcome,
  onSaved,
  onBack
}: ExportPreviewProps ) {
  const [
    sharing,
    setSharing
  ] = useState( false );
  const [
    lastOutcome,
    setLastOutcome
  ] = useState<SaveOutcome | undefined>( outcome );

  // Built once per artifact set, and revoked together: an object URL left
  // behind pins its blob in memory for the life of the document.
  const sources = useMemo(
    () => artifacts.map( ( artifact ) => ( {
      artifact,
      kind: previewKindOf( artifact.fileName ),
      url: URL.createObjectURL( artifact.blob )
    } ) ),
    [
      artifacts
    ]
  );

  useEffect(
    () => () => {
      for ( const source of sources ) {
        URL.revokeObjectURL( source.url );
      }
    },
    [
      sources
    ]
  );

  const files = useMemo(
    () => toFiles( artifacts ),
    [
      artifacts
    ]
  );

  const shareable = canShareFiles( files );
  const totalBytes = artifacts.reduce(
    (
      sum, artifact
    ) => sum + artifact.blob.size,
    0
  );

  const handleSave = async() => {
    setSharing( true );

    try {
      // `saveArtifacts`, not `shareFiles`: a multi-slide variant holds one file
      // per slide, and `shareFiles` falls back to downloading each of them —
      // seven stacked prompts on the devices this screen exists for. This
      // collapses to a single zip instead.
      const result = await saveArtifacts(
        artifacts,
        title,
        bundleFileName
      );

      setLastOutcome( result );
      onSaved?.( result );
    } finally {
      setSharing( false );
    }
  };

  const delivered = isDelivered( lastOutcome ?? "failed" );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-theme px-3 py-2">
        <button
          type="button"
          onClick={ onBack }
          aria-label="Back to the variants"
          className="rounded-md p-1 text-label transition-colors hover:bg-hover hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <span className="truncate text-xs font-medium text-foreground">{title}</span>
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-label">
          {artifacts.length > 1 ? `${ artifacts.length } files · ` : ""}
          {formatBytes( totalBytes )}
        </span>
      </div>

      {/* Several files scroll sideways, one fills the pane. */}
      <div className={ sources.length > 1
        ? "flex min-h-0 flex-1 gap-2 overflow-x-auto p-2"
        : "flex min-h-0 flex-1 p-2" }
      >
        {sources.map( ( source ) => (
          <figure
            key={ source.artifact.fileName }
            className={ sources.length > 1
              ? "flex w-64 shrink-0 flex-col gap-1.5"
              : "flex min-w-0 flex-1 flex-col gap-1.5" }
          >
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-theme bg-foreground/5">
              {source.kind === "video" && (
                <video
                  src={ source.url }
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-full max-w-full"
                />
              )}

              {source.kind === "image" && (
                <img
                  src={ source.url }
                  alt={ source.artifact.fileName }
                  className="max-h-full max-w-full object-contain"
                />
              )}

              {source.kind === "none" && (
                <div className="flex flex-col items-center gap-1.5 p-6 text-label">
                  <FileArchive className="h-6 w-6" />
                  <span className="text-[10px]">No preview for this file</span>
                </div>
              )}
            </div>

            <figcaption className="truncate font-mono text-[10px] text-label">
              {source.artifact.fileName} · {formatBytes( source.artifact.blob.size )}
            </figcaption>
          </figure>
        ) )}
      </div>

      <div className="flex items-center gap-2 border-t border-theme px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[10px] text-label">
          {delivered && "Saved"}
          {!delivered && lastOutcome === "dismissed" && (
            <span className="text-red-500">Not saved — you dismissed the sheet.</span>
          )}
          {!delivered && lastOutcome === "busy" && (
            <span className="text-red-500">A share sheet is already open.</span>
          )}
          {!delivered && lastOutcome === "failed" && (
            <span className="text-red-500">Could not save those files.</span>
          )}
          {!delivered && lastOutcome === undefined && ( shareable
            ? "Not saved yet — share to put it in your photos"
            : "Not saved yet" )}
        </span>

        <button
          type="button"
          onClick={ handleSave }
          disabled={ sharing }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-40"
        >
          {shareable ? (
            <Share2 className="h-3.5 w-3.5" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {shareable ? "Share" : delivered ? "Download again" : "Download"}
        </button>
      </div>
    </div>
  );
}
