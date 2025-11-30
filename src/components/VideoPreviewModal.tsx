"use client";

import React, {
  useEffect, useState, useRef
} from "react";
import {
  createPortal
} from "react-dom";
import {
  Download, X, ExternalLink, FileVideo
} from "lucide-react";
import fetchDownload from "@/components/utils/fetchDownload";

interface VideoPreviewModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

interface MediaData {
  thumbnails: string[];
  videos: Array<{
    index: number,
    url: string,
    key: string,
    size: number
  }>;
  isZipArchive?: boolean;
  resultUrl?: string;
  recordingDuration?: number;
  zipSize?: number;
  template?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = [
    "B",
    "KB",
    "MB",
    "GB"
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(
    k,
    i
  )).toFixed(1)} ${sizes[i]}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export default function VideoPreviewModal({
  jobId,
  isOpen,
  onClose,
}: VideoPreviewModalProps) {
  const [
    media,
    setMedia
  ] = useState<MediaData | null>(null);
  const [
    loading,
    setLoading
  ] = useState(true);
  const [
    error,
    setError
  ] = useState<string | null>(null);
  const [
    videoMetadata,
    setVideoMetadata
  ] = useState<Map<number, VideoMetadata>>(new Map());
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  useEffect(
    () => {
      if (!isOpen) return;

      const fetchMedia = async () => {
        try {
          setLoading(true);
          setError(null);
          const response = await fetch(`/api/recordings/${jobId}/media`);

          if (!response.ok) {
            throw new Error("Failed to load media");
          }

          const data = await response.json();

          setMedia(data);
        } catch (err) {
          console.error(
            "Error fetching media:",
            err
          );
          setError("Failed to load videos");
        } finally {
          setLoading(false);
        }
      };

      fetchMedia();
    },
    [
      jobId,
      isOpen
    ]
  );

  // Prevent scroll when modal is open
  useEffect(
    () => {
      if (isOpen) {
        const mainElement = document.querySelector("main");

        if (mainElement) {
          mainElement.style.overflow = "hidden";
        }
      } else {
        const mainElement = document.querySelector("main");

        if (mainElement) {
          mainElement.style.overflow = "";
        }
      }

      return () => {
        const mainElement = document.querySelector("main");

        if (mainElement) {
          mainElement.style.overflow = "";
        }
      };
    },
    [
      isOpen
    ]
  );

  const handleVideoLoadedMetadata = (
    index: number, video: HTMLVideoElement
  ) => {
    setVideoMetadata((prev) => {
      const newMap = new Map(prev);

      newMap.set(
        index,
        {
          duration: video.duration,
          width: video.videoWidth,
          height: video.videoHeight
        }
      );
      return newMap;
    });
  };

  const handleDownloadAll = async () => {
    if (!media || media.videos.length === 0) return;

    if (media.videos.length === 1) {
      // Single video - download directly
      await fetchDownload(`/api/recordings/download/${jobId}/slide/0`);
    } else {
      // Multiple videos - download as zip
      await fetchDownload(`/api/recordings/download/${jobId}/zip`);
    }
  };

  if (!isOpen) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 md:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="overflow-hidden relative w-full md:w-[90vw] lg:w-[85vw] xl:w-[80vw] max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] md:max-h-[95vh] bg-background rounded-2xl sm:rounded-3xl border border-border shadow-2xl flex flex-col animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-5 bg-background border-b border-border flex-shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="text-base sm:text-xl font-bold text-foreground truncate">Recording Preview</h2>
            {media && !loading && !media.isZipArchive && media.videos.length > 0 && (
              <p className="text-xs sm:text-sm text-foreground/60 mt-0.5 truncate">
                {media.videos.length} {media.videos.length === 1 ? "slide" : "slides"}
                {media.recordingDuration && ` • ${formatDuration(media.recordingDuration)}`}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {media && !loading && !media.isZipArchive && media.videos.length > 0 && (
              <>
                {/* Download All - Only show for multiple videos */}
                {media.videos.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-hover hover:bg-hover/70 border border-border rounded-lg transition-all text-sm font-medium group"
                    title={`Download all as .zip${media.zipSize ? ` (${formatFileSize(media.zipSize)})` : ""}`}
                  >
                    <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Download All</span>
                  </button>
                )}

                {/* Open Recording Link */}
                <a
                  href={`templates/${media.template}?id=${jobId}`}
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-hover hover:bg-hover/70 border border-border rounded-lg transition-all text-sm font-medium group"
                  title="Open recording page"
                >
                  <FileVideo className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">Recording</span>
                </a>

                {/* Open Template Link */}
                {media.template && (
                  <a
                    href={`/templates/${media.template}`}
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-hover hover:bg-hover/70 border border-border rounded-lg transition-all text-sm font-medium group"
                    title="Open template"
                  >
                    <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">Template</span>
                  </a>
                )}
              </>
            )}

            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded-xl hover:bg-hover transition-colors group"
            >
              <X className="w-5 h-5 text-foreground/70 group-hover:text-foreground transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-6 overflow-hidden flex-1 min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base font-medium text-foreground">Loading videos...</p>
                <p className="text-xs sm:text-sm text-foreground/60 mt-1">Please wait</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-4">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-base font-semibold text-foreground mb-1">Failed to load videos</p>
                <p className="text-sm text-foreground/60">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && media && (
            <>
              {media.isZipArchive && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-foreground/5 mb-4">
                      <Download className="w-8 h-8 text-foreground/40" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Archived Recording
                    </h3>
                    <p className="text-sm text-foreground/60 mb-4">
                      This is an older recording stored as a zip archive. Video preview is not available for archived recordings.
                    </p>
                    <button
                      onClick={async () => await fetchDownload(`/api/recordings/download/${jobId}/zip`)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-hover hover:bg-hover/70 border border-border rounded-xl transition-all font-medium text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download Archive
                    </button>
                  </div>
                </div>
              )}

              {!media.isZipArchive && media.videos.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-foreground/5 mb-4">
                      <X className="w-8 h-8 text-foreground/40" />
                    </div>
                    <p className="text-base font-medium text-foreground">No videos available</p>
                  </div>
                </div>
              )}

              {!media.isZipArchive && media.videos.length > 0 && (
                <div className="h-full flex flex-col gap-3 sm:gap-4 md:gap-6 min-h-0">
                  {/* Horizontal scroll container for videos */}
                  <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-foreground/20 scrollbar-track-transparent min-h-0">
                    <div className={`flex gap-4 sm:gap-6 md:gap-8 h-full pb-2 ${media.videos.length === 1 ? "justify-center" : ""}`}>
                      {media.videos.map((
                        {
                          url,
                          size
                        }, index
                      ) => (
                        <div
                          key={index}
                          className={`flex flex-col gap-2 sm:gap-3 md:gap-4 ${media.videos.length === 1 ? "w-full max-w-5xl" : "flex-shrink-0 w-[85vw] sm:w-[80vw] md:w-[650px] lg:w-[750px]"}`}
                        >
                          {/* Slide header */}
                          {media.videos.length > 1 && (
                            <div className="flex items-center justify-between flex-shrink-0">
                              <h3 className="text-sm sm:text-base font-semibold text-foreground">
                                Slide {index + 1}
                              </h3>
                              <span className="text-xs text-foreground/50 font-medium">
                                {index + 1} of {media.videos.length}
                              </span>
                            </div>
                          )}

                          {/* Video container */}
                          <div className="border border-border rounded-xl sm:rounded-2xl overflow-hidden flex-1 flex items-center justify-center bg-black shadow-lg aspect-video min-h-0">
                            <video
                              ref={(el) => {
                                if (el) {
                                  videoRefs.current.set(
                                    index,
                                    el
                                  );
                                }
                              }}
                              controls
                              className="w-full h-full object-contain"
                              preload="metadata"
                              poster={media.thumbnails[index]}
                              onLoadedMetadata={(e) => handleVideoLoadedMetadata(
                                index,
                                e.currentTarget
                              )}
                            >
                              <source src={url} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                          </div>

                          {/* Video info and download */}
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            {/* Video metadata */}
                            {videoMetadata.get(index) && (
                              <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs text-foreground/60">
                                <span className="inline-flex items-center gap-1">
                                  <span className="font-medium">Duration:</span>
                                  <span>{formatDuration(videoMetadata.get(index)!.duration * 1000)}</span>
                                </span>
                                <span className="text-foreground/30">•</span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="font-medium">Resolution:</span>
                                  <span>{videoMetadata.get(index)!.width} × {videoMetadata.get(index)!.height}</span>
                                </span>
                              </div>
                            )}

                            {/* Download button */}
                            <div className="flex justify-center">
                              <button
                                onClick={async () => await fetchDownload(`/api/recordings/download/${jobId}/slide/${index}`)}
                                className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-hover hover:bg-hover/70 border border-border rounded-xl transition-all font-medium text-xs sm:text-sm group"
                              >
                                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
                                <span className="sm:inline">Download</span>
                                {size && (
                                  <span className="text-foreground/60">({formatFileSize(size)})</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scroll indicator for multiple videos */}
                  {media.videos.length > 1 && (
                    <div className="text-center py-2 bg-hover/30 rounded-xl border border-border flex-shrink-0">
                      <p className="text-xs sm:text-sm text-foreground/60 font-medium">
                        ← Scroll horizontally to view all {media.videos.length} slides →
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    modalContent,
    document.body
  );
}
