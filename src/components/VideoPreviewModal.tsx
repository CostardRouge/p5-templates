"use client";

import React, {
  useEffect, useState
} from "react";
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

  if ( !isOpen ) {
    return null;
  }

  return (
    <div
      className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black/70 backdrop-blur-sm p-12"
      onClick={onClose}
    >
      <div
        className="relative w-[80vw] md:w-[70vw] max-h-[80vh] overflow-y-auto bg-background rounded-lg border border-theme shadow-2xl"
        onClick={( e ) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-background border-b border-theme">
          <h2 className="font-semibold">Recording preview</h2>
          <button
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-foreground">Loading videos...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-red-500">
                <p>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && media && (
            <div className="space-y-6">
              {media.isZipArchive && (
                <div className="text-center py-8">
                  <p className="text-foreground mb-4">
                    This is an older recording stored as a zip archive.
                  </p>
                  <p className="text-sm text-foreground/70">
                    Video preview is not available for archived recordings.
                  </p>
                </div>
              )}

              {!media.isZipArchive && media.videos.length === 0 && (
                <p className="text-center text-foreground">No videos available</p>
              )}

              {!media.isZipArchive && media.videos.map( ({url}, index ) => (
                <div key={index} className="flex flex-col justify-center items-center gap-2">
                  {media.videos.length > 1 && (
                    <h3 className="text-sm font-medium text-foreground">
                      Slide {index + 1}
                    </h3>
                  )}
                  <div className="border border-theme rounded-lg overflow-hidden w-full">
                    <video
                      controls
                      className="w-full"
                      preload="metadata"
                      poster={media.thumbnails[ index ]}
                    >
                      <source src={url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </div>

                  <button
                    onClick={async() => await fetchDownload( `/api/recordings/download/${ jobId }` )}
                    className={"items-center gap-2 px-4 py-2 text-sm flex border border-theme border-b-2 rounded-lg"}
                  >
                    <Download className="h-5" />
                    Download
                  </button>
                </div>
              ) )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
