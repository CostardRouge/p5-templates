"use client";

import React, {
  useEffect, useState
} from "react";
import { createPortal } from "react-dom";
import {
  Download, X
} from "lucide-react";
import fetchDownload from "@/components/utils/fetchDownload";

interface VideoPreviewModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
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
}

function formatFileSize( bytes: number ): string {
  if ( bytes === 0 ) return "0 B";
  const k = 1024;
  const sizes = [
    "B",
    "KB",
    "MB",
    "GB"
  ];
  const i = Math.floor( Math.log( bytes ) / Math.log( k ) );
  return `${ ( bytes / Math.pow( k, i ) ).toFixed( 1 ) } ${ sizes[ i ] }`;
}

function formatDuration( ms: number ): string {
  const seconds = Math.floor( ms / 1000 );
  const minutes = Math.floor( seconds / 60 );
  const remainingSeconds = seconds % 60;
  
  if ( minutes > 0 ) {
    return `${ minutes }m ${ remainingSeconds }s`;
  }
  return `${ seconds }s`;
}

export default function VideoPreviewModal( {
  jobId,
  isOpen,
  onClose,
}: VideoPreviewModalProps ) {
  const [
    media,
    setMedia
  ] = useState<MediaData | null>( null );
  const [
    loading,
    setLoading
  ] = useState( true );
  const [
    error,
    setError
  ] = useState<string | null>( null );

  useEffect(
    () => {
      if ( !isOpen ) return;

      const fetchMedia = async() => {
        try {
          setLoading( true );
          setError( null );
          const response = await fetch( `/api/recordings/${ jobId }/media` );

          if ( !response.ok ) {
            throw new Error( "Failed to load media" );
          }

          const data = await response.json();

          setMedia( data );
        } catch ( err ) {
          console.error(
            "Error fetching media:",
            err
          );
          setError( "Failed to load videos" );
        } finally {
          setLoading( false );
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
      if ( isOpen ) {
        const mainElement = document.querySelector( "main" );

        if ( mainElement ) {
          mainElement.style.overflow = "hidden";
        }
      } else {
        const mainElement = document.querySelector( "main" );

        if ( mainElement ) {
          mainElement.style.overflow = "";
        }
      }

      return () => {
        const mainElement = document.querySelector( "main" );

        if ( mainElement ) {
          mainElement.style.overflow = "";
        }
      };
    },
    [
      isOpen
    ]
  );

  if ( !isOpen ) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 md:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="overflow-hidden relative w-full md:w-[90vw] lg:w-[85vw] xl:w-[80vw] h-[95vh] bg-background rounded-3xl border border-border shadow-2xl flex flex-col animate-in zoom-in-95 duration-300"
        onClick={( e ) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-background border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground">Recording Preview</h2>
            {media && !loading && !media.isZipArchive && media.videos.length > 0 && (
              <p className="text-sm text-foreground/60 mt-0.5">
                {media.videos.length} {media.videos.length === 1 ? "slide" : "slides"}
                {media.recordingDuration && ` • ${formatDuration( media.recordingDuration )}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-xl hover:bg-hover transition-colors group"
          >
            <X className="w-5 h-5 text-foreground/70 group-hover:text-foreground transition-colors" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-hidden flex-1">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-base font-medium text-foreground">Loading videos...</p>
                <p className="text-sm text-foreground/60 mt-1">Please wait</p>
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
                      onClick={async() => await fetchDownload( `/api/recordings/download/${ jobId }/zip` )}
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
                <div className="h-full flex flex-col gap-6">
                  {/* Horizontal scroll container for videos */}
                  <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-foreground/20 scrollbar-track-transparent">
                    <div className={`flex gap-8 h-full pb-2 ${ media.videos.length === 1 ? "justify-center" : "" }`}>
                      {media.videos.map( (
                        {
                          url,
                          size
                        }, index
                      ) => (
                        <div
                          key={index}
                          className={`flex flex-col gap-4 ${ media.videos.length === 1 ? "w-full max-w-5xl" : "flex-shrink-0 w-[85vw] md:w-[650px] lg:w-[750px]" }`}
                        >
                          {/* Slide header */}
                          {media.videos.length > 1 && (
                            <div className="flex items-center justify-between">
                              <h3 className="text-base font-semibold text-foreground">
                                Slide {index + 1}
                              </h3>
                              <span className="text-xs text-foreground/50 font-medium">
                                {index + 1} of {media.videos.length}
                              </span>
                            </div>
                          )}
                          
                          {/* Video container */}
                          <div className="border border-border rounded-2xl overflow-hidden flex-1 flex items-center justify-center bg-black shadow-lg aspect-video">
                            <video
                              controls
                              className="w-full h-full object-contain"
                              preload="metadata"
                              poster={media.thumbnails[ index ]}
                            >
                              <source src={url} type="video/mp4" />
                              Your browser does not support the video tag.
                            </video>
                          </div>
                          
                          {/* Download button */}
                          <div className="flex justify-center">
                            <button
                              onClick={async() => await fetchDownload( `/api/recordings/download/${ jobId }/slide/${index}`)}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-hover hover:bg-hover/70 border border-border rounded-xl transition-all font-medium text-sm group"
                            >
                              <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
                              Download {size && (
                                <span className="text-foreground/60">({formatFileSize( size )})</span>
                              )}
                            </button>
                          </div>
                        </div>
                      ) )}
                    </div>
                  </div>

                  {/* Scroll indicator for multiple videos */}
                  {media.videos.length > 1 && (
                    <div className="text-center py-2 bg-hover/30 rounded-xl border border-border">
                      <p className="text-sm text-foreground/60 font-medium">
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

  return createPortal( modalContent, document.body );
}
