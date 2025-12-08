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
import pica from "pica";

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
import useBrowserRecordingSupported
  from "@/components/ClientProcessingSketch/components/TemplateOptions/components/CaptureActions/hooks/useBrowserRecordingSupported";
import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";

type TemplateOptionsProps = {
  name: string;
  options: SketchOption;
  persistedJob?: JobModel;
  onOptionsChange: (
    nextOptions: SketchOption | ( ( existingOptions: SketchOption ) => void )
  ) => void;
  onActiveSlideChange?: ( index: number | undefined ) => void;
}

export default function TemplateOptions( {
  name,
  persistedJob,
  onOptionsChange,
  onActiveSlideChange,
  options: initialOptions,
}: TemplateOptionsProps ) {
  const browserRecordingSupported = useBrowserRecordingSupported();

  const [
    activeSlideIndex,
    setActiveSlideIndex
  ] = useState( 0 );

  const [
    thumbnails,
    setThumbnails
  ] = useState<Record<string, string>>( {
  } );

  const captureActionsRef = useRef<CaptureActionsRef>( null );
  const pendingThumbnailCaptureRef = useRef<number | null>( null );
  const picaRef = useRef<ReturnType<typeof pica> | null>( null );
  const [
    hasUnsavedChanges,
    setHasUnsavedChanges
  ] = useState( false );

  // Initialize pica instance
  useEffect(
    () => {
      picaRef.current = pica();
    },
    [
    ]
  );

  const methods = useForm<SketchOptionInput>( {
    mode: "onChange",
    defaultValues: initOptions( initialOptions ),
    resolver: zodResolver( OptionsSchema ),
  } );

  const {
    control,
    watch,
    getValues,
    setValue,
    reset,
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
    replace: replaceSlides,
  } = useFieldArray( {
    control,
    name: "slides",
  } );

  const slides = useWatch( {
    control,
    name: "slides",
  } ) as SlideOption[] | undefined;

  const jobId = useWatch( {
    control,
    name: "id",
  } ) as string | undefined;

  // Initialize thumbnails from persisted job
  useEffect(
    () => {
      if ( persistedJob?.thumbnails && slideFields.length > 0 ) {
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
              // Direct object map (new format)
              setThumbnails( ( prev ) => ( {
                ...prev,
                ...( persistedJob.thumbnails as Record<string, string> )
              } ) );
            } else if ( typeof persistedJob.thumbnails === "string" ) {
              // Try parsing if it's a string
              try {
                const parsed = JSON.parse( persistedJob.thumbnails );

                if ( typeof parsed === "object" && !Array.isArray( parsed ) ) {
                  setThumbnails( ( prev ) => ( {
                    ...prev,
                    ...parsed
                  } ) );
                } else if ( Array.isArray( parsed ) ) {
                  // Legacy array format - convert to map
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
              // Legacy array format - convert to map
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
      }
    },
    [
      persistedJob?.thumbnails,
      persistedJob?.status,
      persistedJob?.id,
      slideFields.length,
      slideFields
    ]
  );

  useEffect(
    () => {
      const subscription = watch( ( value ) => {
        onOptionsChange( value as SketchOption );

        // Track unsaved changes
        if ( persistedJob?.status !== "completed" ) {
          setHasUnsavedChanges( true );
        }
      } );

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
  useInterval( {
    callback: async() => {
      if ( captureActionsRef.current && !captureActionsRef.current.isSaving ) {
        await captureActionsRef.current.saveAsDraft();
        setHasUnsavedChanges( false );
      }
    },
    enabled: !!jobId && persistedJob?.status === "draft",
    intervalMs: 10000, // 10 seconds
  } );

  // Unsaved changes detection - triggers modal on navigation attempts
  const {
    showModal, handleStay, handleSaveAsDraft, handleLeaveWithoutSaving
  } = useUnsavedChanges( {
    hasUnsavedChanges: hasUnsavedChanges && !captureActionsRef.current?.isRecording,
    onSaveAsDraft: async() => {
      if ( captureActionsRef.current ) {
        await captureActionsRef.current.saveAsDraft();
        setHasUnsavedChanges( false );
      }
    },
  } );

  const didInitSelection = useRef( false );

  const captureThumbnail = useCallback(
    async( slideId: string ) => {
      const canvas = document.querySelector( "canvas#defaultCanvas0" ) as HTMLCanvasElement;

      if ( !canvas || !picaRef.current ) {
        return;
      }

      try {
        // Target width for thumbnail - optimal for grid display
        const targetWidth = 240;
        const scaleFactor = targetWidth / canvas.width;
        const targetHeight = Math.round( canvas.height * scaleFactor );

        // Create destination canvas
        const destCanvas = document.createElement( "canvas" );

        destCanvas.width = targetWidth;
        destCanvas.height = targetHeight;

        // Use pica for high-quality resizing
        await picaRef.current.resize(
          canvas,
          destCanvas,
          {
            quality: 3, // High quality (0-3)
            unsharpAmount: 80,
            unsharpRadius: 0.6,
            unsharpThreshold: 2
          }
        );

        // Convert to JPEG blob
        const blob = await picaRef.current.toBlob(
          destCanvas,
          "image/jpeg",
          0.85
        );

        // Convert blob to data URL
        const reader = new FileReader();

        reader.onloadend = () => {
          const dataUrl = reader.result as string;

          setThumbnails( ( prev ) => ( {
            ...prev,
            [ slideId ]: dataUrl
          } ) );
        };
        reader.readAsDataURL( blob );
      }
      catch ( e ) {
        console.error(
          "Failed to capture thumbnail",
          e
        );
      }
    },
    [
    ]
  );

  const handleSlideSelect = useCallback(
    async( index: number | undefined ) => {
      // Capture thumbnail of current slide before switching
      // We capture if we have an active slide index
      if ( activeSlideIndex !== undefined && slideFields[ activeSlideIndex ] ) {
        const currentSlideId = slideFields[ activeSlideIndex ].id;

        await captureThumbnail( currentSlideId );
      }

      if ( index !== undefined ) {
        // If clicking the same slide, we still want to update the thumbnail (which we just did above)
        // but we don't need to re-set the active index or window.setSlide if it's the same
        if ( index !== activeSlideIndex ) {
          setActiveSlideIndex( index );

          if ( typeof window.setSlide === "function" ) {
            window.setSlide( index );
          }
        }
      }

      onActiveSlideChange?.( index );
    },
    [
      onActiveSlideChange,
      activeSlideIndex,
      slideFields,
      captureThumbnail
    ]
  );

  useEffect(
    () => {
      const length = slideFields.length;

      if ( !didInitSelection.current && length > 0 ) {
        didInitSelection.current = true;

        handleSlideSelect( 0 );

        if ( typeof window.setSlide === "function" ) {
          window.setSlide( 0 );
        }

        // Capture initial thumbnail for the first slide after a short delay
        const firstSlideId = slideFields[ 0 ]?.id;

        if ( firstSlideId ) {
          requestAnimationFrame( () => {
            setTimeout(
              () => {
                captureThumbnail( firstSlideId );
              },
              300
            );
          } );
        }
      }
    },
    [
      handleSlideSelect,
      slideFields.length,
      slideFields,
      captureThumbnail
    ]
  );

  // Capture thumbnail for newly added slides
  useEffect(
    () => {
      if ( pendingThumbnailCaptureRef.current !== null ) {
        const slideIndex = pendingThumbnailCaptureRef.current;
        const slideId = slideFields[ slideIndex ]?.id;

        if ( slideId ) {
          // Give the sketch time to render the new slide
          // Use requestAnimationFrame to ensure canvas is rendered
          requestAnimationFrame( () => {
            setTimeout(
              async() => {
                await captureThumbnail( slideId );
              },
              300
            );
          } );
        }

        pendingThumbnailCaptureRef.current = null;
      }
    },
    [
      slideFields,
      captureThumbnail
    ]
  );

  useEffect(
    () => {
      const length = slideFields.length;
      let next = activeSlideIndex;
      let needsAdjustment = false;

      if ( length === 0 ) {
        if ( activeSlideIndex !== 0 ) {
          setActiveSlideIndex( 0 );
        }
        handleSlideSelect( undefined );
      }
      else {
        if ( activeSlideIndex < 0 ) {
          next = 0;
          needsAdjustment = true;
        }
        else if ( activeSlideIndex > length - 1 ) {
          next = length - 1;
          needsAdjustment = true;
        }

        if ( needsAdjustment ) {
          handleSlideSelect( next );
        }
        else {
          if ( typeof window.setSlide === "function" ) {
            window.setSlide( next );
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

  const handleAddSlide = async() => {
    // Capture the current slide's thumbnail before adding a new one
    if ( activeSlideIndex !== undefined && slideFields[ activeSlideIndex ] ) {
      await captureThumbnail( slideFields[ activeSlideIndex ].id );
    }

    const nextIndex = slideFields.length;

    const newSlide = makeDefaultSlide( {
      indexForLabel: nextIndex,
      sketch: sketchFormValues,
    } );

    appendSlide( newSlide );

    await handleSlideSelect( nextIndex );

    // Mark that we need to capture thumbnail for the new slide
    pendingThumbnailCaptureRef.current = nextIndex;
  };

  const handleDuplicateSlide = ( indexToDuplicate: number ) => {
    const allSlides = getValues( "slides" ) ?? [
    ];
    const original = allSlides[ indexToDuplicate ];

    if ( !original ) {
      return;
    }

    const duplicated = deepClone( original );

    if ( duplicated?.name ) {
      duplicated.name = `${ duplicated.name } (copy)`;
    }

    const insertIndex = indexToDuplicate + 1;

    insertSlide(
      insertIndex,
      duplicated
    );

    handleSlideSelect( insertIndex );
  };

  const handleDeleteSlide = ( indexToDelete: number ) => {
    const lengthBefore = slideFields.length;

    if ( lengthBefore <= 0 ) {
      return;
    }

    // If we are deleting the LAST remaining slide, we want to move its settings
    // back to the global 'sketch' object so the user doesn't lose their configuration.
    if ( lengthBefore === 1 ) {
      const lastSlideSettings = getValues( `slides.${ indexToDelete }.sketch` );

      if ( lastSlideSettings ) {
        setValue(
          "sketch",
          deepClone( lastSlideSettings )
        );
      }
    }

    removeSlide( indexToDelete );
    const lengthAfter = lengthBefore - 1;

    if ( lengthAfter <= 0 ) {
      handleSlideSelect( 0 );
      return;
    }

    if ( indexToDelete < activeSlideIndex ) {
      handleSlideSelect( activeSlideIndex - 1 );
      return;
    }

    if ( indexToDelete === activeSlideIndex ) {
      const nextIndex = Math.min(
        activeSlideIndex,
        lengthAfter - 1
      );

      handleSlideSelect( nextIndex );
      return;
    }
    handleSlideSelect( activeSlideIndex );
  };

  const handleReorderSlides = (
    oldIndex: number, newIndex: number
  ) => {
    if ( oldIndex === newIndex ) {
      return;
    }

    moveSlide(
      oldIndex,
      newIndex
    );

    handleSlideSelect( newIndex );
  };

  const handleRenameSlide = (
    index: number, newName: string
  ) => {
    setValue(
      `slides.${ index }.name`,
      newName
    );
  };

  const slideIds = slideFields.map( ( field ) => field.id );
  const slidesLength = slides?.length;
  const rootContentLength = useWatch( {
    control,
    name: "content",
  } )?.length;

  const options = watch();
  const editorKey = slideIds[ activeSlideIndex ] ?? `${ activeSlideIndex }-${ slides?.[ activeSlideIndex ]?.name ?? "unnamed-slide" }`;

  const {
    backendRecording, sketchFormValues
  } = useSketch();

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
        style={{
          maxWidth: "calc(50% - 0.75rem)"
        }}
      >
        <CollapsibleItem
          className="flex flex-col gap-1 glass p-2 border border-theme rounded-2xl shadow-lg"
          style={{
            maxHeight: "calc(80svh)",
          }}
          header={( expanded ) => (
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
            header={( expanded ) => (
              <button
                className={
                  clsx(
                    "truncate text-foreground text-xs w-full text-left -ml-1 align-text-top",
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
                <span>global content {rootContentLength ? `(${ rootContentLength })` : null}</span>
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
                header={( expanded ) => (
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
                    <span>slides {slidesLength ? `(${ slidesLength })` : null}</span>
                  </button>
                )}
              >
                <SlideCarousel
                  slides={slides as SlideOption[]}
                  slideIds={slideIds}
                  thumbnails={thumbnails}
                  activeIndex={activeSlideIndex}
                  onAdd={handleAddSlide}
                  onSelect={handleSlideSelect}
                  onReorder={handleReorderSlides}
                  onDuplicate={handleDuplicateSlide}
                  onDelete={handleDeleteSlide}
                  onRename={handleRenameSlide}
                />

                <SlideEditor
                  key={editorKey}
                  activeIndex={activeSlideIndex}
                />
              </CollapsibleItem>
            </Fragment>
          )}
        </CollapsibleItem>

        {( backendRecording || browserRecordingSupported ) && <CaptureActions
          ref={captureActionsRef}
          name={name}
          options={options}
          persistedJob={persistedJob}
          activeSlideIndex={activeSlideIndex}
          backendRecording={backendRecording}
          browserRecordingSupported={browserRecordingSupported}
          thumbnails={thumbnails}
          onImportOptions={( importedOptions ) => {
            // Use reset to properly update all form values including arrays
            const processedOptions = initOptions( importedOptions as SketchOption );
            console.log(
              "Importing options:",
              {
                imported: importedOptions,
                processed: processedOptions,
                slidesCount: processedOptions.slides?.length
              }
            );
            reset( processedOptions );
            setHasUnsavedChanges( true );
          }}
        />
        }
      </div>

      <TemplateAssetsProvider scope="global" assetsName="assets" jobId={jobId}>
        <SketchSettings
          activeSlideIndex={slides && slides.length > 0 ? activeSlideIndex : undefined}
        />
      </TemplateAssetsProvider>
    </FormProvider>
  );
}

