import React, {
  Fragment, useCallback, useEffect, useRef, useState,
} from "react";
import {
  useInterval
} from "@/hooks/useInterval";
import {
  useUnsavedChanges
} from "@/hooks/useUnsavedChanges";
import UnsavedChangesModal from "@/components/UnsavedChangesModal";
import {
  ArrowDownFromLine, ListCollapse
} from "lucide-react";

import {
  JobModel
} from "@/types/recording.types";
import {
  OptionsSchema, SketchOption, SketchOptionInput, SlideOption,
} from "@/types/sketch.types";

import FormUndoRedo from "./components/FormUndoRedo/FormUndoRedo";
import ContentItems from "./components/ContentItems/ContentItems";
import CaptureActions, {
  CaptureActionsRef
} from "./components/CaptureActions";
import SlideCarousel from "./components/SlideCarousel";
import SlideEditor from "./components/SlideEditor";
import TemplateAssetsProvider from "./components/TemplateAssetsProvider/TemplateAssetsProvider";

import {
  FormProvider, useFieldArray, useForm, useWatch
} from "react-hook-form";
import {
  zodResolver
} from "@hookform/resolvers/zod";

import CollapsibleItem from "@/components/CollapsibleItem";
import initOptions from "@/components/utils/initOptions";

import ContentArrayProvider
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/ContentArrayProvider/ContentArrayProvider";
import deepClone from "@/utils/deepClone";
import makeDefaultSlide from "@/components/ClientProcessingSketch/components/TemplateOptions/utils/makeDefaultSlide";

import RootSettings
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/RootSettings/RootSettings";
import clsx from "clsx";
import UndoRedo from "@/components/ClientProcessingSketch/components/TemplateOptions/components/UndoRedo";
import SketchSettings
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/SketchSettings/SketchSettings";
import useSketch from "../SketchProvider/hooks/useSketch";

type TemplateOptionsProps = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: (
    nextOptions: SketchOption | ((existingOptions: SketchOption) => void)
  ) => void;
  onActiveSlideChange?: (index: number | undefined) => void;
}

export default function TemplateOptions({
  name,
  persistedJob,
  onOptionsChange,
  onActiveSlideChange,
  options: initialOptions,
}: TemplateOptionsProps) {
  const {
    capturing
  } = useSketch();

  if (capturing) {
    return null;
  }

  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState(0);

  const captureActionsRef = useRef<CaptureActionsRef>(null);
  const [
    hasUnsavedChanges,
    setHasUnsavedChanges
  ] = useState(false);

  const methods = useForm<SketchOptionInput>({
    mode: "onChange",
    defaultValues: initOptions(initialOptions),
    resolver: zodResolver(OptionsSchema),
  });

  const {
    control,
    watch,
    getValues,
    setValue,
    formState: {
      errors
    },
  } = methods;

  const {
    fields: slideFields,
    append: appendSlide,
    insert: insertSlide,
    move: moveSlide,
    remove: removeSlide,
  } = useFieldArray({
    control,
    name: "slides",
  });

  const slides = useWatch({
    control,
    name: "slides",
  }) as SlideOption[] | undefined;

  const jobId = useWatch({
    control,
    name: "id",
  }) as string | undefined;

  useEffect(
    () => {
      const subscription = watch((value) => {
        onOptionsChange(value as SketchOption);

        // Track unsaved changes
        if (persistedJob?.status !== "completed") {
          setHasUnsavedChanges(true);
        }
      });

      return () => subscription.unsubscribe();
    },
    [
      watch,
      onOptionsChange,
      jobId,
      persistedJob?.status
    ]
  );

  // Auto-save every 10 seconds when jobId exists and status is draft
  useInterval({
    callback: async () => {
      if (captureActionsRef.current && !captureActionsRef.current.isSaving) {
        await captureActionsRef.current.saveAsDraft();
        setHasUnsavedChanges(false);
      }
    },
    enabled: !!jobId && persistedJob?.status === "draft",
    intervalMs: 10000, // 10 seconds
  });

  // Unsaved changes detection - triggers modal on navigation attempts
  const {
    showModal, handleStay, handleSaveAsDraft, handleLeaveWithoutSaving
  } = useUnsavedChanges({
    hasUnsavedChanges: hasUnsavedChanges,
    onSaveAsDraft: async () => {
      if (captureActionsRef.current) {
        await captureActionsRef.current.saveAsDraft();
        setHasUnsavedChanges(false);
      }
    },
  });

  const didInitSelection = useRef(false);

  const handleSlideSelect = useCallback(
    (index: number | undefined) => {
      if (index !== undefined) {
        setActiveSlideIndex(index);

        if (typeof window.setSlide === "function") {
          window.setSlide(index);
        }
      }

      onActiveSlideChange?.(index);
    },
    [
      onActiveSlideChange
    ]
  );

  useEffect(
    () => {
      const length = slideFields.length;

      if (!didInitSelection.current && length > 0) {
        didInitSelection.current = true;

        handleSlideSelect(0);

        if (typeof window.setSlide === "function") {
          window.setSlide(0);
        }
      }
    },
    [
      handleSlideSelect,
      slideFields.length
    ]
  );

  useEffect(
    () => {
      const length = slideFields.length;
      let next = activeSlideIndex;
      let needsAdjustment = false;

      if (length === 0) {
        if (activeSlideIndex !== 0) {
          setActiveSlideIndex(0);
        }
        handleSlideSelect(undefined);
      }
      else {
        if (activeSlideIndex < 0) {
          next = 0;
          needsAdjustment = true;
        }
        else if (activeSlideIndex > length - 1) {
          next = length - 1;
          needsAdjustment = true;
        }

        if (needsAdjustment) {
          handleSlideSelect(next);
        }
        else {
          if (typeof window.setSlide === "function") {
            window.setSlide(next);
          }
        }
      }
    },
    [
      handleSlideSelect,
      slideFields.length,
      activeSlideIndex
    ]
  );

  const handleAddSlide = () => {
    const nextIndex = slideFields.length;

    // Determine settings to clone:
    // If no slides exist yet, use the global 'sketch' settings.
    // Otherwise, use the settings from the currently active slide.
    let settingsToClone: any;
    if (slideFields.length === 0) {
      settingsToClone = getValues("sketch");
    }
    else {
      const activeSlide = getValues(`slides.${activeSlideIndex}`);
      settingsToClone = activeSlide?.sketch;
    }

    appendSlide(makeDefaultSlide({
      indexForLabel: nextIndex,
      sketch: deepClone(settingsToClone),
    }));

    handleSlideSelect(nextIndex);
  };

  const handleDuplicateSlide = (indexToDuplicate: number) => {
    const allSlides = getValues("slides") ?? [
    ];
    const original = allSlides[indexToDuplicate];

    if (!original) {
      return;
    }

    const duplicated = deepClone(original);

    if (duplicated?.name) {
      duplicated.name = `${duplicated.name} (copy)`;
    }

    const insertIndex = indexToDuplicate + 1;

    insertSlide(
      insertIndex,
      duplicated
    );

    handleSlideSelect(insertIndex);
  };

  const handleDeleteSlide = (indexToDelete: number) => {
    const lengthBefore = slideFields.length;

    if (lengthBefore <= 0) {
      return;
    }

    // If we are deleting the LAST remaining slide, we want to move its settings
    // back to the global 'sketch' object so the user doesn't lose their configuration.
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
      const nextIndex = Math.min(
        activeSlideIndex,
        lengthAfter - 1
      );

      handleSlideSelect(nextIndex);
      return;
    }
    handleSlideSelect(activeSlideIndex);
  };

  const handleReorderSlides = (
    oldIndex: number, newIndex: number
  ) => {
    if (oldIndex === newIndex) {
      return;
    }

    moveSlide(
      oldIndex,
      newIndex
    );

    handleSlideSelect(newIndex);
  };

  const slideIds = slideFields.map((field) => field.id);
  const slidesLength = slides?.length;
  const rootContentLength = useWatch({
    control,
    name: "content",
  })?.length;

  const options = watch();
  const editorKey = slideIds[activeSlideIndex] ?? `${activeSlideIndex}-${slides?.[activeSlideIndex]?.name ?? "unnamed-slide"}`;

  return (
    <FormProvider {...methods}>
      <UnsavedChangesModal
        isOpen={showModal}
        onStay={handleStay}
        onSaveAsDraft={handleSaveAsDraft}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        isSaving={captureActionsRef.current?.isSaving}
      />

      <div
        className="w-64 absolute right-2 bottom-2 flex flex-col gap-2 z-50"
        style={{ maxWidth: "calc(50% - 0.75rem)" }}
      >
        <CollapsibleItem
          data-no-zoom=""
          className="flex flex-col gap-1 glass p-2 border border-theme rounded-2xl shadow-lg"
          style={{
            maxHeight: "calc(80svh)",
          }}
          header={(expanded) => (
            <button
              className={
                clsx(
                  "text-foreground text-sm text-right",
                  {
                    "w-full": !expanded,
                    "absolute top-2 right-2": expanded
                  }
                )
              }
              aria-label={expanded ? "Collapse controls" : "Expand controls"}
            >
              <span>options</span>
              <ArrowDownFromLine
                className="inline text-foreground h-3 w-3 ml-1"
                style={{
                  rotate: expanded ? "0deg" : "180deg"
                }}
              />
            </button>
          )}
      >
        <FormUndoRedo
          maxHistory={50}
          hotkeys
          autoCapture="debounced"
          debounceMs={400}
          watchPaths={[
            "content",
            "sketch",
            "slides",
            "animation"
          ]}
          captureInitial
        >
          <UndoRedo />
        </FormUndoRedo>

        <RootSettings />

        <CollapsibleItem
          initialExpandedValue={false}
          className="p-1 border border-theme rounded-lg text-foreground bg-background overflow-y-auto"
          headerContainerClassName="leading-none"
          header={(expanded) => (
            <button
              className={
                clsx(
                  "text-foreground text-xs w-full text-left -ml-1 align-text-top",
                  {
                    "mb-1": expanded
                  }
                )
              }
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              <ListCollapse
                className="inline text-foreground h-3"
                style={{
                  rotate: expanded ? "180deg" : "0deg"
                }}
              />
              <span>global content {rootContentLength ? `(${rootContentLength})` : null}</span>
            </button>
          )}
        >
          <TemplateAssetsProvider scope="global" assetsName="assets" jobId={jobId}>
            <ContentArrayProvider name="content">
              <ContentItems baseFieldName="content" />
            </ContentArrayProvider>
          </TemplateAssetsProvider>
        </CollapsibleItem>

        {slides && (
          <Fragment>
            <CollapsibleItem
              initialExpandedValue={!!slidesLength}
              className="p-1 border border-theme rounded-lg bg-background overflow-y-auto"
              headerContainerClassName="leading-none"
              header={(expanded) => (
                <button
                  className={
                    clsx(
                      "text-foreground text-xs w-full text-left -ml-1 align-text-top",
                      {
                        "mb-1": expanded
                      }
                    )
                  }
                  aria-label={expanded ? "Collapse" : "Expand"}
                >
                  <ListCollapse
                    className="inline text-foreground h-3"
                    style={{
                      rotate: expanded ? "180deg" : "0deg"
                    }}
                  />
                  <span>slides {slidesLength ? `(${slidesLength})` : null}</span>
                </button>
              )}
            >
              <SlideCarousel
                slides={slides as SlideOption[]}
                slideIds={slideIds}
                activeIndex={activeSlideIndex}
                onAdd={handleAddSlide}
                onSelect={handleSlideSelect}
                onReorder={handleReorderSlides}
                onDuplicate={handleDuplicateSlide}
                onDelete={handleDeleteSlide}
              />

              <SlideEditor
                key={editorKey}
                activeIndex={activeSlideIndex}
              />
            </CollapsibleItem>
          </Fragment>
        )}
        </CollapsibleItem>

        <CaptureActions
          ref={captureActionsRef}
          name={name}
          options={options as SketchOption}
          persistedJob={persistedJob}
          activeSlideIndex={activeSlideIndex}
        />
      </div>

      <TemplateAssetsProvider scope="global" assetsName="assets" jobId={jobId}>
        <SketchSettings
          activeSlideIndex={slides && slides.length > 0 ? activeSlideIndex : undefined}
        />
      </TemplateAssetsProvider>
    </FormProvider>
  );
}
