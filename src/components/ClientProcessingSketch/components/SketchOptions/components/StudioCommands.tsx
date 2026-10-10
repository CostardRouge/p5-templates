"use client";

import {
  useEffect, useLayoutEffect, useRef
} from "react";
import {
  useFormContext
} from "react-hook-form";

import useSketch from "@/components/ClientProcessingSketch/components/SketchProvider/hooks/useSketch";
import {
  sketchCommands
} from "@/lib/agent/commands/sketchCommands";
import type {
  StudioHandles
} from "@/lib/agent/handles";
import {
  blobToImageResult
} from "@/lib/agent/imageResult";
import {
  getBridgeStatus, resumeBridge, sendFileToRelay, setBridgeSketch, studioCommands
} from "@/lib/agent/studioBridge";
import {
  getAnimationBridge
} from "@/lib/animationBridge";
import {
  captureFreshPngBlob
} from "@/lib/canvasSnapshot";
import {
  validateOptionsDocument
} from "@/lib/optionsDocument";
import type {
  FieldConfig
} from "./ContentItems/constants/field-config";
import makeDefaultItem from "./ContentItems/components/AddItemControls/utils/makeDefaultItem";
import type {
  ItemKind
} from "./ContentItems/components/AddItemControls/components/ItemPalette/types/item-kinds";
import {
  useFormUndoRedo
} from "./FormUndoRedo";
import {
  useSelectContentPath
} from "../hooks/useContentItemSelection";
import {
  randomizeFields
} from "../utils/randomizeFields";

export type SlideHandlers = StudioHandles[ "slides" ];

/**
 * Registers the studio's agent commands (`src/lib/agent/`) while the sketch
 * page's form is mounted, wired to the funnels the controls use. Mounted inside
 * `FormProvider` / `FormUndoRedo` / `ContentSelectionProvider`, beside the
 * content selection listener, so it reaches every one of them; it renders
 * nothing. Every handle reads the latest value through a ref, so the commands
 * are registered once per sketch, not per render.
 */
export default function StudioCommands( {
  activeSlideIndex,
  slides
}: {
  activeSlideIndex: number | undefined;
  slides: SlideHandlers;
} ) {
  const form = useFormContext();
  const [
    state,
    dispatch
  ] = useSketch();
  const history = useFormUndoRedo();
  const selectPath = useSelectContentPath();
  const latest = useRef( {
    form,
    state,
    dispatch,
    history,
    selectPath,
    activeSlideIndex,
    slides
  } );

  // The latest of everything, for handles that run long after this render.
  useLayoutEffect( () => {
    latest.current = {
      form,
      state,
      dispatch,
      history,
      selectPath,
      activeSlideIndex,
      slides
    };
  } );

  const sketchId = [
    state.engineId,
    state.category,
    state.name
  ].filter( Boolean ).join( "/" );

  useEffect(
    () => {
      const now = () => latest.current;
      const handles: StudioHandles = {
        sketchId,
        engineId: state.engineId,
        getValues: ( path ) => path ? now().form.getValues( path ) : now().form.getValues(),
        setValue: (
          path, value
        ) => now().form.setValue(
          path,
          value,
          {
            shouldDirty: true,
            shouldValidate: true
          }
        ),
        get formConfiguration() {
          return ( now().state.sketchFormConfiguration ?? {} ) as Record<string, unknown>;
        },
        get formValues() {
          return ( now().state.sketchFormValues ?? {} ) as Record<string, unknown>;
        },
        activeSlide: () => now().activeSlideIndex,
        slides: {
          select: ( index ) => now().slides.select( index ),
          add: () => now().slides.add(),
          duplicate: ( index ) => now().slides.duplicate( index ),
          remove: ( index ) => now().slides.remove( index ),
          move: (
            from, to
          ) => now().slides.move(
            from,
            to
          ),
          rename: (
            index, name
          ) => now().slides.rename(
            index,
            name
          )
        },
        history: {
          undo: () => now().history.undo(),
          redo: () => now().history.redo(),
          canUndo: () => now().history.canUndo,
          canRedo: () => now().history.canRedo
        },
        playback: {
          isPlaying: () => now().state.looping,
          // The transport's own toggle: the engine, and the context's flag.
          play: () => {
            now().state.engine?.play();
            now().dispatch( {
              type: "SET_LOOPING",
              payload: true
            } );
          },
          pause: () => {
            now().state.engine?.pause();
            now().dispatch( {
              type: "SET_LOOPING",
              payload: false
            } );
          },
          seek: ( progress ) => {
            const bridge = getAnimationBridge();

            bridge?.setProgression( progress );
            bridge?.redraw();
          },
          progress: () => getAnimationBridge()?.getProgression() ?? null
        },
        timing: () => window.__sketchCapture?.timing?.() ?? null,
        snapshot: () => captureFreshPngBlob( now().state.engine ),
        imageResult: blobToImageResult,
        selectPath: ( path ) => now().selectPath( path ),
        makeItem: (
          kind, seed
        ) => makeDefaultItem(
          kind as ItemKind,
          seed
        ) as unknown as Record<string, unknown>,
        validateDocument: validateOptionsDocument,
        randomize: ( basePath ) => randomizeFields(
          ( now().state.sketchFormConfiguration ?? {} ) as Record<string, FieldConfig>,
          basePath,
          {
            getValues: ( path: string ) => now().form.getValues( path ),
            setValue: (
              path: string, value: unknown
            ) => now().form.setValue(
              path,
              value,
              {
                shouldDirty: true
              }
            )
          }
        ),
        saveFile: sendFileToRelay,
        relayConnected: () => getBridgeStatus().state === "connected"
      };
      const off = studioCommands.register( [
        ...sketchCommands( handles )
      ] );

      setBridgeSketch( sketchId );
      resumeBridge();

      return off;
    },
    [
      sketchId,
      state.engineId
    ]
  );

  return null;
}
