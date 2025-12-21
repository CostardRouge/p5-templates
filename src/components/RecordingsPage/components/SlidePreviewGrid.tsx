"use client";

import {
  useState, useEffect
} from "react";
import {
  Video
} from "lucide-react";

// Time in milliseconds to display each slide in the carousel
const SLIDE_INTERVAL_MS = 500;

interface SlidePreviewGridProps {
  jobId: string;
  slideCount: number;
  isVisible: boolean;
}

export default function SlidePreviewGrid( {
  jobId,
  slideCount,
  isVisible,
}: SlidePreviewGridProps ) {
  const [
    thumbnails,
    setThumbnails
  ] = useState<string[]>( [
  ] );
  const [
    loading,
    setLoading
  ] = useState( false );
  const [
    error,
    setError
  ] = useState( false );
  const [
    currentIndex,
    setCurrentIndex
  ] = useState( 0 );

  // Fetch thumbnails when visible
  useEffect(
    () => {
      if ( !isVisible || slideCount <= 1 ) return;

      const fetchThumbnails = async() => {
        setLoading( true );
        setError( false );

        try {
          const response = await fetch( `/api/recordings/${ jobId }/media` );

          if ( !response.ok ) throw new Error( "Failed to fetch thumbnails" );

          const data = await response.json();

          setThumbnails( data.thumbnails || [
          ] );
        } catch ( err ) {
          console.error(
            "Failed to load slide thumbnails:",
            err
          );
          setError( true );
        } finally {
          setLoading( false );
        }
      };

      fetchThumbnails();
    },
    [
      isVisible,
      jobId,
      slideCount
    ]
  );

  // Carousel auto-advance
  useEffect(
    () => {
      if ( !isVisible || thumbnails.length <= 1 || loading || error ) return;

      const interval = setInterval(
        () => {
          setCurrentIndex( ( prev ) => ( prev + 1 ) % thumbnails.length );
        },
        SLIDE_INTERVAL_MS
      );

      return () => clearInterval( interval );
    },
    [
      isVisible,
      thumbnails.length,
      loading,
      error
    ]
  );

  // Reset index when visibility changes
  useEffect(
    () => {
      if ( !isVisible ) {
        setCurrentIndex( 0 );
      }
    },
    [
      isVisible
    ]
  );

  if (
    !isVisible ||
    slideCount <= 1 ||
    loading ||
    error ||
    thumbnails.length === 0
  )
    return null;

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      {thumbnails.map( (
        thumb, idx
      ) => (
        <img
          key={idx}
          src={thumb}
          alt={`Slide ${ idx + 1 }`}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{
            opacity: idx === currentIndex ? 1 : 0,
            pointerEvents: idx === currentIndex ? "auto" : "none",
          }}
        />
      ) )}
    </div>
  );
}
