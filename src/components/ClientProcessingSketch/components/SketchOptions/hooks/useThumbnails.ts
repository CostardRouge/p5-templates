import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  JobModel
} from "@/types/recording.types";
import type {
  SketchEngine
} from "@/engines/types";
import {
  captureThumbnailFromCanvas,
  getRenderedSlideIndex,
  waitForSlideRendered
} from "../utils/thumbnailUtils";

export type CaptureThumbnailOptions = {
  // Bounds waitForSlideRendered for callers that defer work on the capture
  // settling (the pre-switch outgoing capture). Default 5000ms.
  waitTimeoutMs?: number;
};

type UseThumbnailsProps = {
  enabled: boolean;
  persistedJob?: JobModel;
  slideFields: Array<{
    id: string;
  }>;
  // Active engine, used to grab a current-frame canvas engine-agnostically
  // (notably to rasterise the GSAP DOM). Optional so callers without an engine
  // fall back to the live-canvas lookup.
  engine?: SketchEngine | null;
  // True while an in-browser recording/export is running. Captures are skipped
  // then: for GSAP a capture rasterises the same singleton mirror canvas the
  // recorder is driving, so it would collide with the in-flight recording.
  recording?: boolean;
};

export function useThumbnails( {
  enabled,
  persistedJob,
  slideFields,
  engine,
  recording
}: UseThumbnailsProps ) {
  const [
    thumbnails,
    setThumbnails
  ] = useState<Record<string, string>>( {} );
  const pendingThumbnailCaptureRef = useRef<number | null>( null );
  const hasLoadedPersistedThumbnails = useRef( false );

  // Keep the latest engine + recording flag in refs so the capture callbacks
  // stay stable (they feed many effects/deps) while always reading fresh values.
  const engineRef = useRef( engine );
  const recordingRef = useRef( recording );

  engineRef.current = engine;
  recordingRef.current = recording;

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
                const newThumbnails: Record<string, string> = {};

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
            const newThumbnails: Record<string, string> = {};

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
                const newThumbnails: Record<string, string> = {};

                slideFields.forEach( (
                  field, index
                ) => {
                  if ( parsed[ index ] ) {
                    newThumbnails[ field.id ] = parsed[ index ];
                  }
                } );
                setThumbnails( newThumbnails );
              }
            } catch( e ) {
              console.warn(
                "Failed to parse thumbnails string",
                e
              );
            }
          } else if ( Array.isArray( persistedJob.thumbnails ) ) {
            const thumbArray = persistedJob.thumbnails as string[];
            const newThumbnails: Record<string, string> = {};

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
      } catch( e ) {
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
    async(
      slideId: string, slideIndex?: number, options?: CaptureThumbnailOptions
    ) => {
      // Don't capture while a recording is in flight — a GSAP capture would
      // rasterise the same mirror canvas the recorder is driving.
      if ( !enabled || recordingRef.current ) {
        return;
      }

      // Whether the frame about to be read was confirmed to belong to
      // `slideIndex`. Only a confirmed capture may store a uniform (flat)
      // frame — see below.
      let confirmed = false;

      // If slideIndex is provided, wait for the slide to be rendered
      if ( slideIndex !== undefined ) {
        try {
          confirmed =
            ( await waitForSlideRendered(
              slideIndex,
              options?.waitTimeoutMs
            ) ) === "matched";
        } catch( error ) {
          console.warn(
            `Failed to wait for slide ${ slideIndex } rendering:`,
            error
          );
          // Continue with capture anyway to avoid completely breaking thumbnails
        }

        // Rapid successive switches can leave this wait behind: if the engine
        // is now rendering another slide, storing its frame under `slideId`
        // would pin the wrong artwork on the tile. Drop the capture instead —
        // the lazy re-capture path retries on the slide's next visit.
        const renderedIndex = getRenderedSlideIndex();

        if ( renderedIndex !== undefined && renderedIndex !== slideIndex ) {
          return;
        }
      }

      const capture = await captureThumbnailFromCanvas( engineRef.current );

      if ( !capture ) {
        return;
      }

      // A uniform frame from an unconfirmed read is almost certainly a failed
      // capture (blank WEBGL buffer, mid-switch clear) flattened into a solid
      // JPEG — storing it would freeze a black tile forever, since the lazy
      // re-capture path skips slides that already hold a thumbnail. Discard it
      // so that path retries. A confirmed capture keeps its uniform frame: a
      // sketch that legitimately renders flat gets an accurate tile.
      if ( capture.isUniform && !confirmed ) {
        return;
      }

      setThumbnails( ( prev ) => ( {
        ...prev,
        [ slideId ]: capture.dataUrl
      } ) );
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
    (
      fromSlideId: string, toSlideId: string
    ) => {
      setThumbnails( ( prev ) => {
        const thumb = prev[ fromSlideId ];

        if ( !thumb ) {
          return prev;
        }

        return {
          ...prev,
          [ toSlideId ]: thumb
        };
      } );
    },
    []
  );

  // Clear all thumbnails (useful for reset)
  const clearThumbnails = useCallback(
    () => {
      setThumbnails( {} );
      hasLoadedPersistedThumbnails.current = false;
    },
    []
  );

  return {
    thumbnails,
    captureThumbnail,
    captureCurrentSlide,
    copyThumbnail,
    clearThumbnails,
    pendingThumbnailCaptureRef
  };
}
