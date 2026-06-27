import {
  useCallback, useEffect, useRef, useState
} from "react";
import {
  UseFieldArrayReturn,
  UseFormGetValues,
  UseFormSetValue
} from "react-hook-form";
import {
  SketchOptionInput
} from "@/types/sketch.types";
import deepClone from "@/utils/deepClone";
import makeSlideId from "@/utils/makeSlideId";
import makeDefaultSlide from "../utils/makeDefaultSlide";

type UseSlideManagementProps = {
  slideFields: UseFieldArrayReturn<SketchOptionInput, "slides", "id">[ "fields" ];
  appendSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">[ "append" ];
  insertSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">[ "insert" ];
  moveSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">[ "move" ];
  removeSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">[ "remove" ];
  getValues: UseFormGetValues<SketchOptionInput>;
  setValue: UseFormSetValue<SketchOptionInput>;
  sketchFormValues: any;
  onActiveSlideChange?: ( index: number | undefined ) => void;
  captureThumbnail?: ( slideId: string, slideIndex?: number ) => Promise<void>;
  copyThumbnail?: ( fromSlideId: string, toSlideId: string ) => void;
  enableThumbnails: boolean;
  pendingThumbnailCaptureRef: React.MutableRefObject<number | null>;
};

export function useSlideManagement( {
  slideFields,
  appendSlide,
  insertSlide,
  moveSlide,
  removeSlide,
  getValues,
  setValue,
  sketchFormValues,
  onActiveSlideChange,
  captureThumbnail,
  copyThumbnail,
  enableThumbnails,
  pendingThumbnailCaptureRef
}: UseSlideManagementProps ) {
  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState<number | undefined>( undefined );
  const [
    isAdding,
    setIsAdding
  ] = useState( false );
  const pendingSelectIndexRef = useRef<number | null>( null );
  const pendingThumbnailCopyFromIndexRef = useRef<number | null>( null );
  const onActiveSlideChangeRef = useRef( onActiveSlideChange );

  useEffect(
    () => {
      onActiveSlideChangeRef.current = onActiveSlideChange;
    },
    [
      onActiveSlideChange
    ]
  );

  // Compute the effective active index based on current slides
  const effectiveActiveIndex =
    slideFields.length > 0
      ? activeSlideIndex !== undefined && activeSlideIndex < slideFields.length
        ? activeSlideIndex
        : 0
      : undefined;

  const notifyActiveSlideChange = useCallback(
    ( index: number | undefined ) => {
      onActiveSlideChangeRef.current?.( index );
    },
    []
  );

  // Update active index when slides change
  useEffect(
    () => {
      const nextIndex =
        slideFields.length === 0
          ? undefined
          : activeSlideIndex !== undefined && activeSlideIndex < slideFields.length
            ? activeSlideIndex
            : 0;

      if ( nextIndex === activeSlideIndex ) {
        return;
      }

      setActiveSlideIndex( nextIndex );
      notifyActiveSlideChange( nextIndex );

      if ( typeof window.setSlide === "function" ) {
        window.setSlide( nextIndex ?? 0 );
      }
    },
    [
      slideFields.length,
      activeSlideIndex,
      notifyActiveSlideChange
    ]
  );

  const handleSlideSelect = useCallback(
    ( index: number | undefined ) => {
      if ( index !== undefined && ( index < 0 || index >= slideFields.length ) ) {
        return; // Invalid index
      }

      // Capture the previous slide thumbnail before switching
      if (
        enableThumbnails &&
        captureThumbnail &&
        activeSlideIndex !== undefined &&
        index !== activeSlideIndex
      ) {
        const previousSlideId = slideFields[ activeSlideIndex ]?.id;

        if ( previousSlideId ) {
          void captureThumbnail( previousSlideId );
        }
      }

      if ( index === activeSlideIndex ) {
        return;
      }

      setActiveSlideIndex( index );
      notifyActiveSlideChange( index );

      if ( typeof window.setSlide === "function" ) {
        window.setSlide( index ?? 0 );
      }

      // Capture the incoming slide's thumbnail after it finishes rendering.
      // Skip if a pending add/duplicate capture is already scheduled — that
      // effect owns the capture for newly created slides.
      if (
        enableThumbnails &&
        captureThumbnail &&
        index !== undefined &&
        pendingThumbnailCaptureRef.current === null
      ) {
        const incomingSlideId = slideFields[ index ]?.id;

        if ( incomingSlideId ) {
          void captureThumbnail(
            incomingSlideId,
            index
          );
        }
      }
    },
    [
      slideFields,
      enableThumbnails,
      captureThumbnail,
      activeSlideIndex,
      pendingThumbnailCaptureRef,
      notifyActiveSlideChange
    ]
  );

  // After append/insert, wait for react-hook-form to expose the new field id
  useEffect(
    () => {
      const pendingIndex = pendingSelectIndexRef.current;

      if ( pendingIndex === null ) {
        return;
      }

      if ( pendingIndex < 0 || pendingIndex >= slideFields.length ) {
        return;
      }

      pendingSelectIndexRef.current = null;

      // Instantly copy the source thumbnail to the duplicate before switching
      const copyFromIndex = pendingThumbnailCopyFromIndexRef.current;

      if ( copyFromIndex !== null && copyThumbnail ) {
        const fromId = slideFields[ copyFromIndex ]?.id;
        const toId = slideFields[ pendingIndex ]?.id;

        if ( fromId && toId ) {
          copyThumbnail(
            fromId,
            toId
          );
        }

        pendingThumbnailCopyFromIndexRef.current = null;
      }

      handleSlideSelect( pendingIndex );
      setIsAdding( false );
    },
    [
      copyThumbnail,
      slideFields,
      slideFields.length,
      handleSlideSelect
    ]
  );

  const handleAddSlide = useCallback(
    () => {
      if ( isAdding ) {
        return;
      }

      setIsAdding( true );

      const nextIndex = slideFields.length;
      const currentGlobalSketch = getValues( "sketch" );
      const currentGlobalSize = getValues( "size" ) as
        | { width: number;
          height: number }
        | undefined;
      const currentGlobalAnimation = getValues( "animation" ) as
        | { framerate: number;
          duration: number }
        | undefined;
      const newSlide = makeDefaultSlide( {
        indexForLabel: nextIndex,
        sketch: nextIndex === 0 ? currentGlobalSketch : sketchFormValues,
        size: currentGlobalSize,
        animation: currentGlobalAnimation
      } );

      appendSlide( newSlide );
      pendingSelectIndexRef.current = nextIndex;

      if ( enableThumbnails ) {
        pendingThumbnailCaptureRef.current = nextIndex;
      }
    },
    [
      isAdding,
      slideFields.length,
      getValues,
      appendSlide,
      sketchFormValues,
      enableThumbnails,
      pendingThumbnailCaptureRef,
      pendingSelectIndexRef
    ]
  );

  const handleDuplicateSlide = useCallback(
    ( indexToDuplicate: number ) => {
      if ( indexToDuplicate < 0 || indexToDuplicate >= slideFields.length ) {
        return;
      }

      const allSlides = getValues( "slides" ) ?? [];
      const original = allSlides[ indexToDuplicate ];

      if ( !original ) {
        return;
      }

      const duplicated = deepClone( original );

      // A fresh persisted id — cloning would otherwise make two slides share an
      // id, breaking montage `selected` references and per-slide thumbnails.
      duplicated.id = makeSlideId();

      if ( duplicated?.name ) {
        duplicated.name = `${ duplicated.name } (copy)`;
      }

      const insertIndex = indexToDuplicate + 1;

      insertSlide(
        insertIndex,
        duplicated
      );
      pendingSelectIndexRef.current = insertIndex;

      if ( enableThumbnails ) {
        pendingThumbnailCopyFromIndexRef.current = indexToDuplicate;
        pendingThumbnailCaptureRef.current = insertIndex;
      }
    },
    [
      slideFields.length,
      getValues,
      insertSlide,
      enableThumbnails,
      pendingThumbnailCaptureRef,
      pendingThumbnailCopyFromIndexRef,
      pendingSelectIndexRef
    ]
  );

  const handleDeleteSlide = useCallback(
    ( indexToDelete: number ) => {
      if ( indexToDelete < 0 || indexToDelete >= slideFields.length ) {
        return;
      }

      const lengthBefore = slideFields.length;

      // If deleting the last slide, preserve its settings
      if ( lengthBefore === 1 ) {
        const lastSlideSettings = getValues( `slides.${ indexToDelete }.sketch` );

        if ( lastSlideSettings ) {
          setValue(
            "sketch",
            deepClone( lastSlideSettings )
          );
        }

        const lastSlideSize = getValues( `slides.${ indexToDelete }.size` );

        if ( lastSlideSize ) {
          setValue(
            "size",
            deepClone( lastSlideSize )
          );
        }

        const lastSlideAnimation = getValues( `slides.${ indexToDelete }.animation` );

        if ( lastSlideAnimation ) {
          setValue(
            "animation",
            deepClone( lastSlideAnimation )
          );
        }
      }

      removeSlide( indexToDelete );

      // Adjust active slide after deletion
      const newLength = lengthBefore - 1;

      if ( newLength === 0 ) {
        handleSlideSelect( undefined );
      } else if ( indexToDelete <= effectiveActiveIndex! ) {
        const newIndex = Math.max(
          0,
          effectiveActiveIndex! -
            ( indexToDelete === effectiveActiveIndex! ? 0 : 1 )
        );

        handleSlideSelect( newIndex );
      }
    },
    [
      slideFields.length,
      effectiveActiveIndex,
      getValues,
      setValue,
      removeSlide,
      handleSlideSelect
      // deepClone( slides )
    ]
  );

  const handleReorderSlides = useCallback(
    (
      oldIndex: number, newIndex: number
    ) => {
      if (
        oldIndex === newIndex ||
        oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= slideFields.length ||
        newIndex >= slideFields.length
      ) {
        return;
      }
      moveSlide(
        oldIndex,
        newIndex
      );
      handleSlideSelect( newIndex );
    },
    [
      slideFields.length,
      moveSlide,
      handleSlideSelect
    ]
  );

  const handleRenameSlide = useCallback(
    (
      index: number, newName: string
    ) => {
      if ( index < 0 || index >= slideFields.length ) {
        return;
      }
      setValue(
        `slides.${ index }.name`,
        newName
      );
    },
    [
      slideFields.length,
      setValue
    ]
  );

  return {
    activeSlideIndex: effectiveActiveIndex,
    isAdding,
    handleSlideSelect,
    handleAddSlide,
    handleDuplicateSlide,
    handleDeleteSlide,
    handleReorderSlides,
    handleRenameSlide
  };
}
