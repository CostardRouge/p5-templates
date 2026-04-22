import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  JobModel
} from "@/types/recording.types";
import {
  captureThumbnailFromCanvas,
  waitForSlideRendered,
} from "../utils/thumbnailUtils";

type UseThumbnailsProps = {
  enabled: boolean;
  persistedJob?: JobModel;
  slideFields: Array<{
    id: string;
  }>;
};

export function useThumbnails( {
  enabled,
  persistedJob,
  slideFields,
}: UseThumbnailsProps ) {
  const [
    thumbnails,
    setThumbnails
  ] = useState<Record<string, string>>( {
  } );
  const pendingThumbnailCaptureRef = useRef<number | null>( null );
  const hasLoadedPersistedThumbnails = useRef( false );

  // Initialize thumbnails from persisted job
  useEffect(
    () => {
      if ( !enabled || !persistedJob?.thumbnails || slideFields.length === 0 ) {
        hasLoadedPersistedThumbnails.current = false;
        return;
      }

      // Prevent loading multiple times
      if ( hasLoadedPersistedThumbnails.current ) {
        return;
      }

      hasLoadedPersistedThumbnails.current = true;

      try {
      // For completed recordings, thumbnails are S3 URLs - we need to fetch signed URLs
        if ( persistedJob.status === "completed" ) {
          fetch( `/api/recordings/${ persistedJob.id }/media` )
            .then( ( res ) => {
              if ( !res.ok ) {
                throw new Error( `Failed to fetch media: ${ res.status }` );
              }
              return res.json();
            } )
            .then( ( data ) => {
              if ( data.thumbnails && Array.isArray( data.thumbnails ) ) {
                const newThumbnails: Record<string, string> = {
                };

                slideFields.forEach( (
                  field, index
                ) => {
                  if ( data.thumbnails[ index ] ) {
                    newThumbnails[ field.id ] = data.thumbnails[ index ];
                  }
                } );
                setThumbnails( newThumbnails );
              }
            } )
            .catch( ( e ) => {
              console.error(
                "Failed to fetch signed thumbnail URLs:",
                e
              );
            } );
        } else {
        // For draft recordings, thumbnails are stored as Record<slideId, dataUrl>
          if (
            typeof persistedJob.thumbnails === "object" &&
          !Array.isArray( persistedJob.thumbnails )
          ) {
            // Remap by position: stored keys are stale RHF field IDs from the previous session
            const thumbValues = Object.values( persistedJob.thumbnails as Record<string, string> );
            const newThumbnails: Record<string, string> = {
            };

            slideFields.forEach( (
              field, index
            ) => {
              if ( thumbValues[ index ] ) {
                newThumbnails[ field.id ] = thumbValues[ index ];
              }
            } );
            setThumbnails( newThumbnails );
          } else if ( typeof persistedJob.thumbnails === "string" ) {
            try {
              const parsed = JSON.parse( persistedJob.thumbnails );

              if ( typeof parsed === "object" && !Array.isArray( parsed ) ) {
                setThumbnails( parsed );
              } else if ( Array.isArray( parsed ) ) {
                const newThumbnails: Record<string, string> = {
                };

                slideFields.forEach( (
                  field, index
                ) => {
                  if ( parsed[ index ] ) {
                    newThumbnails[ field.id ] = parsed[ index ];
                  }
                } );
                setThumbnails( newThumbnails );
              }
            } catch ( e ) {
              console.warn(
                "Failed to parse thumbnails string",
                e
              );
            }
          } else if ( Array.isArray( persistedJob.thumbnails ) ) {
            const thumbArray = persistedJob.thumbnails as string[];
            const newThumbnails: Record<string, string> = {
            };

            slideFields.forEach( (
              field, index
            ) => {
              if ( thumbArray[ index ] ) {
                newThumbnails[ field.id ] = thumbArray[ index ];
              }
            } );
            setThumbnails( newThumbnails );
          }
        }
      } catch ( e ) {
        console.error(
          "Error loading persisted thumbnails:",
          e
        );
      }
    },
    [
      enabled,
      persistedJob?.thumbnails,
      persistedJob?.status,
      persistedJob?.id,
      slideFields.length,
      slideFields,
    ]
  );

  const captureThumbnail = useCallback(
    async(
      slideId: string, slideIndex?: number
    ) => {
      if ( !enabled ) {
        return;
      }

      // If slideIndex is provided, wait for the slide to be rendered
      if ( slideIndex !== undefined ) {
        try {
          await waitForSlideRendered( slideIndex );
        } catch ( error ) {
          console.warn(
            `Failed to wait for slide ${ slideIndex } rendering:`,
            error
          );
          // Continue with capture anyway to avoid completely breaking thumbnails
        }
      }

      const dataUrl = await captureThumbnailFromCanvas();

      if ( dataUrl ) {
        setThumbnails( ( prev ) => ( {
          ...prev,
          [ slideId ]: dataUrl,
        } ) );
      }
    },
    [
      enabled
    ]
  );

  // Manually capture thumbnail for current slide (useful for refresh)
  const captureCurrentSlide = useCallback(
    async(
      slideId: string, slideIndex?: number
    ) => {
      if ( !enabled ) {
        return;
      }

      // Wait a bit for canvas to update
      await new Promise( ( resolve ) => setTimeout(
        resolve,
        100
      ) );
      await captureThumbnail(
        slideId,
        slideIndex
      );
    },
    [
      enabled,
      captureThumbnail
    ]
  );

  const copyThumbnail = useCallback(
    ( fromSlideId: string, toSlideId: string ) => {
      setThumbnails( ( prev ) => {
        const thumb = prev[ fromSlideId ];

        if ( !thumb ) {
          return prev;
        }

        return {
          ...prev,
          [ toSlideId ]: thumb,
        };
      } );
    },
    []
  );

  // Clear all thumbnails (useful for reset)
  const clearThumbnails = useCallback(
    () => {
      setThumbnails( {
      } );
      hasLoadedPersistedThumbnails.current = false;
    },
    [
    ]
  );

  return {
    thumbnails,
    captureThumbnail,
    captureCurrentSlide,
    copyThumbnail,
    clearThumbnails,
    pendingThumbnailCaptureRef,
  };
}
