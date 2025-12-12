import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  JobModel
} from "@/types/recording.types";
import {
  captureThumbnailFromCanvas
} from "../utils/thumbnailUtils";

type UseThumbnailsProps = {
  enabled: boolean;
  persistedJob?: JobModel;
  slideFields: Array<{
 id: string
}>;
};

export function useThumbnails( {
  enabled, persistedJob, slideFields
}: UseThumbnailsProps ) {
  const [
    thumbnails,
    setThumbnails
  ] = useState<Record<string, string>>( {
  } );
  const pendingThumbnailCaptureRef = useRef<number | null>( null );
  const hasLoadedPersistedThumbnails = useRef( false );
  const initialCaptureAttempted = useRef( false );

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
          if ( typeof persistedJob.thumbnails === "object" && !Array.isArray( persistedJob.thumbnails ) ) {
            setThumbnails( persistedJob.thumbnails as Record<string, string> );
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
      slideFields
    ]
  );

  // Capture initial thumbnails for slides that don't have them
  useEffect(
    () => {
      if ( !enabled || slideFields.length === 0 || initialCaptureAttempted.current ) {
        return;
      }

      // Wait a bit for the canvas to be ready and rendered
      const timeoutId = setTimeout(
        () => {
          initialCaptureAttempted.current = true;

          // Check which slides need thumbnails
          const slidesNeedingThumbnails = slideFields.filter(
            ( field ) => !thumbnails[ field.id ]
          );

          if ( slidesNeedingThumbnails.length === 0 ) {
            return;
          }

          // Capture thumbnail for the first slide that needs one
          // (assuming it's the active slide)
          const firstSlideId = slidesNeedingThumbnails[ 0 ].id;

          captureThumbnailFromCanvas()
            .then( ( dataUrl ) => {
              if ( dataUrl ) {
                setThumbnails( ( prev ) => ( {
                  ...prev,
                  [ firstSlideId ]: dataUrl
                } ) );
              }
            } )
            .catch( ( e ) => {
              console.error(
                "Failed to capture initial thumbnail:",
                e
              );
            } );
        },
        500
      ); // Give canvas time to render

      return () => clearTimeout( timeoutId );
    },
    [
      enabled,
      slideFields,
      thumbnails
    ]
  );

  const captureThumbnail = useCallback(
    async( slideId: string ) => {
      if ( !enabled ) {
        return;
      }

      const dataUrl = await captureThumbnailFromCanvas();

      if ( dataUrl ) {
        setThumbnails( ( prev ) => ( {
          ...prev,
          [ slideId ]: dataUrl
        } ) );
      }
    },
    [
      enabled
    ]
  );

  // Manually capture thumbnail for current slide (useful for refresh)
  const captureCurrentSlide = useCallback(
    async( slideId: string ) => {
      if ( !enabled ) {
        return;
      }

      // Wait a bit for canvas to update
      await new Promise( ( resolve ) => setTimeout(
        resolve,
        100
      ) );
      await captureThumbnail( slideId );
    },
    [
      enabled,
      captureThumbnail
    ]
  );

  // Clear all thumbnails (useful for reset)
  const clearThumbnails = useCallback(
    () => {
      setThumbnails( {
      } );
      hasLoadedPersistedThumbnails.current = false;
      initialCaptureAttempted.current = false;
    },
    [
    ]
  );

  return {
    thumbnails,
    captureThumbnail,
    captureCurrentSlide,
    clearThumbnails,
    pendingThumbnailCaptureRef,
  };
}
