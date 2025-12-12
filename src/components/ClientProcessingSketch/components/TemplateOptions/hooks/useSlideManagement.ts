import { useCallback, useEffect, useRef, useState } from "react";
import { UseFieldArrayReturn, UseFormGetValues, UseFormSetValue } from "react-hook-form";
import { SketchOptionInput } from "@/types/sketch.types";
import deepClone from "@/utils/deepClone";
import makeDefaultSlide from "../utils/makeDefaultSlide";

type UseSlideManagementProps = {
  slideFields: UseFieldArrayReturn<SketchOptionInput, "slides", "id">["fields"];
  appendSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">["append"];
  insertSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">["insert"];
  moveSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">["move"];
  removeSlide: UseFieldArrayReturn<SketchOptionInput, "slides", "id">["remove"];
  getValues: UseFormGetValues<SketchOptionInput>;
  setValue: UseFormSetValue<SketchOptionInput>;
  sketchFormValues: any;
  onActiveSlideChange?: (index: number | undefined) => void;
  captureThumbnail?: (slideId: string) => Promise<void>;
  enableThumbnails: boolean;
  pendingThumbnailCaptureRef: React.MutableRefObject<number | null>;
};

export function useSlideManagement({
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
  enableThumbnails,
  pendingThumbnailCaptureRef,
}: UseSlideManagementProps) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const didInitSelection = useRef(false);

  const handleSlideSelect = useCallback(
    async (index: number | undefined) => {
      // Capture thumbnail of current slide before switching
      if (enableThumbnails && captureThumbnail && activeSlideIndex !== undefined && slideFields[activeSlideIndex]) {
        const currentSlideId = slideFields[activeSlideIndex].id;
        await captureThumbnail(currentSlideId);
      }

      if (index !== undefined) {
        if (index !== activeSlideIndex) {
          setActiveSlideIndex(index);
          if (typeof window.setSlide === "function") {
            window.setSlide(index);
          }
        }
      }

      onActiveSlideChange?.(index);
    },
    [onActiveSlideChange, activeSlideIndex, slideFields, captureThumbnail, enableThumbnails]
  );

  // Initialize first slide selection
  useEffect(() => {
    const length = slideFields.length;
    if (!didInitSelection.current && length > 0) {
      didInitSelection.current = true;
      handleSlideSelect(0);

      if (typeof window.setSlide === "function") {
        window.setSlide(0);
      }

      // Capture initial thumbnail for the first slide after a short delay
      if (enableThumbnails && captureThumbnail) {
        const firstSlideId = slideFields[0]?.id;
        if (firstSlideId) {
          requestAnimationFrame(() => {
            setTimeout(() => {
              captureThumbnail(firstSlideId);
            }, 300);
          });
        }
      }
    }
  }, [handleSlideSelect, slideFields.length, slideFields, captureThumbnail, enableThumbnails]);

  // Adjust active slide when slides change
  useEffect(() => {
    const length = slideFields.length;
    let next = activeSlideIndex;
    let needsAdjustment = false;

    if (length === 0) {
      if (activeSlideIndex !== 0) {
        setActiveSlideIndex(0);
      }
      handleSlideSelect(undefined);
    } else {
      if (activeSlideIndex < 0) {
        next = 0;
        needsAdjustment = true;
      } else if (activeSlideIndex > length - 1) {
        next = length - 1;
        needsAdjustment = true;
      }

      if (needsAdjustment) {
        handleSlideSelect(next);
      } else {
        if (typeof window.setSlide === "function") {
          window.setSlide(next);
        }
      }
    }
  }, [handleSlideSelect, slideFields.length, activeSlideIndex]);

  const handleAddSlide = useCallback(
    async () => {
      // Capture the current slide's thumbnail before adding a new one
      if (enableThumbnails && captureThumbnail && activeSlideIndex !== undefined && slideFields[activeSlideIndex]) {
        await captureThumbnail(slideFields[activeSlideIndex].id);
      }

      const nextIndex = slideFields.length;
      const newSlide = makeDefaultSlide({
        indexForLabel: nextIndex,
        sketch: sketchFormValues,
      });

      appendSlide(newSlide);
      await handleSlideSelect(nextIndex);

      // Mark that we need to capture thumbnail for the new slide
      if (enableThumbnails) {
        pendingThumbnailCaptureRef.current = nextIndex;
      }
    },
    [activeSlideIndex, slideFields, sketchFormValues, appendSlide, handleSlideSelect, captureThumbnail, enableThumbnails, pendingThumbnailCaptureRef]
  );

  const handleDuplicateSlide = useCallback(
    (indexToDuplicate: number) => {
      const allSlides = getValues("slides") ?? [];
      const original = allSlides[indexToDuplicate];

      if (!original) {
        return;
      }

      const duplicated = deepClone(original);
      if (duplicated?.name) {
        duplicated.name = `${duplicated.name} (copy)`;
      }

      const insertIndex = indexToDuplicate + 1;
      insertSlide(insertIndex, duplicated);
      handleSlideSelect(insertIndex);
    },
    [getValues, insertSlide, handleSlideSelect]
  );

  const handleDeleteSlide = useCallback(
    (indexToDelete: number) => {
      const lengthBefore = slideFields.length;
      if (lengthBefore <= 0) {
        return;
      }

      // If we are deleting the LAST remaining slide, move its settings to global 'sketch'
      if (lengthBefore === 1) {
        const lastSlideSettings = getValues(`slides.${indexToDelete}.sketch`);
        if (lastSlideSettings) {
          setValue("sketch", deepClone(lastSlideSettings));
        }
      }

      removeSlide(indexToDelete);
      const lengthAfter = lengthBefore - 1;

      if (lengthAfter <= 0) {
        handleSlideSelect(0);
        return;
      }

      if (indexToDelete < activeSlideIndex) {
        handleSlideSelect(activeSlideIndex - 1);
        return;
      }

      if (indexToDelete === activeSlideIndex) {
        const nextIndex = Math.min(activeSlideIndex, lengthAfter - 1);
        handleSlideSelect(nextIndex);
        return;
      }

      handleSlideSelect(activeSlideIndex);
    },
    [slideFields.length, activeSlideIndex, getValues, setValue, removeSlide, handleSlideSelect]
  );

  const handleReorderSlides = useCallback(
    (oldIndex: number, newIndex: number) => {
      if (oldIndex === newIndex) {
        return;
      }
      moveSlide(oldIndex, newIndex);
      handleSlideSelect(newIndex);
    },
    [moveSlide, handleSlideSelect]
  );

  const handleRenameSlide = useCallback(
    (index: number, newName: string) => {
      setValue(`slides.${index}.name`, newName);
    },
    [setValue]
  );

  return {
    activeSlideIndex,
    handleSlideSelect,
    handleAddSlide,
    handleDuplicateSlide,
    handleDeleteSlide,
    handleReorderSlides,
    handleRenameSlide,
  };
}
