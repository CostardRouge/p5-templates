import {
  useCallback, useEffect, useRef, useState
} from "react";
import pica from "pica";
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
  const picaRef = useRef<ReturnType<typeof pica> | null>( null );
  const pendingThumbnailCaptureRef = useRef<number | null>( null );

  // Initialize pica instanc e
  useEffect(
    () => {
      if ( enabled ) {
        picaRef.current = pica();
      }
    },
    [
      enabled
    ]
  );

  // Initialize thumbnails from persisted job
  useEffect(
    () => {
      if ( !enabled || !persistedJob?.thumbnails || slideFields.length === 0 ) {
        return;
      }

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
                setThumbnails( ( prev ) => ( {
                  ...prev,
                  ...newThumbnails
                } ) );
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
            setThumbnails( ( prev ) => ( {
              ...prev,
              ...( persistedJob.thumbnails as Record<string, string> )
            } ) );
          } else if ( typeof persistedJob.thumbnails === "string" ) {
            try {
              const parsed = JSON.parse( persistedJob.thumbnails );

              if ( typeof parsed === "object" && !Array.isArray( parsed ) ) {
                setThumbnails( ( prev ) => ( {
                  ...prev,
                  ...parsed
                } ) );
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
                setThumbnails( ( prev ) => ( {
                  ...prev,
                  ...newThumbnails
                } ) );
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
            setThumbnails( ( prev ) => ( {
              ...prev,
              ...newThumbnails
            } ) );
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

  const captureThumbnail = useCallback(
    async( slideId: string ) => {
      if ( !enabled || !picaRef.current ) {
        return;
      }

      const dataUrl = await captureThumbnailFromCanvas( picaRef.current );

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

  return {
    thumbnails,
    captureThumbnail,
    pendingThumbnailCaptureRef,
  };
}
